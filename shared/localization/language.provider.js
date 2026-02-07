const LanguageConst = require('./language.const');
const MongoDBConst = require('../mongodb/mongodb.const');
const { MongoDBProvider } = require('../mongodb/db.provider');
const { CacheProvider } = require('../redis/cache.provider');
const q = require('q');

class LanguageProvider {
    constructor() { }
    getLanguageListDefault() {
        return LanguageConst.list;
    }

    getLanguageDetailsDefault(key) {
        return require("./" + key + ".concern");
    }

    getCurrentLanguageDefault() {
        return LanguageConst.default;
    }

    getLanguageListConfig(dbname_prefix) {
        let dfd = q.defer();
        MongoDBProvider.loadMain(dbname_prefix,
            MongoDBConst.nameCollection.language,{}).then(function (data) {
            dfd.resolve(data);
            data = undefined;
        }, function (err) {
            dfd.reject(err);
            err = undefined;
        });

        return dfd.promise;
    }

    getLanguageDetailsConfig(dbname_prefix,key) {
        let dfd = q.defer();
  
        MongoDBProvider.loadMain(dbname_prefix,
            MongoDBConst.nameCollection.language,{ key: { $eq: key } }).then(function (data) {
            if (data[0]) {
                dfd.resolve(data[0].items);
            } else {
                dfd.reject({ path: "LanguageProvider.getLanguageListConfig.datanull", err: "datanull" });
            }
            data = undefined;
            dfd = undefined;
        }, function (err) {
            dfd.reject(err);
            err = undefined;
        });

        return dfd.promise;
    }

    getCurrentLanguageConfig(dbname_prefix) {
        let dfd = q.defer();


        MongoDBProvider.loadMain(dbname_prefix,
            MongoDBConst.nameCollection.language,{ },1).then(function (data) {
            if (data[0] && data[0].language && data[0].language.default) {
                dfd.resolve(data[0].language.default);
            } else {
                dfd.reject({ path: "LanguageProvider.getLanguageConfig.datanull", err: "datanull" });
            }
            data = undefined;
        }, function (err) {
            dfd.reject(err);
            err = undefined;
        });

        return dfd.promise;
    }

    getLanguageList(dbname_prefix) {
        let dfd = q.defer();
        let obj = new LanguageProvider();
        obj.getLanguageListConfig(dbname_prefix).then(function (data) {
            let result = obj.getLanguageListDefault();
            for (var i in data) {
                let check = true;
                for (var j in result) {
                    if (data[i].key == result[j].key) { result[j] = data[i]; check = false; break; }
                }
                if (check) { result.push(data[i]); }
            }
            dfd.resolve(result);
            obj = undefined;
            result = undefined;
            data = undefined;
        }, function (err) {
            dfd.reject(err);
            err = undefined;
            obj = undefined;
        });

        return dfd.promise;
    }

    getLanguageDetails(dbname_prefix,key) {
        let dfd = q.defer();
        let obj = new LanguageProvider();
        
        // ✅ PERFORMANCE: Cache key for language details (5 minutes TTL)
        const cacheKey = `language:${dbname_prefix}:${key}`;
        const cacheSubKey = 'details';
        const cacheQueryKey = key;
        
        // Try to get from cache first
        CacheProvider.get(cacheKey, cacheSubKey, cacheQueryKey).then(function(cachedData) {
            if (cachedData) {
                // Cache hit - return immediately
                dfd.resolve(cachedData);
                obj = undefined;
                return;
            }
            
            // Cache miss - load from database
            obj.getLanguageDetailsConfig(dbname_prefix,key).then(function (data) {
                let result = obj.getLanguageDetailsDefault(key);
                for (var i in data) {
                    let check = true;
                    for (var j in result) {
                        if (data[i].key == result[j].key) { result[j] = data[i]; break; }
                    }
                    if (check) { result.push(data[i]); }
                }
                
                // ✅ Cache result for 5 minutes (300 seconds)
                CacheProvider.put(cacheKey, cacheSubKey, cacheQueryKey, result).catch(function(cacheErr) {
                    // Non-blocking: log but don't fail if cache fails
                    console.warn(`[LanguageProvider.getLanguageDetails] Failed to cache result:`, cacheErr);
                });
                
                dfd.resolve(result);
                obj = undefined;
                result = undefined;
                data = undefined;
            }, function (err) {
                if (err.err == "datanull") {
                    const defaultResult = obj.getLanguageDetailsDefault(key);
                    
                    // ✅ Cache default result too
                    CacheProvider.put(cacheKey, cacheSubKey, cacheQueryKey, defaultResult).catch(function(cacheErr) {
                        console.warn(`[LanguageProvider.getLanguageDetails] Failed to cache default result:`, cacheErr);
                    });
                    
                    dfd.resolve(defaultResult);
                } else {
                    dfd.reject(err);
                }
                key = undefined;
                err = undefined;
                obj = undefined;
            });
        }, function(cacheErr) {
            // Cache error - fallback to database (non-blocking)
            console.warn(`[LanguageProvider.getLanguageDetails] Cache error, falling back to database:`, cacheErr);
            obj.getLanguageDetailsConfig(dbname_prefix,key).then(function (data) {
                let result = obj.getLanguageDetailsDefault(key);
                for (var i in data) {
                    let check = true;
                    for (var j in result) {
                        if (data[i].key == result[j].key) { result[j] = data[i]; break; }
                    }
                    if (check) { result.push(data[i]); }
                }
                dfd.resolve(result);
                obj = undefined;
                result = undefined;
                data = undefined;
            }, function (err) {
                if (err.err == "datanull") {
                    dfd.resolve(obj.getLanguageDetailsDefault(key));
                } else {
                    dfd.reject(err);
                }
                key = undefined;
                err = undefined;
                obj = undefined;
            });
        });

        return dfd.promise;
    }

    getCurrentLanguage(dbname_prefix,currentKey) {
        let dfd = q.defer();
        if (currentKey) { dfd.resolve(currentKey); } else {

            let obj = new LanguageProvider();
            obj.getCurrentLanguageConfig(dbname_prefix).then(function (data) {
                dfd.resolve(data);
                obj = undefined;
                data = undefined;
            }, function (err) {
                if (err.err == "datanull") {
                    dfd.resolve(obj.getCurrentLanguageDefault());
                } else {
                    dfd.reject(err);
                }
                err = undefined;
                obj = undefined;
            });


        }
        return dfd.promise;
    }

}
exports.LanguageProvider = new LanguageProvider();