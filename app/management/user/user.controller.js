

const { AuthenticationProvider } = require('../../../shared/authentication/authentication.provider');
const q = require('q');
const jwt = require('jsonwebtoken');
const { JWTOptions } = require('../../../shared/authentication/authentication.const');
const { UserService } = require('./user.service');
const { ConfigSetup } = require('../../../shared/setup/config.const');
const { FileProvider } = require('../../../shared/file/file.provider');
const { optimizeImageIfPossible } = require('../../../shared/file/image-optimizer');
const trycatch = require('trycatch');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const nameLib = "avatar";
const settings = require('../../../utils/setting');
const { TYPE_SERVICE } = require('./const');
const { GoogleAuthProvider } = require('../../../shared/google-auth/google-auth.provider');
const { MongoDBProvider } = require('../../../shared/mongodb/db.provider');
const adminSocket = require('../admin/socket');

const parentFolder = '/management';

// Helper function removed - realtime updates no longer needed
// const emitAdminDataChanged = (dbname_prefix, type) => {
//     adminSocket.emitAdminDataChanged(dbname_prefix, type);
// };
const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024; // 5MB hard limit for avatar images
const countFilterCondition = function (body) {
    let count = 0;
    if (body.isactive !== undefined) {
        count++;
    }
    if (body.search !== undefined && body.search !== "") {
        count++;
    }
    return count;
}

const genFilterData = function (body) {
    let count = countFilterCondition(body);
    if (count == 0) { return {}; }
    let filter;
    if (count > 1) {
        filter = { $and: [] };
        if (body.isactive !== undefined) {
            filter.$and.push({ isactive: { $eq: body.isactive } });
        }
        if (body.search !== undefined && body.search !== "") {
            filter.$and.push({
                $text: { $search: body.search }
            });

        }
    } else {
        if (body.isactive !== undefined) {
            filter = { isactive: { $eq: body.isactive } };
        }
        if (body.search !== undefined) {
            filter = {
                $text: { $search: body.search }
            };
        }
    }
    return filter;
}

const genFilterData_for_pick_user_directive = function (body) {
    if (body.search !== undefined) {
        return {
            $and: [
                {
                    $text: { $search: body.search }
                },
                {
                    isactive: { $eq: true }
                },
                {
                    department: { $eq: body.department }
                }
            ]
        };
    } else {
        return {
            $and: [
                {
                    isactive: { $eq: true }
                },
                {
                    department: { $eq: body.department }
                }
            ]
        };
    }
}

const generateUserInfo = function (body) {
    let obj = {};
    // Ensure language is always in object format: { current: "vi-VN" }
    if (body.language !== undefined) {
        // If body.language is a string, convert to object format
        if (typeof body.language === 'string') {
            obj.language = { current: body.language };
        } else if (body.language && body.language.current) {
            // If it's already an object with current field, use it
            obj.language = body.language;
        } else {
            // If it's an object but missing current field, use default
            obj.language = ConfigSetup.user.new.language;
        }
    } else {
        obj.language = ConfigSetup.user.new.language; // Already in correct format: { current: "vi-VN" }
    }
    obj.isactive = body.isactive !== undefined ? body.isactive : ConfigSetup.user.new.isactive;
    return obj;
}

function getToken(body, data) {
    let dataen = AuthenticationProvider.encrypt_lv1({ username: data.username });
    let payload = { "data": dataen };
    let secret;
    if (ConfigSetup.system.separateTenantFrontend) {
        secret = JWTOptions.jwtSecret_onHost;
    } else {
        secret = JWTOptions.jwtSecret;
    }

    let accessToken = jwt.sign(payload, secret, { expiresIn: JWTOptions.expiresIn });
    let refreshToken = jwt.sign(payload, secret, { expiresIn: JWTOptions.longExpiresIn });

    // Check if remember is set (for regular login) or default to true for Google login
    const shouldRemember = body.data && body.data.remember !== undefined
        ? body.data.remember
        : true; // Default to true for Google login

    return {
        accessToken: accessToken,
        refresh_token: shouldRemember ? refreshToken : null,
        data: data,
    }
}

class UserController {
    constructor() { }

