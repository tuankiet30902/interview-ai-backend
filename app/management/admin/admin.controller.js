const { AuthenticationProvider } = require('../../../shared/authentication/authentication.provider');
const q = require('q');
const jwt = require('jsonwebtoken');
const { JWTOptions } = require('../../../shared/authentication/authentication.const');
const { AdminService } = require('./admin.service');
const { ConfigSetup } = require('../../../shared/setup/config.const');
const { MongoDBProvider } = require('../../../shared/mongodb/db.provider');
const trycatch = require('trycatch');
const adminSocket = require('./socket');

class AdminController {
    constructor() { }

    login(body) {
        let dfd = q.defer();
        const encryptedPassword = AuthenticationProvider.encrypt_oneDirection_lv1(body.data.password);
        const dbname_prefix = body._service && body._service[0] ? body._service[0].dbname_prefix : "";
        const loginIdentifier = body.data.username || body.data.email;

        AdminService.checkExists(dbname_prefix, loginIdentifier, encryptedPassword).then(function (data) {
            if (data[0]) {
                let dataen = AuthenticationProvider.encrypt_lv1({ username: data[0].username });
                        let payload = { "data": dataen };
                        let secret;
                        if (ConfigSetup.system.separateTenantFrontend) {
                            secret = JWTOptions.jwtSecret_onHost;
                        } else {
                            secret = JWTOptions.jwtSecret;
                        }

                        let accessToken = jwt.sign(payload, secret, { expiresIn: JWTOptions.expiresIn });
                        let refreshToken = jwt.sign(payload, secret, { expiresIn: JWTOptions.longExpiresIn });

                const shouldRemember = body.data && body.data.remember !== undefined ? body.data.remember : false;

                        // Track login event (async, don't wait for it)
                        const now = Date.now();
                        const loginEventData = {
                            username: data[0].username,
                            timestamp: now,
                            created_at: now,
                            date_created: now,
                            ip_address: body.data?.ip_address || null,
                            user_agent: body.data?.user_agent || null
                        };
                        MongoDBProvider.insert_onManagement(dbname_prefix, "login_event", "system", loginEventData)
                            .catch(err => {
                                console.error('[AdminController.login] Failed to track login event:', err);
                            });

                        dfd.resolve({
                            token: accessToken,
                    refresh_token: shouldRemember ? refreshToken : null,
                            data: data[0]
                        });

                secret = undefined;
                dataen = undefined;
                payload = undefined;
                accessToken = undefined;
                refreshToken = undefined;
                } else {
                dfd.reject({ path: "AdminController.login.InvalidSigninInformation", mes: "InvalidSigninInformation" });
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
                dfd.reject({ path: "AdminController.refreshToken.RefreshTokenIsExpired", mes: "RefreshTokenIsExpired" });
            }

            let dataen = AuthenticationProvider.encrypt_lv1({ username });
            let payload = { "data": dataen };
            let secret = ConfigSetup.system.separateTenantFrontend ? JWTOptions.jwtSecret_onHost : JWTOptions.jwtSecret;
            let newAccessToken = jwt.sign(payload, secret, { expiresIn: JWTOptions.expiresIn });

            AdminService.loadDetails(body._service[0].dbname_prefix, username).then(function (data) {
                dfd.resolve({
                    token: newAccessToken,
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
            dfd.reject({ path: "AdminController.refreshToken.trycatch", err: err.stack });
            err = undefined;
        });

        return dfd.promise;
    }

    loadDetails(body) {
        let dfd = q.defer();
        let dfdAr = [];
        dfdAr.push(AdminService.loadDetails(body._service[0].dbname_prefix, body.account));
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

    getDashboardStats(body) {
        const dbname_prefix = body._service && body._service[0] ? body._service[0].dbname_prefix : "";
        return AdminService.getDashboardStats(dbname_prefix);
    }

    trackLandingVisit(body, req) {
        const dfd = q.defer();
        const dbname_prefix = body._service && body._service[0] ? body._service[0].dbname_prefix : "";
        const now = Date.now();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get IP address from request headers (support various proxy headers)
        const getClientIp = (req) => {
            if (!req) return null;
            return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                   req.headers['x-real-ip'] ||
                   req.connection?.remoteAddress ||
                   req.socket?.remoteAddress ||
                   null;
        };

        const visitData = {
            timestamp: now,
            created_at: now,
            date_created: now,
            ip_address: body.data?.ip_address || getClientIp(req) || null,
            user_agent: body.data?.user_agent || req?.headers?.['user-agent'] || null,
            referrer: body.data?.referrer || req?.headers?.['referer'] || null,
            date: today.getTime()
        };

        MongoDBProvider.insert_onManagement(dbname_prefix, "landing_visit", "system", visitData)
            .then(() => {
                console.log(`[AdminController.trackLandingVisit] Landing visit inserted successfully for dbname_prefix: "${dbname_prefix}"`);
                dfd.resolve({ success: true });
            }, (err) => {
                // Don't fail the request if tracking fails
                console.error('[AdminController.trackLandingVisit] Error:', err);
                dfd.resolve({ success: false, error: err.message });
            });

        return dfd.promise;
    }

    loadUsers(body) {
        const dbname_prefix = body._service && body._service[0] ? body._service[0].dbname_prefix : "";
        const options = body.data || {};
        return AdminService.loadUsersPaginated(dbname_prefix, options);
    }

    loadTenantsForFilter(body) {
        const dbname_prefix = body._service && body._service[0] ? body._service[0].dbname_prefix : "";
        return AdminService.loadTenantsForFilter(dbname_prefix);
    }

    loadSpaces(body) {
        const dbname_prefix = body._service && body._service[0] ? body._service[0].dbname_prefix : "";
        const options = body.data || {};
        return AdminService.loadSpacesPaginated(dbname_prefix, options);
    }

    loadProjects(body) {
        const dbname_prefix = body._service && body._service[0] ? body._service[0].dbname_prefix : "";
        const options = body.data || {};
        return AdminService.loadProjectsPaginated(dbname_prefix, options);
    }

    countTodayUsers(body) {
        const dbname_prefix = body._service && body._service[0] ? body._service[0].dbname_prefix : "";
        return AdminService.countTodayUsers(dbname_prefix);
    }

    loadTodayUsers(body) {
        const dbname_prefix = body._service && body._service[0] ? body._service[0].dbname_prefix : "";
        const options = body.data || {};

        // Get today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStart = today.getTime();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const todayEnd = tomorrow.getTime();

        // Set default options for today users
        const todayOptions = {
            page: options.page || 1,
            limit: options.limit || 20,
            dateFrom: todayStart,
            dateTo: todayEnd,
            sortBy: options.sortBy || "created_at",
            sortOrder: options.sortOrder || "desc"
        };

        return AdminService.loadUsersPaginated(dbname_prefix, todayOptions);
    }

    loadAllActivities(body) {
        const dbname_prefix = body._service && body._service[0] ? body._service[0].dbname_prefix : "";
        const options = body.data || {};
        return AdminService.loadAllActivities(dbname_prefix, options);
    }

    getReportsStats(body) {
        const dbname_prefix = body._service && body._service[0] ? body._service[0].dbname_prefix : "";
        return AdminService.getReportsStats(dbname_prefix);
    }
}

exports.AdminController = new AdminController();
