const { LogProvider } = require('../log_nohierarchy/log.provider');
const { MongoDBProvider } = require('../mongodb/db.provider');
const mongoDBSettings = require('../mongodb/mongodb.const');
const { messageHTTP, statusHTTP } = require('../../utils/setting');
const q = require('q');
const setting = require('../../utils/setting');

const PNT_TENANT = require('./pnt-tenant');

const serviceCache = {};
const CACHE_TTL = 5 * 60 * 1000;

const getCacheKey = function(domain) {
    return domain || '';
};

const isCacheValid = function(cacheEntry) {
    if (!cacheEntry || !cacheEntry.timestamp) return false;
    return (Date.now() - cacheEntry.timestamp) < CACHE_TTL;
};

class MultiTenant {
    constructor() { }
    handleDomain(domain) {
        if (domain.indexOf("https://") !== -1) {
            if (domain.indexOf("https://www.") !== -1) {
                return domain.split("https://www.")[1];

            } else {
                return domain.split("https://")[1];

            }
        }
        if (domain.indexOf("http://www.") !== -1) {
            return domain.split("http://www.")[1];

        } else {
            return domain.split("http://")[1];

        }
    }

    loadService(domain, conditions) {
        let dfd = q.defer();

        const cacheKey = getCacheKey(domain);
        const cached = serviceCache[cacheKey];

        if (isCacheValid(cached)) {
            dfd.resolve(cached.data);
            return dfd.promise;
        }

        let filter = {
            domain: { $eq: domain }
        };

        MongoDBProvider.load(undefined, mongoDBSettings.connectName.main, "service", filter
        ).then(function (data) {
            const result = data[0] ? data : false;
            serviceCache[cacheKey] = {
                data: result,
                timestamp: Date.now()
            };

            dfd.resolve(result);
        }, function (err) {
            dfd.reject(err);
            err = undefined;
        });
        return dfd.promise;
    }

    match(conditions) {
        return function (req, res, next) {

            req.body = req.body || {};
            req.body._service = [PNT_TENANT];
            next();
            return;
        }
    }

    isHost() {
        return function (req, res, next) {
            next();
            return;
        }
    }

    getActiveTenants() {
        let dfd = q.defer();
        let filter = {};

        MongoDBProvider.load(undefined, mongoDBSettings.connectName.main, "service", filter)
            .then(function (data) {
                dfd.resolve(data);
            }, function (err) {
                dfd.reject(err);
                err = undefined;
            });
        return dfd.promise;
    }

    // Method to clear service cache (useful for testing or manual cache invalidation)
    clearCache() {
        Object.keys(serviceCache).forEach(key => delete serviceCache[key]);
    }
}

exports.MultiTenant = new MultiTenant();