    login(body) {
        let dfd = q.defer();
        const encryptedPassword = AuthenticationProvider.encrypt_oneDirection_lv1(body.data.password);
        const dbname_prefix = body._service && body._service[0] ? body._service[0].dbname_prefix : "";
        const loginIdentifier = body.data.email;

        UserService.checkExists(dbname_prefix, loginIdentifier, encryptedPassword).then(function (data) {
            if (data[0]) {
                const user = data[0];
                const typeTenant = body._service && body._service[0] ? body._service[0].type : null;
                if (typeTenant === TYPE_SERVICE.PAY_FEE) {
                    dfd.resolve({
                        has_mfa: user.has_mfa
                    });
                } else {
                    // Check if email is verified
                    if (!user.email_verified) {
                        // Return user info but indicate verification is required
                        // This allows frontend to show verification page without blocking completely
                        dfd.resolve({
                            requiresVerification: true,
                            email: user.email,
                            username: user.username,
                            data: {
                                username: user.username,
                                email: user.email,
                                title: user.title
                            }
                        });
                        return;
                    }

                    // ✅ Removed: Auto-create tenant logic - user should create spaces directly
                    // User can create spaces manually after login
                    const tokenInfo = getToken(body, user);
                    const tenantIds = (user.tenant_ids || []).map(id => id && id.toString ? id.toString() : String(id));
                    const primaryTenantId = user.primary_tenant_id ? (user.primary_tenant_id.toString ? user.primary_tenant_id.toString() : String(user.primary_tenant_id)) : null;

                    const response = {
                        ...tokenInfo,
                        tenant_ids: tenantIds,
                        primary_tenant_id: primaryTenantId,
                        requiresVerification: false,
                        isNewUser: !user.tenant_ids || user.tenant_ids.length === 0 // New user if no tenant_ids
                    };
                    dfd.resolve(response);
                }
            } else {
                dfd.reject({ path: "UserController.login.InvalidSigninInformation", mes: "InvalidSigninInformation" });
            }
        }, function (err) {
            dfd.reject(err);
        });

        return dfd.promise;
    }

    setup_mfa(body) {
        let dfd = q.defer();
        UserService.checkExists(body._service[0].dbname_prefix, body.data.username, body.data.password).then(function (data) {
            if (data[0]) {
                const secretMFA = speakeasy.generateSecret({ name: `${settings.mfa_app_name}:${data[0].username}` });
                UserService.setup_mfa(body._service[0].dbname_prefix, body.data.username, secretMFA.base32).then(function () {
                    QRCode.toDataURL(secretMFA.otpauth_url, (err, data_url) => {
                        if (err) {
                            dfd.reject(err);
                        } else {
                            dfd.resolve({
                                secret_mfa: secretMFA.base32,
                                qrCode: data_url
                            });
                        }

                    });
                }, function (err) { dfd.reject(err) })
            } else {
                dfd.reject({ path: "UserController.setup_mfa.InvalidSigninInformation", mes: "InvalidSigninInformation" });
            }
        }, function (err) {
            dfd.reject(err);
            body = undefined;
            err = undefined;
        });
        return dfd.promise;
    }

    verify_mfa(body) {
        let dfd = q.defer();
        UserService.checkExists(body._service[0].dbname_prefix, body.data.username, body.data.password).then(function (data) {
            if (data[0]) {
                const verified = speakeasy.totp.verify({
                    secret: data[0].mfa_secret,
                    encoding: 'base32',
                    token: body.data.token_mfa
                });

                if (verified) {
                    UserService.mark_mfa(body._service[0].dbname_prefix, body.data.username).then(function () {
                        let dataen = AuthenticationProvider.encrypt_lv1({ username: body.data.username });
                        let payload = { "data": dataen };
                        let secret;
                        if (ConfigSetup.system.separateTenantFrontend) {
                            secret = JWTOptions.jwtSecret_onHost;
                        } else {
                            secret = JWTOptions.jwtSecret;
                        }

                        let accessToken = jwt.sign(payload, secret, { expiresIn: JWTOptions.expiresIn });
                        let refreshToken = jwt.sign(payload, secret, { expiresIn: JWTOptions.longExpiresIn });
                        dfd.resolve({
                            accessToken: accessToken,
                            refresh_token: body.data.remember ? refreshToken : null,
                            data: data[0]
                        });
                    }, function (err) { dfd.reject(err) });

                } else {
                    dfd.reject({
                        path: "UserController.verify_mfa.InvalidSigninInformation",
                        mes: "InvalidSigninInformation"
                    })
                }

            } else {
                dfd.reject({ path: "UserController.verify_mfa.InvalidSigninInformation", mes: "InvalidSigninInformation" });
            }
        }, function (err) {
            dfd.reject(err);
            body = undefined;
            err = undefined;
        });
        return dfd.promise;
    }

