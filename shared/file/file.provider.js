const { FileInterface } = require('./file.interface');
const q = require('q');
const trycatch = require('trycatch');
const { minioProvider } = require('../store/minio/minio.provider');
const { LogProvider } = require('../log_nohierarchy/log.provider');

const setUndefinedForFileData = function (files) {
    for (let i in files) {
        delete files[i].data;
    }
    return files;
}

const setUndefinedForFileInfoData = function (files) {
    for (let i in files) {
        for (var j in files[i]) {
            delete files[i][j].data;
        }
    }
    return files;
}

class FileProvider {
    constructor() {}
    
    upload(req, nameLib, validateSchema, thePath, parentFolder, usernameStatic) {
        let dfd = q.defer();
        trycatch(
            function () {
                let d = new Date();
                let timePath;
                let timeName = d.getTime();
                let dbNamePrfix = req.body._service[0].dbname_prefix;
                
                if (usernameStatic) {
                    let month = d.getMonth() > 8 ? d.getMonth() + 1 : '0' + (d.getMonth() + 1);
                    let date = d.getDate() > 9 ? d.getDate() : '0' + d.getDate();
                    timePath = '/' + usernameStatic + '/' + d.getFullYear() + '_' + month + '_' + date;
                } else {
                    let username = req.body && req.body.username ? req.body.username : 'system';
                    let month = d.getMonth() > 8 ? d.getMonth() + 1 : '0' + (d.getMonth() + 1);
                    let date = d.getDate() > 9 ? d.getDate() : '0' + d.getDate();
                    timePath = '/' + username + '/' + d.getFullYear() + '_' + month + '_' + date;
                }

                let newNameLib = (nameLib || '').replace(/^\/+|\/+$/g, '');
                let newThepath = (thePath || '').replace(/^\/+|\/+$/g, '');
                let newFolder = (parentFolder || '').replace(/^\/+|\/+$/g, '');
                let newUserName = usernameStatic ? usernameStatic : '';
                
                FileInterface.analyze(
                    req,
                    timePath,
                    timeName,
                    validateSchema,
                    newNameLib,
                    newThepath,
                    newFolder,
                    newUserName,
                    dbNamePrfix
                ).then(
                    function (res) {
                        res.Files = setUndefinedForFileData(res.Files);
                        res.fileInfo = setUndefinedForFileInfoData(res.fileInfo);
                        dfd.resolve(res);
                        req = undefined;
                        nameLib = undefined;
                        res = undefined;
                        validateSchema = undefined;
                        thePath = undefined;
                    },
                    function (err) {
                        dfd.reject(err);
                        err = undefined;
                        req = undefined;
                        nameLib = undefined;
                        validateSchema = undefined;
                        thePath = undefined;
                    }
                );
            },
            function (err) {
                dfd.reject({ path: 'FileProvider.upload.trycactch', err: err.stack });
                req = undefined;
                nameLib = undefined;
                validateSchema = undefined;
                thePath = undefined;
            }
        );
        return dfd.promise;
    }

    uploadAndGetBuffer(req, nameLib, validateSchema, thePath, parentFolder, usernameStatic) {
        let dfd = q.defer();
        trycatch(
            function () {
                let d = new Date();
                let timePath;
                let timeName = d.getTime();
                let dbNamePrfix = req.body._service[0].dbname_prefix;
                
                if (usernameStatic) {
                    let month = d.getMonth() > 8 ? d.getMonth() + 1 : '0' + (d.getMonth() + 1);
                    let date = d.getDate() > 9 ? d.getDate() : '0' + d.getDate();
                    timePath = '/' + usernameStatic + '/' + d.getFullYear() + '_' + month + '_' + date;
                } else {
                    let username = req.body && req.body.username ? req.body.username : 'system';
                    let month = d.getMonth() > 8 ? d.getMonth() + 1 : '0' + (d.getMonth() + 1);
                    let date = d.getDate() > 9 ? d.getDate() : '0' + d.getDate();
                    timePath = '/' + username + '/' + d.getFullYear() + '_' + month + '_' + date;
                }

                let newNameLib = nameLib ? nameLib + '/' : '';
                if (newNameLib && newNameLib.charAt(0) === '/') newNameLib = newNameLib.slice(1);

                let newThepath = thePath ? thePath + '/' : '';
                if (newThepath && newThepath.charAt(0) === '/') newThepath = newThepath.slice(1);

                let newFolder = parentFolder ? parentFolder + '/' : '';
                if (newFolder && newFolder.charAt(0) === '/') newFolder = newFolder.slice(1);
                let newUserName = usernameStatic ? usernameStatic : '';
                
                FileInterface.uploadAndGetBuffer(
                    req,
                    timePath,
                    timeName,
                    validateSchema,
                    newNameLib,
                    newThepath,
                    newFolder,
                    newUserName,
                    dbNamePrfix
                ).then(
                    function (res) {
                        res.Files = setUndefinedForFileData(res.Files);
                        res.fileInfo = setUndefinedForFileInfoData(res.fileInfo);
                        dfd.resolve(res);
                        req = undefined;
                        nameLib = undefined;
                        res = undefined;
                        validateSchema = undefined;
                        thePath = undefined;
                    },
                    function (err) {
                        dfd.reject(err);
                        err = undefined;
                        req = undefined;
                        nameLib = undefined;
                        validateSchema = undefined;
                        thePath = undefined;
                    }
                );
            },
            function (err) {
                dfd.reject({ path: 'FileProvider.upload.trycactch', err: err.stack });
                req = undefined;
                nameLib = undefined;
                validateSchema = undefined;
                thePath = undefined;
            }
        );
        return dfd.promise;
    }

    getBufferUpload(req, validateSchema){
        return FileInterface.getBufferUpload(req, validateSchema);
    }

