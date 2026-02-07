const express = require('express');
const router = express.Router();
const { AdminController } = require('./admin.controller');
const { validation } = require('./admin.validation');
const { SessionProvider } = require('../../../shared/redis/session.provider');
const { adminMiddleware } = require('./admin.middleware');
const { statusHTTP } = require('../../../utils/setting');
const {Router} = require('../../../shared/router/router.provider');
const {MultiTenant} = require('../../../shared/multi_tenant/provider');

router.post('/login',MultiTenant.match(), validation.login, Router.trycatchFunction("post/management/admin/login", function (req, res) {
    return function () {
        AdminController.login(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.authorized);
            Router.LogAndMessage(res,"post/management/admin/login",err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/refreshToken', MultiTenant.match(), validation.refreshToken, Router.trycatchFunction("post/management/admin/refreshToken", function (req, res) {
    return function () {
        AdminController.refreshToken(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.authorized);
            Router.LogAndMessage(res,"post/management/admin/refreshToken",err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/loaddetails',MultiTenant.match(), SessionProvider.match, validation.loadDetails, Router.trycatchFunction("post/management/admin/loaddetails", function (req, res) {
    return function () {
        AdminController.loadDetails(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res,"post/management/admin/loaddetails",err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/dashboard',MultiTenant.match(), Router.trycatchFunction("post/management/admin/dashboard", function (req, res) {
    return function () {
        AdminController.getDashboardStats(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res,"post/management/admin/dashboard",err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/users',MultiTenant.match(), Router.trycatchFunction("post/management/admin/users", function (req, res) {
    return function () {
        AdminController.loadUsers(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res,"post/management/admin/users",err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/tenants/filter',MultiTenant.match(), Router.trycatchFunction("post/management/admin/tenants/filter", function (req, res) {
    return function () {
        AdminController.loadTenantsForFilter(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res,"post/management/admin/tenants/filter",err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/spaces',MultiTenant.match(), Router.trycatchFunction("post/management/admin/spaces", function (req, res) {
    return function () {
        AdminController.loadSpaces(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res,"post/management/admin/spaces",err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/projects',MultiTenant.match(), Router.trycatchFunction("post/management/admin/projects", function (req, res) {
    return function () {
        AdminController.loadProjects(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res,"post/management/admin/projects",err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/users/today/count',MultiTenant.match(), Router.trycatchFunction("post/management/admin/users/today/count", function (req, res) {
    return function () {
        AdminController.countTodayUsers(req.body).then(function (data) {
            res.send({ count: data });
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res,"post/management/admin/users/today/count",err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/users/today',MultiTenant.match(), Router.trycatchFunction("post/management/admin/users/today", function (req, res) {
    return function () {
        AdminController.loadTodayUsers(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res,"post/management/admin/users/today",err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/activities',MultiTenant.match(), Router.trycatchFunction("post/management/admin/activities", function (req, res) {
    return function () {
        AdminController.loadAllActivities(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res,"post/management/admin/activities",err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/reports',MultiTenant.match(), Router.trycatchFunction("post/management/admin/reports", function (req, res) {
    return function () {
        AdminController.getReportsStats(req.body).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res,"post/management/admin/reports",err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

router.post('/track/landing-visit',MultiTenant.match(), Router.trycatchFunction("post/management/admin/track/landing-visit", function (req, res) {
    return function () {
        AdminController.trackLandingVisit(req.body, req).then(function (data) {
            res.send(data);
            res.end();
            data = undefined;
            res = undefined;
            req = undefined;
            return;
        }, function (err) {
            res.status(statusHTTP.internalServer);
            Router.LogAndMessage(res,"post/management/admin/track/landing-visit",err);
            res.end();
            err = undefined;
            res = undefined;
            req = undefined;
            return;
        });
    }
}));

module.exports = router;