    refreshToken(body) {
        let dfd = q.defer();
        trycatch(function () {
            let jwtParser = jwt.decode(body.refreshToken);
            let username = AuthenticationProvider.decrypt_lv1(jwtParser.data).username;
            if (jwtParser.exp < Date.now() / 1000) {
                dfd.reject({ path: "UserController.refreshToken.RefreshTokenIsExpired", mes: "RefreshTokenIsExpired" });
            }

            let dataen = AuthenticationProvider.encrypt_lv1({ username });
            let payload = { "data": dataen };
            let secret = ConfigSetup.system.separateTenantFrontend ? JWTOptions.jwtSecret_onHost : JWTOptions.jwtSecret;
            let newAccessToken = jwt.sign(payload, secret, { expiresIn: JWTOptions.expiresIn });

            UserService.loadDetails(body._service[0].dbname_prefix, username).then(function (data) {
                dfd.resolve({
                    accessToken: newAccessToken,
                    data
                });

                jwtParser = undefined;
                username = undefined;
                dataen = undefined;
                payload = undefined;
                secret = undefined;
                newAccessToken = undefined;
            }, function (err) {
                dfd.reject(err);
                err = undefined;
                body = undefined;
            });
        }, function (err) {
            dfd.reject({ path: "UserController.refreshToken.trycatch", err: err.stack });
            err = undefined;
        });

        return dfd.promise;
    }

    changePassword(body) {
        let dfd = q.defer();
        body.password = AuthenticationProvider.encrypt_oneDirection_lv1(body.password);
        body.newpassword = AuthenticationProvider.encrypt_oneDirection_lv1(body.newpassword);
        UserService.checkExists(body._service[0].dbname_prefix, body.username, body.password).then(function (data) {
            if (data[0]) {
                UserService.changePassword(body._service[0].dbname_prefix, body.username, body.password, body.newpassword).then(function () {
                    dfd.resolve(true);
                    dfd = undefined;
                    body = undefined;
                }, function (err) {
                    dfd.reject(err);
                    err = undefined;
                    body = undefined;
                });
            } else {
                dfd.reject({ path: "UserController.changePassword.InvalidPassword", mes: "InvalidPassword" });
            }
        }, function (err) {
            dfd.reject(err);
            err = undefined;
            body = undefined;
        });
        return dfd.promise;
    }

    changeLanguage(body) {
        return UserService.changeLanguage(body._service[0].dbname_prefix, body.username, body.key);
    }

    changeTheme(body) {
        return UserService.changeTheme(body._service[0].dbname_prefix, body.username, body.theme);
    }

    updateProfile(body) {
        return UserService.updateProfile(
            body._service[0].dbname_prefix,
            body.username,
            body.data?.title,
            body.data?.password,
            body.data?.currentPassword,
            body.data?.avatar_color
        );
    }

    loadUserForAddFriend(body) {
        return UserService.loadUserForAddFriend(body._service[0].dbname_prefix, body.username, body.search);
    }

    load_for_pick_user_directive(body) {
        let filter = genFilterData_for_pick_user_directive(body);
        return UserService.loadUser(body._service[0].dbname_prefix, filter, body.top, body.offset, body.sort);
    }

    count_for_pick_user_directive(body) {
        let filter = genFilterData_for_pick_user_directive(body);
        return UserService.countUser(body._service[0].dbname_prefix, filter);
    }

    load(body) {
        let filter = genFilterData(body);
        return UserService.loadUser(body._service[0].dbname_prefix, filter, body.top, body.offset, body.sort);
    }

