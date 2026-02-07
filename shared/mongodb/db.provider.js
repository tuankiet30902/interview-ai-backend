const { MongoDBInterface } = require('./db.interface');
const settings = require('./mongodb.const');

class MongoDBProvider {
    constructor() { }

    // ============ LOAD METHODS ============
    loadAggregate(dbname_prefix, dbname, collection, filter) {
        return MongoDBInterface.load_aggregate(dbname_prefix, dbname, { collection, filter });
    }

    loadAggregateMain(dbname_prefix, collection, filter) {
        return MongoDBInterface.load_aggregate(dbname_prefix, settings.connectName.main, { collection, filter });
    }

    load(dbname_prefix, dbname, collection, filter, top, offset, sort, keys, unlimited) {
        return MongoDBInterface.load(dbname_prefix, dbname, { collection, filter, top, offset, sort, keys, unlimited });
    }

    loadMain(dbname_prefix, collection, filter, top, offset, sort, keys, unlimited) {
        return MongoDBInterface.load(dbname_prefix, settings.connectName.main, { collection, filter, top, offset, sort, keys, unlimited });
    }

    loadMainWithCache(dbname_prefix, collection, filter, top, offset, sort, keys, unlimited) {
        return MongoDBInterface.load_with_cache(dbname_prefix, settings.connectName.main, { collection, filter, top, offset, sort, keys, unlimited });
    }

    loadMainWithTrack(dbname_prefix, _performanceId, collection, filter, top, offset, sort, keys, unlimited) {
        return MongoDBInterface.load(dbname_prefix, settings.connectName.main, { _performanceId, collection, filter, top, offset, sort, keys, unlimited });
    }

    // ============ GET ONE METHODS ============
    getOne(dbname_prefix, dbname, collection, filter) {
        return MongoDBInterface.getOne(dbname_prefix, dbname, collection, filter);
    }

    getOneMain(dbname_prefix, collection, filter) {
        return MongoDBInterface.getOne(dbname_prefix, settings.connectName.main, collection, filter);
    }

    // ============ COUNT METHODS ============
    count(dbname_prefix, dbname, collection, filter) {
        return MongoDBInterface.count(dbname_prefix, dbname, { collection, filter });
    }

    countMain(dbname_prefix, collection, filter) {
        return MongoDBInterface.count(dbname_prefix, settings.connectName.main, { collection, filter });
    }

    // ============ INSERT METHODS ============
    insert(dbname_prefix, dbname, collection, username, data, options) {
        return MongoDBInterface.insert(dbname_prefix, dbname, { collection, username }, data, options);
    }

    insertMain(dbname_prefix, collection, username, data, options) {
        return MongoDBInterface.insert(dbname_prefix, settings.connectName.main, { collection, username }, data, options);
    }

    insertMany(dbname_prefix, dbname, collection, username, data, options) {
        return MongoDBInterface.insertMany(
            dbname_prefix, dbname,
            { collection, username },
            data,
            options);
    }

    insertManyMain(dbname_prefix, collection, username, data, options) {
        return MongoDBInterface.insertMany(
            dbname_prefix, settings.connectName.main,
            { collection, username },
            data,
            options);
    }

    insertWithSequenceNumber(dbname_prefix, dbname, collection, username, data, options) {
        return MongoDBInterface.insertWithSequenceNumber(
            dbname_prefix,
            dbname,
            { collection, username },
            data,
            options,
        );
    }

    insertWithSequenceNumberMain(dbname_prefix, collection, username, data, options) {
        return MongoDBInterface.insertWithSequenceNumber(
            dbname_prefix,
            settings.connectName.main,
            { collection, username },
            data,
            options);
    }

    // ============ UPDATE METHODS ============
    update(dbname_prefix, dbname, collection, username, filter, data, options) {
        return MongoDBInterface.update(dbname_prefix, dbname, { collection, username }, filter, data, options);
    }

    updateMain(dbname_prefix, collection, username, filter, data, options) {
        return MongoDBInterface.update(dbname_prefix, settings.connectName.main, { collection, username }, filter, data, options);
    }

    updateMainWithCache(dbname_prefix, collection, username, filter, data, options) {
        return MongoDBInterface.update_with_cache(dbname_prefix, settings.connectName.main, { collection, username }, filter, data, options);
    }

    // ============ DELETE METHODS ============
    delete(dbname_prefix, dbname, collection, username, filter, options) {
        return MongoDBInterface.delete(dbname_prefix, dbname, { collection, username }, filter, options);
    }

    deleteMain(dbname_prefix, collection, username, filter, options) {
        return MongoDBInterface.delete(dbname_prefix, settings.connectName.main, { collection, username }, filter, options);
    }

    deleteMainWithCache(dbname_prefix, collection, username, filter, options) {
        return MongoDBInterface.delete_with_cache(dbname_prefix, settings.connectName.main, { collection, username }, filter, options);
    }

    // ============ RESTORE METHOD ============
    restore(dbname_prefix, dbname, collection, username, data, options) {
        return MongoDBInterface.restore(dbname_prefix, dbname, { collection, username }, data, options);
    }

    // ============ INDEX METHODS ============
    createIndex(dbname_prefix, dbname, collection, keys, type) {
        return MongoDBInterface.createIndex(dbname_prefix, dbname, collection, keys, type);
    }

    createIndexMain(dbname_prefix, collection, keys, type) {
        return MongoDBInterface.createIndex(dbname_prefix, settings.connectName.main, collection, keys, type);
    }

    removeIndex(dbname_prefix, dbname, collection, filter) {
        return MongoDBInterface.removeIndex(dbname_prefix, dbname, collection, filter);
    }

    removeIndexMain(dbname_prefix, collection, filter) {
        return MongoDBInterface.removeIndex(dbname_prefix, settings.connectName.main, collection, filter);
    }

    // ============ COLLECTION METHODS ============
    createCollection(dbname_prefix, dbname, name) {
        return MongoDBInterface.createCollection(dbname_prefix, dbname, name);
    }

    createCollectionMain(dbname_prefix, name) {
        return MongoDBInterface.createCollection(dbname_prefix, settings.connectName.main, name);
    }

    listCollection(dbname_prefix, dbname) {
        return MongoDBInterface.listCollection(dbname_prefix, dbname);
    }

    listCollectionMain(dbname_prefix) {
        return MongoDBInterface.listCollection(dbname_prefix, settings.connectName.main);
    }

    // ============ TRANSACTION METHODS ============
    executeTransaction(exeFunc) {
        return MongoDBInterface.executeTransaction(exeFunc);
    }

    // ============ AUTO INCREMENT METHODS ============
    getAutoIncrementNumber(dbname_prefix, key) {
        return MongoDBInterface.autonumber(
            dbname_prefix,
            settings.connectName.main,
            key,
        );
    }

    getAutoIncrementNumberDaily(dbname_prefix, key) {
        return MongoDBInterface.autonumberDaily(
            dbname_prefix,
            settings.connectName.main,
            key,
        );
    }

}

exports.MongoDBProvider = new MongoDBProvider();
