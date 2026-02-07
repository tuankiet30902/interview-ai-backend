const q = require('q');
const { MinioConfig } = require('./config');

class MinioProvider {
    constructor() {
    }

    createFile(buffer, filePath, mimetype) {
        const dfd = q.defer();
        
        try {
            const client = MinioConfig.getClient();
            const bucketName = MinioConfig.getBucketName();
            
            const metaData = {
                'Content-Type': mimetype
            };

            client.putObject(bucketName, filePath, buffer, buffer.length, metaData, (err, etag) => {
                if (err) {
                    console.error('Error uploading to MinIO:', err);
                    dfd.reject(err);
                    return;
                }
                console.log(`File uploaded: ${filePath}`);
                dfd.resolve({ etag, filePath });
            });
        } catch (error) {
            dfd.reject(error);
        }

        return dfd.promise;
    }

    loadFile(filePath, expiry = 24 * 60 * 60) {
        const dfd = q.defer();
        
        try {
            const client = MinioConfig.getClient();
            const bucketName = MinioConfig.getBucketName();

            client.presignedGetObject(bucketName, filePath, expiry, (err, presignedUrl) => {
                if (err) {
                    dfd.reject(err);
                    return;
                }
                dfd.resolve(presignedUrl);
            });
        } catch (error) {
            dfd.reject(error);
        }

        return dfd.promise;
    }

    viewFile(filePath, expiry = 24 * 60 * 60) {
        const dfd = q.defer();
        
        try {
            const client = MinioConfig.getClient();
            const bucketName = MinioConfig.getBucketName();

            const respHeaders = {
                'response-content-disposition': 'inline'
            };

            client.presignedGetObject(bucketName, filePath, expiry, respHeaders, (err, presignedUrl) => {
                if (err) {
                    dfd.reject(err);
                    return;
                }
                dfd.resolve(presignedUrl);
            });
        } catch (error) {
            dfd.reject(error);
        }

        return dfd.promise;
    }

    downloadBuffer(filePath) {
        const dfd = q.defer();
        
        try {
            const client = MinioConfig.getClient();
            const bucketName = MinioConfig.getBucketName();

            client.getObject(bucketName, filePath, (err, dataStream) => {
                if (err) {
                    dfd.reject(err);
                    return;
                }

                const chunks = [];
                dataStream.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                dataStream.on('end', () => {
                    dfd.resolve(Buffer.concat(chunks));
                });

                dataStream.on('error', (error) => {
                    dfd.reject(error);
                });
            });
        } catch (error) {
            dfd.reject(error);
        }

        return dfd.promise;
    }

    deleteFile(filePath) {
        const dfd = q.defer();
        
        try {
            const client = MinioConfig.getClient();
            const bucketName = MinioConfig.getBucketName();

            client.removeObject(bucketName, filePath, (err) => {
                if (err) {
                    dfd.reject(err);
                    return;
                }
                console.log(`File deleted: ${filePath}`);
                dfd.resolve(filePath);
            });
        } catch (error) {
            dfd.reject(error);
        }

        return dfd.promise;
    }

    getFileInfo(filePath) {
        const dfd = q.defer();
        
        try {
            const client = MinioConfig.getClient();
            const bucketName = MinioConfig.getBucketName();

            client.statObject(bucketName, filePath, (err, stat) => {
                if (err) {
                    dfd.reject(err);
                    return;
                }
                dfd.resolve(stat);
            });
        } catch (error) {
            dfd.reject(error);
        }

        return dfd.promise;
    }

    listFiles(prefix = '') {
        const dfd = q.defer();
        
        try {
            const client = MinioConfig.getClient();
            const bucketName = MinioConfig.getBucketName();
            const files = [];

            const stream = client.listObjects(bucketName, prefix, true);
            
            stream.on('data', (obj) => {
                files.push(obj);
            });

            stream.on('end', () => {
                dfd.resolve(files);
            });

            stream.on('error', (err) => {
                dfd.reject(err);
            });
        } catch (error) {
            dfd.reject(error);
        }

        return dfd.promise;
    }
}

exports.minioProvider = new MinioProvider();