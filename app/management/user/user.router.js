const express = require('express');
const router = express.Router();
const { UserController } = require('./user.controller');
const { UserService } = require('./user.service');
const { validation } = require('./user.validation');
const { SessionProvider } = require('../../../shared/redis/session.provider');
const { PermissionProvider } = require('../../../shared/permission/permission.provider');
const { statusHTTP } = require('../../../utils/setting');
const { Router } = require('../../../shared/router/router.provider');
const { MultiTenant } = require('../../../shared/multi_tenant/provider');
const { FileProvider } = require('../../../shared/file/file.provider');
const userAvatarFolder = ['management', 'user'];

router.post('/login', MultiTenant.match(), validation.login, Router.trycatchFunction("post/management/user/login", function (req, res) {
    return function () {
        UserController.login(req.body).then(function (data) {
            res.send(data);
            // res.header({ 'access_token': data.jwtToken });
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.authorized);
            Router.LogAndMessage(res, "post/management/user/login", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));


router.post('/setup_mfa', MultiTenant.match(), validation.setup_mfa, Router.trycatchFunction("post/management/user/setup_mfa", function (req, res) {
    return function () {
        UserController.setup_mfa(req.body).then(function (data) {
            res.send(data);
            // res.header({ 'access_token': data.jwtToken });
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.authorized);
            Router.LogAndMessage(res, "post/management/user/setup_mfa", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/verify_mfa', MultiTenant.match(), validation.verify_mfa, Router.trycatchFunction("post/management/user/verify_mfa", function (req, res) {
    return function () {
        UserController.verify_mfa(req.body).then(function (data) {
            res.send(data);
            // res.header({ 'access_token': data.jwtToken });
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.authorized);
            Router.LogAndMessage(res, "post/management/user/verify_mfa", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));


router.post('/auth', MultiTenant.match(), SessionProvider.match, Router.trycatchFunction("post/management/user/auth", function (req, res) {
    return function () {
        // Thay vì chỉ trả lại session cũ từ frontend, luôn reload user từ DB
        // để đảm bảo avatar, avatar_color... luôn là dữ liệu mới nhất.
        const dbname_prefix = req.body._service && req.body._service[0]
            ? req.body._service[0].dbname_prefix
            : "";

        const sendResponse = function (userData) {
            res.send({ username: req.body.username, data: userData, service: req.body._service[0] });
            res.end();
        };

        UserService.loadDetails(dbname_prefix, req.body.username).then(function (user) {
            if (!user) {
                sendResponse(req.body.session);
                res = undefined;
                req = undefined;
                return;
            }

            const finalize = function (userWithAvatar) {
                sendResponse(userWithAvatar);
                userWithAvatar = undefined;
                res = undefined;
                req = undefined;
            };

            if (user.avatar && user.avatar.name && user.avatar.nameLib) {
                FileProvider.loadFile(
                    dbname_prefix,
                    {},
                    user.avatar.nameLib,
                    user.avatar.name,
                    undefined,
                    undefined,
                    userAvatarFolder,
                    user.username
                ).then(function (img) {
                    user.avatar.url = img.url;
                    user.avatar_url = img.url;
                    finalize(user);
                }, function () {
                    finalize(user);
                });
            } else {
                if (!user.avatar && user.avatar_url) {
                    user.avatar = { url: user.avatar_url };
                }
                finalize(user);
            }
        }, function (err) {
            // Nếu lỗi (ví dụ user bị xóa), log và fallback về session hiện tại để không chặn frontend
            Router.LogAndMessage(res, "post/management/user/auth", err);
            sendResponse(req.body.session);
            err = undefined;
            res = undefined;
            req = undefined;
        });
    }
}));

router.post('/refreshToken', MultiTenant.match(), validation.refreshToken, Router.trycatchFunction("post/management/user/refreshToken", function (req, res) {
    return function () {
        UserController.refreshToken(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.authorized);
            Router.LogAndMessage(res, "post/management/user/refreshToken", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/changepassword', MultiTenant.match(), SessionProvider.match, validation.changePassword, Router.trycatchFunction("post/management/user/changepassword", function (req, res) {
    return function () {
        UserController.changePassword(req.body).then(function (data) {
            res.send({ status: data });
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/changepassword", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/changelanguage', MultiTenant.match(), SessionProvider.match, validation.changeLanguage, Router.trycatchFunction("post/management/user/changelanguage", function (req, res) {
    return function () {
        UserController.changeLanguage(req.body).then(function (data) {
            res.send({ status: data });
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/changelanguage", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/changetheme', MultiTenant.match(), SessionProvider.match, validation.changeTheme, Router.trycatchFunction("post/management/user/changetheme", function (req, res) {
    return function () {
        UserController.changeTheme(req.body).then(function (data) {
            res.send({ status: data });
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/changetheme", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/updateProfile', MultiTenant.match(), SessionProvider.match, Router.trycatchFunction("post/management/user/updateProfile", function (req, res) {
    return function () {
        UserController.updateProfile(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/updateProfile", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));
router.post('/loaddetails', MultiTenant.match(), PermissionProvider.check(["Management.User.Use"]), validation.loadDetails, Router.trycatchFunction("post/management/user/loaddetails", function (req, res) {
    return function () {
        UserController.loadDetails(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/loaddetails", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/loadfordirective', MultiTenant.match(), PermissionProvider.check(["Authorized"]), validation.loadForDirective, Router.trycatchFunction("post/management/user/loadfordirective", function (req, res) {
    return function () {
        UserController.loadForDirective(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/loadfordirective", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/load_for_add_friend', MultiTenant.match(), PermissionProvider.check(["Basic.Use"]), validation.load_for_add_friend, Router.trycatchFunction("post/management/user/load_for_add_friend", function (req, res) {
    return function () {
        UserController.loadUserForAddFriend(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/load_for_add_friend", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/load', MultiTenant.match(), PermissionProvider.check(["Management.User.Use"]), validation.load, Router.trycatchFunction("post/management/user/load", function (req, res) {
    return function () {
        UserController.load(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/load", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/load_host_meeting_room', MultiTenant.match(), validation.load, Router.trycatchFunction("post/management/user/load_host_meeting_room", function (req, res) {
    return function () {
        UserController.load_host_meeting_room(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/load_host_meeting_room", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/count', MultiTenant.match(), PermissionProvider.check(["Management.User.Use"]), validation.count, Router.trycatchFunction("post/management/user/count", function (req, res) {
    return function () {
        UserController.count(req.body).then(function (data) {
            res.send({ count: data });
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/count", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/load_for_pick_user_directive', MultiTenant.match(), PermissionProvider.check(["Authorized"]), validation.load_for_pick_user_directive, Router.trycatchFunction("post/management/user/load_for_pick_user_directive", function (req, res) {
    return function () {
        UserController.load_for_pick_user_directive(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/load_for_pick_user_directive", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/count_for_pick_user_directive', MultiTenant.match(), PermissionProvider.check(["Authorized"]), validation.count_for_pick_user_directive, Router.trycatchFunction("post/management/user/count_for_pick_user_directive", function (req, res) {
    return function () {
        UserController.count_for_pick_user_directive(req.body).then(function (data) {
            res.send({ count: data });
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/count_for_pick_user_directive", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/register', MultiTenant.match(), validation.register, Router.trycatchFunction("post/management/user/register", function (req, res) {
    return function () {
        UserController.insert(req.body).then(function (data) {
            res.send({ status: data });
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/register", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/registerPublic', MultiTenant.match(), validation.registerPublic, Router.trycatchFunction("post/management/user/registerPublic", function (req, res) {
    return function () {
        UserController.registerPublic(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/registerPublic", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/checkexist', MultiTenant.match(), PermissionProvider.check(["Management.User.Use"]), validation.checkexist, Router.trycatchFunction("post/management/user/checkexist", function (req, res) {
    return function () {
        UserController.checkExist(req.body).then(function (data) {
            res.send({ status: data });
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/checkexist", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/update', MultiTenant.match(), PermissionProvider.check(["Management.User.Use"]), validation.update, Router.trycatchFunction("post/management/user/update", function (req, res) {
    return function () {
        UserController.update(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/update", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/pushrule', MultiTenant.match(), PermissionProvider.check(["Management.User.AssignPermission"]), validation.pushRule, Router.trycatchFunction("post/management/user/pushrule", function (req, res) {
    return function () {
        UserController.pushRule(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/pushrule", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/removerule', MultiTenant.match(), PermissionProvider.check(["Management.User.AssignPermission"]), validation.removeRule, Router.trycatchFunction("post/management/user/removerule", function (req, res) {
    return function () {
        UserController.removeRule(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/removerule", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));


router.post('/delete', MultiTenant.match(), PermissionProvider.check(["Management.User.DeleteUser"]), validation.delete, Router.trycatchFunction("post/management/user/delete", function (req, res) {
    return function () {
        UserController.delete(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/delete", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/updateavatar', MultiTenant.match(), PermissionProvider.check(["Authorized"]), Router.trycatchFunction("post/management/user/updateavatar", function (req, res) {
    return function () {
        UserController.updateAvatar(req).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/updateavatar", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/deleteAccount', MultiTenant.match(), PermissionProvider.check(["Authorized"]), validation.deleteAccount, Router.trycatchFunction("post/management/user/deleteAccount", function (req, res) {
    return function () {
        UserController.deleteAccount(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/deleteAccount", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/reset_password', MultiTenant.match(), PermissionProvider.check(["Management.User.Use"]), validation.reset_password, Router.trycatchFunction("post/management/user/reset_password", function (req, res) {
    return function () {
        UserController.resetPassword(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/reset_password", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/load_by_role', MultiTenant.match(), PermissionProvider.check(["Management.User.Use"]), validation.loadByRole, Router.trycatchFunction("post/management/user/load_by_role", function (req, res) {
    return function () {
        UserController.loadUserByRole(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/load_by_role", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));


// Google OAuth routes
router.post('/google/authUrl', MultiTenant.match(), validation.getGoogleAuthUrl, Router.trycatchFunction("post/management/user/google/authUrl", function (req, res) {
    return function () {
        UserController.getGoogleAuthUrl().then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/google/authUrl", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
        });
    }
}));

router.post('/google/login', MultiTenant.match(), validation.loginWithGoogle, Router.trycatchFunction("post/management/user/google/login", function (req, res) {
    return function () {
        UserController.loginWithGoogle(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
        }, function (err) {
            res.status(statusHTTP.authorized);
            Router.LogAndMessage(res, "post/management/user/google/login", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
        });
    }
}));

router.post('/apple/login', MultiTenant.match(), validation.loginWithApple, Router.trycatchFunction("post/management/user/apple/login", function (req, res) {
    return function () {
        UserController.loginWithApple(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
        }, function (err) {
            res.status(statusHTTP.authorized);
            Router.LogAndMessage(res, "post/management/user/apple/login", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
        });
    }
}));

router.post('/sendVerificationCode', MultiTenant.match(), validation.sendVerificationCode, Router.trycatchFunction("post/management/user/sendVerificationCode", function (req, res) {
    return function () {
        UserController.sendVerificationCode(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/sendVerificationCode", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
        });
    }
}));

router.post('/verifyCode', MultiTenant.match(), validation.verifyCode, Router.trycatchFunction("post/management/user/verifyCode", function (req, res) {
    return function () {
        UserController.verifyCode(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res, "post/management/user/verifyCode", err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
        });
    }
}));

module.exports = router;
