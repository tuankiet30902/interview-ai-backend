const Minio = require('minio');
const { StoreConst } = require('./store.const');

const minioClient = new Minio.Client({
    endPoint: StoreConst.minioEndpoint,
    port: StoreConst.minioPort,
    useSSL: StoreConst.minioUseSSL,
    accessKey: StoreConst.minioAccessKey,
    secretKey: StoreConst.minioSecretKey
});

class MinioConfig {
    constructor() {}

    getClient() {
        return minioClient;
    }

    getBucketName() {
        return StoreConst.minioBucketName;
    }

    async ensureBucket() {
        try {
            const bucketExists = await minioClient.bucketExists(StoreConst.minioBucketName);
            if (!bucketExists) {
                await minioClient.makeBucket(StoreConst.minioBucketName, StoreConst.minioRegion);
                console.log(`Bucket ${StoreConst.minioBucketName} created`);
            }
        } catch (error) {
            console.error('Error ensuring bucket:', error);
            throw error;
        }
    }
}

exports.MinioConfig = new MinioConfig();