const { 
    MINIO_ENDPOINT, 
    MINIO_PORT, 
    MINIO_ACCESS_KEY, 
    MINIO_SECRET_KEY, 
    MINIO_BUCKET_NAME,
    MINIO_USE_SSL,
    MINIO_REGION
} = process.env;

var obj = {
    minioEndpoint: MINIO_ENDPOINT,
    minioPort: parseInt(MINIO_PORT) || 443,
    minioAccessKey: MINIO_ACCESS_KEY,
    minioSecretKey: MINIO_SECRET_KEY,
    minioBucketName: MINIO_BUCKET_NAME,
    minioUseSSL: MINIO_USE_SSL === 'true',
    minioRegion: MINIO_REGION || 'vi-eranin'
};

exports.StoreConst = obj;