    load_host_meeting_room(body) {
        let filter = genFilterData(body);
        return UserService.loadUser(body._service[0].dbname_prefix, filter, body.top, body.offset, body.sort);
    }

    count(body) {
        let filter = genFilterData(body);
        return UserService.countUser(body._service[0].dbname_prefix, filter);
    }

    insert(body) {
        const dfd = q.defer();

        let info = generateUserInfo(body);
        body.password = AuthenticationProvider.encrypt_oneDirection_lv1(body.password);
        UserService.insert(
            body._service[0].dbname_prefix,
            body.username,
            body.title,
            body.account,
            body.password,
            info.language,
            info.isactive,
            body.department
        )
            .then(() => {
                dfd.resolve(true);
            })
            .catch((err) => {
                dfd.reject({
                    mes: err.mes ? err.mes : "Unexpected error occurred while create account",
                });
            })

        return dfd.promise;
    }

    registerPublic(body) {
        const dfd = q.defer();

        // For public registration, always use empty dbname_prefix for shared database
        // Override dbname_prefix from service to use shared database
        const dbname_prefix = body._service[0].dbname_prefix; // Empty prefix for shared database

        let info = generateUserInfo(body);
        body.password = AuthenticationProvider.encrypt_oneDirection_lv1(body.password);

        // For public registration, always set isactive to true
        const isactive = true;

        UserService.registerPublic(
            dbname_prefix,
            body.email,
            body.name,
            body.password,
            info.language,
            isactive
        ).then(() => {
            dfd.resolve(true);
        }).catch((err) => {
            dfd.reject({
                mes: err.mes ? err.mes : "Unexpected error occurred while creating account",
            });
        });
        return dfd.promise;
    }

    checkExist(body) {
        return UserService.checkExist(body._service[0].dbname_prefix, body.account);
    }

    update(body) {
        const dbname_prefix = body._service[0].dbname_prefix;
        return UserService.update(dbname_prefix, body.username, body.id, body.title, body.isactive, body.role);
    }

    delete(body) {
        const dbname_prefix = body._service[0].dbname_prefix;
        return UserService.delete(dbname_prefix, body.id, body.username);
    }

    deleteAccount(body) {
        const dbname_prefix = body._service[0].dbname_prefix;
        const username = body.username;
        return UserService.deleteAccount(dbname_prefix, username);
    }

    pushRule(body) {
        return UserService.pushRule(body._service[0].dbname_prefix, body.username, body.id, body.rule);
    }

    removeRule(body) {
        return UserService.removeRule(body._service[0].dbname_prefix, body.username, body.id, body.rule);
    }

    loadDetails(body) {
        let dfd = q.defer();
        let dfdAr = [];
        dfdAr.push(UserService.loadDetails(body._service[0].dbname_prefix, body.account));
        // dfdAr.push(UserService.loadPerson(body.account));
        q.all(dfdAr).then(function (res) {
            // res[0].person = res[1]._id;
            dfd.resolve(res[0]);
            res = undefined;
            dfd = undefined;
        }, function (err) {
            dfd.reject(err);
            err = undefined;
        });
        return dfd.promise;
    }

    loadForDirective(body) {
        return UserService.loadForDirective(body._service[0].dbname_prefix, body.account);
    }

