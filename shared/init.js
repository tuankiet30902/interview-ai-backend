const q = require('q');
const trycatch = require('trycatch');
const socket = require('socket.io');
const redis = require("socket.io-redis");
const { MongoDBCore } = require('./mongodb/mongodb.core');
const MongoConst = require('./mongodb/mongodb.const');

const { RedisCore } = require('./redis/redis.core');
const RedisConst = require('./redis/redis.const');

const { socketHost } = require('../utils/setting');
// var io = require('socket.io-client'); 
const crypto = require('crypto-js');
const jwt = require('jsonwebtoken');
const { JWTOptions, secretkey } = require('../shared/authentication/authentication.const');
const { ConfigSetup } = require('../shared/setup/config.const');
const { MinioConfig } = require('./store/minio/config');

var init = {};
init.connectMongoDB = {};
init.initMongoDB = function() {
    let dfd = q.defer();
    trycatch(function() {
        console.log("start connect MongoDB");
        MongoDBCore.getConnect({
            connectString: MongoConst.connectString,
            reconnectTries: MongoConst.reconnectTries,
            reconnectInterval: MongoConst.reconnectInterval,
            useNewUrlParser: MongoConst.useNewUrlParser
        }).then(function(con) {
            init.connectMongoDB = con;
            console.log("Connected MongoDB");
            dfd.resolve(true);
            con = undefined;
        }, function(err) {
            dfd.reject(err);
            err = undefined;
        });
    }, function(err) {
        
        console.log(err);
        dfd.reject({ err });
        err = undefined;
    });
    return dfd.promise;
}

init.connectRedis = {};
init.initRedis = function() {
    let dfd = q.defer();
    console.log("start connect Redis");
    init.connectRedis = RedisCore.getConnect({
        port: RedisConst.port,
        host: RedisConst.host,
        password: RedisConst.password
    });
    // init.connectRedis.auth(RedisConst.password);
    console.log("Connected Redis");
    dfd.resolve(true);
    return dfd.promise;
}

// Initialize Elasticsearch (non-blocking, optional)
init.initElasticsearch = function() {
    let dfd = q.defer();
    try {
        const { ElasticsearchProvider } = require('./elasticsearch/elasticsearch.provider');
        console.log("🔄 Initializing Elasticsearch...");
        
        // Check if Elasticsearch is available (non-blocking)
        ElasticsearchProvider.isAvailable().then(function(isAvailable) {
            if (isAvailable) {
                // Setup index if not exists (non-blocking)
                ElasticsearchProvider.setupIndex()
                    .then(function() {
                        console.log("✅ Elasticsearch initialized and ready");
                        dfd.resolve(true);
                    })
                    .catch(function(err) {
                        console.warn("⚠️ Elasticsearch index setup failed (will retry later):", err.message);
                        dfd.resolve(true); // Resolve anyway, ES is optional
                    });
            } else {
                console.warn("⚠️ Elasticsearch is not available (search will use MongoDB fallback)");
                console.warn("   To enable Elasticsearch: docker-compose -f docker-compose.elasticsearch.yml up -d");
                dfd.resolve(true); // Resolve anyway, ES is optional
            }
        }).catch(function(err) {
            console.warn("⚠️ Elasticsearch check failed (will use MongoDB fallback):", err.message);
            dfd.resolve(true); // Resolve anyway, ES is optional
        });
    } catch (err) {
        console.warn("⚠️ Elasticsearch module not available (will use MongoDB fallback):", err.message);
        dfd.resolve(true); // Resolve anyway, ES is optional
    }
    return dfd.promise;
}

// Initialize MinIO (non-blocking, optional)
init.initMinIO = function() {
    let dfd = q.defer();
    try {
        console.log("🔄 Initializing MinIO...");
        MinioConfig.ensureBucket()
            .then(function() {
                console.log("✅ MinIO initialized and ready");
                dfd.resolve(true);
            })
            .catch(function(err) {
                console.warn("⚠️ MinIO initialization failed (file storage may not work):", err.message);
                console.warn("   To enable MinIO: ensure MinIO server is running on configured port");
                dfd.resolve(true); // Resolve anyway, MinIO is optional
            });
    } catch (err) {
        console.warn("⚠️ MinIO module not available (file storage may not work):", err.message);
        dfd.resolve(true); // Resolve anyway, MinIO is optional
    }
    return dfd.promise;
}

init.connectSocket = {};
init.initSocket = function() {
    // init.connectSocket = io(socketHost);
    var count = 0;
    init.connectSocket.on('connect', function() {
        console.log('socket connected. Authenticating...');
        trycatch(function() {
            count++;
            let cycleLife = JWTOptions.longExpiresIn;
            let secret;
            if (ConfigSetup.system.separateTenantFrontend) {
                secret = JWTOptions.jwtSecret_onHost;
            } else {
                secret = JWTOptions.jwtSecret;
            }
            let dataen = crypto.AES.encrypt(JSON.stringify({ username: secret }), secretkey).toString();
            let payload = { "data": dataen };

            let jwtToken = jwt.sign(payload, secret, { expiresIn: cycleLife });

            init.connectSocket.emit('authenticate', { token: jwtToken }); //send the jwt
            init.connectSocket.on('authenticated', function() {
                console.log('Socket authenticated');
            });
            init.connectSocket.on('unauthorized', function(msg) {
                console.log("unauthorized: " + JSON.stringify(msg.data));
                throw new Error(msg.data.type);
            });
        }, function(err) {
            console.log(err);
        });

    });
}

init.io ={};
init.initIO = function(server){
    try {
        init.io = socket(server);
        if(!RedisConst.password){
            init.io.adapter(redis({ host: RedisConst.host, port: RedisConst.port }));
        }else{
            init.io.adapter(redis({ host: RedisConst.host, port: RedisConst.port, password: RedisConst.password }));
        }
        
    } catch (error) {
        console.log(error);
    }


}


exports.init = init;