    rollback(dbname_prefix, Files) {
        let dfd = q.defer();
        trycatch(
            function () {
                let dfdAr = [];
                for (let i in Files) {
                    dfdAr.push(FileInterface.delete('/' + dbname_prefix + Files[i].timePath + '/' + Files[i].named));
                }
                q.all(dfdAr).then(
                    function () {
                        dfd.resolve(Files);
                    },
                    function (err) {
                        dfd.reject(err);
                        LogProvider.warn(err, 'FileProvider.rollback.deleteFiles', 'service', '', { Files });
                        Files = undefined;
                    }
                );
            },
            function (err) {
                dfd.reject({ path: 'FileProvider.rollback.trycatch', err: err.stack });
                Files = undefined;
            }
        );
        return dfd.promise;
    }

    loadFile(dbname_prefix, session, nameLib, nameFile, timePath, locate, folder, userName) {
        let dfd = q.defer();
        
        // Build file path
        let folderPath;
        if (Array.isArray(folder)) {
            const normalizedFolderArray = folder.map(function(f) {
                return f.replace(/^\/+|\/+$/g, '');
            }).filter(function(f) {
                return f.length > 0;
            });
            folderPath = normalizedFolderArray.join('/');
        } else {
            folderPath = (folder || '').replace(/^\/+|\/+$/g, '');
        }

        const cleanNameLib = (nameLib || '').replace(/^\/+|\/+$/g, '');
        const cleanUserName = (userName || '').replace(/^\/+|\/+$/g, '');

        let pathBucket = dbname_prefix;
        if (folderPath) {
            pathBucket += '/' + folderPath;
        }
        if (cleanNameLib) {
            pathBucket += '/' + cleanNameLib;
        }
        if (cleanUserName) {
            pathBucket += '/' + cleanUserName;
        }
        pathBucket += '/' + nameFile;

        // Get presigned URL from MinIO
        minioProvider.loadFile(pathBucket).then((url) => {
            dfd.resolve({
                type: 'local',
                url: url,
            });
        }).catch((err) => {
            dfd.reject(err);
        });

        return dfd.promise;
    }

    deleteFile(dbname_prefix, session, nameLib, Files, userName, folderArray) {
        let dfd = q.defer();
        trycatch(
            function () {
                let dfdAr = [];
                for (let i in Files) {
                    const folderPath = folderArray.join('/');
                    const filePath = dbname_prefix + '/' + folderPath + '/' + nameLib + '/' + userName + '/' + Files[i].name;
                    dfdAr.push(FileInterface.delete(filePath));
                }
                q.all(dfdAr).then(
                    function () {
                        dfd.resolve(true);
                        session = undefined;
                        nameLib = undefined;
                        Files = undefined;
                        dfdAr = undefined;
                    },
                    function (err) {
                        dfd.reject(err);
                        err = undefined;
                        session = undefined;
                        nameLib = undefined;
                        Files = undefined;
                        dfdAr = undefined;
                    }
                );
            },
            function (err) {
                console.log(err.stack);
                dfd.reject({ path: 'FileProvider.deleteFile.trycactch', err: err.stack });
                err = undefined;
                session = undefined;
                nameLib = undefined;
                Files = undefined;
            }
        );
        return dfd.promise;
    }

    getField(req, validateSchema) {
        return FileInterface.getField(req, validateSchema);
    }

    uploadByBuffer(dbname_prefix, buffer, nameLib, username, filename, thePath, parentFolder){
        let dfd = q.defer();
        const filenameFormated = filename.replace(/\s/g, "_");
        FileInterface.upload(buffer, new Date().getTime(), nameLib, thePath, parentFolder, username, dbname_prefix, filenameFormated).then(function(fileNamed){
            dfd.resolve({
                nameLib,
                named: fileNamed,
                filename,
                type: "local",
                timePath: ""
            });
        }, function(err){
            dfd.reject(err);
        });
        return dfd.promise;
    }

    download(url) {
        // Get presigned download URL from MinIO
        return minioProvider.loadFile(url);
    }

    downloadBuffer(filename) {
        return FileInterface.downloadMinIOBuffer(filename);
    }

    getAllFilesFromRequest(request) {
        return FileInterface.getAllFilesFromRequest(request);
    }

    makeFilePublic(filePath) {
        // MinIO presigned URL (24 hours)
        return minioProvider.loadFile(filePath, 24 * 60 * 60);
    }

    viewFile(dbname_prefix, session, nameLib, nameFile, timePath, locate, folder, userName) {
        let dfd = q.defer();
        
        // Build file path
        let folderPath;
        if (Array.isArray(folder)) {
            const normalizedFolderArray = folder.map(function(f) {
                return f.replace(/^\/+|\/+$/g, '');
            }).filter(function(f) {
                return f.length > 0;
            });
            folderPath = normalizedFolderArray.join('/');
        } else {
            folderPath = (folder || '').replace(/^\/+|\/+$/g, '');
        }

        const cleanNameLib = (nameLib || '').replace(/^\/+|\/+$/g, '');
        const cleanUserName = (userName || '').replace(/^\/+|\/+$/g, '');

        let pathBucket = dbname_prefix;
        if (folderPath) {
            pathBucket += '/' + folderPath;
        }
        if (cleanNameLib) {
            pathBucket += '/' + cleanNameLib;
        }
        if (cleanUserName) {
            pathBucket += '/' + cleanUserName;
        }
        pathBucket += '/' + nameFile;

        // Get presigned view URL from MinIO (inline display)
        minioProvider.viewFile(pathBucket).then((url) => {
            dfd.resolve({
                type: 'local',
                url: url,
            });
        }).catch((err) => {
            dfd.reject(err);
        });

        return dfd.promise;
    }
}

exports.FileProvider = new FileProvider();