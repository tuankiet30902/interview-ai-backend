

const q = require('q');
const { SessionProvider } = require('../../../shared/redis/session.provider');

class SystemController {
    constructor() { }
    checkRouter(req) {
        let dfd = q.defer();
        // Since we're not using dynamic menu anymore, checkRouter is simplified
        // This can be removed or kept for basic route validation if needed
        dfd.reject({ path: "SystemController.checkRouter.PathIsNotFound", err: "PathIsNotFound" });
        return dfd.promise;
    }
}

exports.SystemController = new SystemController();