    updateAvatar(req) {
        let dfd = q.defer();
        FileProvider.upload(req, nameLib, undefined, "/user", parentFolder, req.body.username).then(function (res) {
            const fileInfo = res && res.Files && res.Files[0];
            if (!fileInfo) {
                dfd.reject({ path: "UserController.updateAvatar", mes: "UploadFailed" });
                return;
            }
            if (fileInfo.fileSize && fileInfo.fileSize > MAX_AVATAR_FILE_SIZE) {
                dfd.reject({ path: "UserController.updateAvatar.FileTooLarge", mes: "AvatarFileTooLarge" });
                return;
            }
            // Tối ưu ảnh (resize + nén) ở server, fail-safe
            optimizeImageIfPossible({
                dbname_prefix: req.body._service[0].dbname_prefix,
                nameLib,
                fileInfo,
                maxSize: 512,
            }).catch(() => { });
            UserService.updateAvatar(req.body._service[0].dbname_prefix, req.body.username,
                {
                    timePath: fileInfo.timePath,
                    locate: fileInfo.type,
                    display: fileInfo.filename,
                    name: fileInfo.named,
                    nameLib,
                }).then(async function () {
                    try {
                        const folderArray = ['management', 'user'];
                        const fileData = await FileProvider.loadFile(
                            req.body._service[0].dbname_prefix,
                            {},
                            nameLib,
                            fileInfo.named,
                            undefined,
                            undefined,
                            folderArray,
                            req.body.username
                        );
                        dfd.resolve({
                            success: true,
                            avatar_url: fileData ? fileData.url : null
                        });
                    } catch (loadErr) {
                        dfd.resolve({
                            success: true,
                            avatar_url: null
                        });
                    }
                    req = undefined;
                }, function (err) {
                    dfd.reject(err);
                    req = undefined;
                });
        }, function (err) {
            dfd.reject(err);
            req = undefined;
        });
        return dfd.promise;
    }

    resetPassword(body) {
        return UserService.resetPassword(body._service[0].dbname_prefix, body.username, body.account);
    }

    loadUserByRole(body) {
        let dfd = q.defer();
        let dfdAr = [];
        dfdAr.push(UserService.loadByRole(body._service[0].dbname_prefix, body.role));
        q.all(dfdAr).then(function (res) {
            dfd.resolve(res[0]);
            res = undefined;
            dfd = undefined;
        }, function (err) {
            dfd.reject(err);
            err = undefined;
        });
        return dfd.promise;
    }

    /**
     * Get Google OAuth URL
     */
    getGoogleAuthUrl() {
        let dfd = q.defer();
        try {
            if (!GoogleAuthProvider) {
                throw new Error('GoogleAuthProvider is not available');
            }
            const authUrl = GoogleAuthProvider.getAuthUrl();
            if (!authUrl) {
                throw new Error('Failed to generate Google auth URL');
            }
            dfd.resolve({ authUrl: authUrl });
        } catch (err) {
            console.error('Error in getGoogleAuthUrl:', err);
            dfd.reject({
                path: "UserController.getGoogleAuthUrl.Error",
                mes: err.message || "FailedToGetGoogleAuthUrl"
            });
        }
        return dfd.promise;
    }

    /**
     * Login or register with Google
     */
    loginWithGoogle(body) {
        let dfd = q.defer();
        const dbname_prefix = body._service && body._service[0] ? body._service[0].dbname_prefix : "";
        const code = body.code;

        UserService.loginWithGoogle(dbname_prefix, code).then(function (result) {
            const user = result.user;

            // Ensure avatar structure exists for frontend consistency
            if (!user.avatar && user.avatar_url) {
                user.avatar = { url: user.avatar_url };
            }

            const tokenInfo = getToken(body, user);

            // Normalize tenant fields (do not auto-create anything)
            const tenantIds = (user.tenant_ids || []).map(id => id && id.toString ? id.toString() : String(id));
            const primaryTenantId = user.primary_tenant_id
                ? (user.primary_tenant_id.toString ? user.primary_tenant_id.toString() : String(user.primary_tenant_id))
                : null;

            const response = {
                ...tokenInfo,
                tenant_ids: tenantIds,
                primary_tenant_id: primaryTenantId,
                isNewUser: result.isNewUser || false,
                requiresVerification: result.requiresVerification || false
            };
            dfd.resolve(response);
        }, function (err) {
            dfd.reject(err);
        });

        return dfd.promise;
    }

    /**
     * Login or register with Apple Sign-In
     */
    loginWithApple(body) {
        let dfd = q.defer();
        const dbname_prefix = body._service && body._service[0] ? body._service[0].dbname_prefix : "";
        const { identityToken, authorizationCode, email, displayName, nonce } = body;

        UserService.loginWithApple(dbname_prefix, identityToken, authorizationCode, email, displayName, nonce).then(function (result) {
            const user = result.user;

            // Check if user has tenant, if not, auto-create tenant with default space and project
            const hasTenant = result.tenant_ids && result.tenant_ids.length > 0;

            console.log(`[UserController.loginWithApple] User ${user.username} has tenant: ${hasTenant}`);

            if (!hasTenant) {
                console.log(`[UserController.loginWithApple] Auto-creating tenant for user ${user.username}...`);
                UserService.autoSetupTenantWithDefaults(dbname_prefix, user.username)
                    .then(function (setupResult) {
                        console.log(`[UserController.loginWithApple] Tenant setup result:`, setupResult);
                        return UserService.loadDetails(dbname_prefix, user.username).then(function (updatedUser) {
                            return {
                                user: updatedUser,
                                setupResult: setupResult
                            };
                        });
                    })
                    .then(function (data) {
                        const updatedUser = data.user;
                        const setupResult = data.setupResult;
                        const tokenInfo = getToken(body, updatedUser || user);
                        const tenantIds = ((updatedUser || user).tenant_ids || []).map(id => id && id.toString ? id.toString() : String(id));
                        const primaryTenantId = (updatedUser || user).primary_tenant_id ? ((updatedUser || user).primary_tenant_id.toString ? (updatedUser || user).primary_tenant_id.toString() : String((updatedUser || user).primary_tenant_id)) : null;

                        const response = {
                            ...tokenInfo,
                            tenant_ids: tenantIds,
                            primary_tenant_id: primaryTenantId,
                            isNewUser: result.isNewUser || false,
                            requiresVerification: result.requiresVerification || false,
                            tenant_auto_created: true,
                            space_id: setupResult?.space_id || null,
                            project_id: setupResult?.project_id || null
                        };
                        dfd.resolve(response);
                    }, function (setupErr) {
                        console.error("[UserController.loginWithApple] Failed to auto-setup tenant:", setupErr);
                        const tokenInfo = getToken(body, user);
                        const response = {
                            ...tokenInfo,
                            tenant_ids: [],
                            primary_tenant_id: null,
                            isNewUser: result.isNewUser || false,
                            requiresVerification: result.requiresVerification || false,
                            tenant_auto_created: false
                        };
                        dfd.resolve(response);
                    });
            } else {
                const tokenInfo = getToken(body, user);
                const tenantIds = (result.tenant_ids || []).map(id => id && id.toString ? id.toString() : String(id));
                const primaryTenantId = result.primary_tenant_id ? (result.primary_tenant_id.toString ? result.primary_tenant_id.toString() : String(result.primary_tenant_id)) : null;

                const response = {
                    ...tokenInfo,
                    tenant_ids: tenantIds,
                    primary_tenant_id: primaryTenantId,
                    isNewUser: result.isNewUser || false,
                    requiresVerification: result.requiresVerification || false
                };
                dfd.resolve(response);
            }
        }, function (err) {
            dfd.reject(err);
        });

        return dfd.promise;
    }

    sendVerificationCode(body) {
        let dfd = q.defer();
        const dbname_prefix = body._service && body._service[0] ? body._service[0].dbname_prefix : "";
        const email = body.data.email;

        UserService.sendVerificationCode(dbname_prefix, email).then(function (result) {
            dfd.resolve(result);
        }, function (err) {
            // Preserve error message from service
            dfd.reject(err);
        });

        return dfd.promise;
    }

    verifyCode(body) {
        let dfd = q.defer();

        const dbname_prefix = body._service && body._service[0] ? body._service[0].dbname_prefix : "";
        const email = body.data.email;
        const code = body.data.code;

        UserService.verifyCode(dbname_prefix, email, code).then(function (result) {
            const user = result.user;
            const tokenInfo = getToken(body, user);

            const tenantIds = (user.tenant_ids || []).map(id => id && id.toString ? id.toString() : String(id));
            const primaryTenantId = user.primary_tenant_id ? (user.primary_tenant_id.toString ? user.primary_tenant_id.toString() : String(user.primary_tenant_id)) : null;

            const response = {
                ...tokenInfo,
                tenant_ids: tenantIds,
                primary_tenant_id: primaryTenantId,
                message: result.message
            };
            dfd.resolve(response);
        }, function (err) {
            dfd.reject(err);
        });

        return dfd.promise;
    }
}

exports.UserController = new UserController();
