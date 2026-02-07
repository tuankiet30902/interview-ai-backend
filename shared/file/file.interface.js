const os = require('os');
const path = require('path');
const { randomFillSync } = require('crypto');
const Buffer = require('buffer').Buffer;

const Busboy = require('busboy');
const { FileConst } = require('./file.const');
const { ValidationProvider } = require('../validation/validation.provider');
const trycatch = require('trycatch');
const q = require('q');
const fs = require('fs-extra');
const { LogProvider } = require('../log_nohierarchy/log.provider');
const { minioProvider } = require('../store/minio/minio.provider');

function convertFileStreamToBuffer(stream) {
    return new Promise(function (resolve, reject) {
        let chunks = [];
        stream.on('data', function (chunk) {
            chunks.push(chunk);
        });

        stream.on('end', function () {
            resolve(Buffer.concat(chunks));
        });

        stream.on('error', function (error) {
            reject(error);
        });
    });
}

function handleUploadFileToMinIO(stream, filePath, mimetype) {
    const dfd = q.defer();    
    convertFileStreamToBuffer(stream)
        .then(function (buffer) {
            return minioProvider.createFile(buffer, filePath, mimetype);
        })
        .then(function () {
            dfd.resolve();
        })
        .catch(function(err) {
            console.error('Error uploading to MinIO:', err);
            dfd.reject(err);
        });
    
    return dfd.promise;
}

class FileInterface {
    constructor() { }

    analyze(req, timePath, timeName, validateSchema, nameLib, thePath, folderName, userName, dbNamePrfix) {
        let dfd = q.defer();
        trycatch(function () {
            let busboy = new Busboy({ headers: req.headers, highWaterMark: FileConst.highWaterMark });
            let Files = [];
            let fileInfo = {};
            let count = 0;
            let Fields = {};
            let formData = new Map();
            let fieldAr = [];
            let filePromises = [];
            
            busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
                fileInfo[fieldname] = fileInfo[fieldname] || [];
                if (filename.length > 0) {
                    if (FileConst.fileMime.indexOf(mimetype) === -1) {
                        file.resume();
                    } else {
                        count++;
                        
                        // Get username: first try userName parameter, then formData Map, then req.body
                        let actualUsername = (userName && userName.trim()) ? userName : '';
                        if (!actualUsername && formData.has('username')) {
                            actualUsername = formData.get('username');
                        }
                        if (!actualUsername && req.body && req.body.username) {
                            actualUsername = req.body.username;
                        }
                        if (!actualUsername) {
                            actualUsername = 'system';
                        }
                        
                        var named = filename.substring(0, filename.length - filename.split(".")[filename.split(".").length - 1].length - 1) + "_" + actualUsername + timeName + count + '.' + filename.split(".")[filename.split(".").length - 1];
                        
                        // Construct folderPath
                        let normalizedThePath = (thePath || '').replace(/^\/+|\/+$/g, '');
                        let cleanNameLib = (nameLib || '').replace(/^\/+|\/+$/g, '');
                        let cleanUserName = (actualUsername || '').replace(/^\/+|\/+$/g, '');
                        let cleanFolderName = (folderName || '').replace(/^\/+|\/+$/g, '');
                        
                        let folderPath = dbNamePrfix + '/' + cleanFolderName;
                        if (normalizedThePath) {
                            folderPath += '/' + normalizedThePath;
                        }
                        if (cleanNameLib) {
                            folderPath += '/' + cleanNameLib;
                        }
                        if (cleanUserName) {
                            folderPath += '/' + cleanUserName;
                        }

                        let fileSize = 0;
                        if (folderPath.charAt(folderPath.length - 1) === '/')
                            folderPath = folderPath.slice(0, folderPath.length - 1);

                        Files.push({
                            filename,
                            timePath,
                            named,
                            data: [],
                            type: "local",
                            folderPath
                        });
                        fileInfo[fieldname].push({
                            filename,
                            timePath,
                            named,
                            data: [],
                            type: "local",
                            folderPath
                        });
                        
                        const folder = folderPath + '/' + named;
                        let promise = handleUploadFileToMinIO(file, folder, mimetype).catch(function(err) {
                            throw err;
                        });
                        filePromises.push(promise);

                        file.on('limit', function () {
                            for (let i in Files) {
                                if (Files[i].fieldname === filename && !Files[i].huge) {
                                    Files[i].huge = true;
                                    break;
                                }
                            }
                            for (let i in fileInfo[fieldname]) {
                                if (fileInfo[fieldname][i].fieldname === filename && !fileInfo[fieldname][i].huge) {
                                    fileInfo[fieldname][i].huge = true;
                                    break;
                                }
                            }
                        });

                        file.on('data', function (data) {
                            fileSize += data.length;
                            for (let i in Files) {
                                if (Files[i].filename === filename && !Files[i].huge) {
                                    Files[i].data.push(data);
                                    Files[i].fileSize = fileSize;
                                    break;
                                }
                            }
                            for (let i in fileInfo[fieldname]) {
                                if (fileInfo[fieldname][i].filename === filename && !fileInfo[fieldname][i].huge) {
                                    fileInfo[fieldname][i].data.push(data);
                                    fileInfo[fieldname][i].fileSize = fileSize;
                                    break;
                                }
                            }
                        });
                    }
                } else {
                    file.resume();
                }
            });

            busboy.on('field', function (fieldname, val) {
                formData.set(fieldname, val);
                fieldAr.push(fieldname);
            });

            busboy.on('finish', function () {
                for (let i in fieldAr) {
                    Fields[fieldAr[i]] = formData.get(fieldAr[i]);
                }

                if (validateSchema !== undefined) {
                    let Joi = ValidationProvider.initModuleValidation();
                    let check = Joi.validate(Fields, validateSchema);
                    if (check.error) {
                        return dfd.reject({
                            path: 'FileInterface.getData.validate',
                            mes: check.error,
                        });
                    }
                }

                q.all(filePromises)
                    .then(function () {
                        dfd.resolve({ Fields, Files, fileInfo });
                    })
                    .catch(dfd.reject);
            });

            req.pipe(busboy);
            },
            function (err) {
                dfd.reject({ path: 'FileInterface.getData.trycatch', err: err.stack });
            }
        );
        return dfd.promise;
    }

    uploadAndGetBuffer(req, timePath, timeName, validateSchema, nameLib, thePath, folderName, userName, dbNamePrfix) {
        let dfd = q.defer();
        trycatch(function () {
            let busboy = new Busboy({ headers: req.headers, highWaterMark: FileConst.highWaterMark });
            let Files = [];
            let fileInfo = {};
            let count = 0;
            let Fields = {};
            let formData = new Map();
            let fieldAr = [];
            let filePromises = [];
            
            busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
                fileInfo[fieldname] = fileInfo[fieldname] || [];
                if (filename.length > 0) {
                    if (FileConst.fileMime.indexOf(mimetype) === -1) {
                        file.resume();
                    } else {
                        count++;
                        var named = filename.substring(0, filename.length - filename.split(".")[filename.split(".").length - 1].length - 1) + "_" + req.body.username + timeName + count + '.' + filename.split(".")[filename.split(".").length - 1];
                        let folderPath = dbNamePrfix + '/' + folderName + thePath + nameLib + userName;

                        let fileSize = 0;
                        let fileBuffer = [];
                        if (folderPath.charAt(folderPath.length - 1) === '/')
                            folderPath = folderPath.slice(0, folderPath.length - 1);

                        Files.push({
                            filename,
                            timePath,
                            named,
                            data: [],
                            type: "local",
                            folderPath
                        });
                        fileInfo[fieldname].push({
                            filename,
                            timePath,
                            named,
                            data: [],
                            type: "local",
                            folderPath
                        });
                        
                        const folder = folderPath + '/' + named;
                        let promise = handleUploadFileToMinIO(file, folder, mimetype);
                        filePromises.push(promise);

                        file.on('limit', function () {
                            for (let i in Files) {
                                if (Files[i].fieldname === filename && !Files[i].huge) {
                                    Files[i].huge = true;
                                    break;
                                }
                            }
                            for (let i in fileInfo[fieldname]) {
                                if (fileInfo[fieldname][i].fieldname === filename && !fileInfo[fieldname][i].huge) {
                                    fileInfo[fieldname][i].huge = true;
                                    break;
                                }
                            }
                        });

                        file.on('data', function (data) {
                            fileSize += data.length;
                            fileBuffer.push(data);
                        
                            for (let i in Files) {
                                if (Files[i].filename === filename && !Files[i].huge) {
                                    Files[i].fileSize = fileSize;
                                    break;
                                }
                            }
                            for (let i in fileInfo[fieldname]) {
                                if (fileInfo[fieldname][i].filename === filename && !fileInfo[fieldname][i].huge) {
                                    fileInfo[fieldname][i].fileSize = fileSize;
                                    break;
                                }
                            }
                        });
                        
                        file.on('end', function () {
                            let finalBuffer = Buffer.concat(fileBuffer);
                        
                            for (let i in Files) {
                                if (Files[i].filename === filename && !Files[i].huge) {
                                    Files[i].fileBuffer = finalBuffer;  
                                    break;
                                }
                            }
                            for (let i in fileInfo[fieldname]) {
                                if (fileInfo[fieldname][i].filename === filename && !fileInfo[fieldname][i].huge) {
                                    fileInfo[fieldname][i].fileBuffer = finalBuffer; 
                                    break;
                                }
                            }
                        });                      
                    }
                } else {
                    file.resume();
                }
            });

            busboy.on('field', function (fieldname, val) {
                formData.set(fieldname, val);
                fieldAr.push(fieldname);
            });

            busboy.on('finish', function () {
                for (let i in fieldAr) {
                    Fields[fieldAr[i]] = formData.get(fieldAr[i]);
                }

                if (validateSchema !== undefined) {
                    let Joi = ValidationProvider.initModuleValidation();
                    let check = Joi.validate(Fields, validateSchema);
                    if (check.error) {
                        return dfd.reject({
                            path: 'FileInterface.getData.validate',
                            mes: check.error,
                        });
                    }
                }

                q.all(filePromises)
                    .then(function () {
                        dfd.resolve({ Fields, Files, fileInfo });
                    })
                    .catch(dfd.reject);
            });

            req.pipe(busboy);
            },
            function (err) {
                dfd.reject({ path: 'FileInterface.getData.trycatch', err: err.stack });
            }
        );
        return dfd.promise;
    }

    getBufferUpload(req, validateSchema) {
        let dfd = q.defer();
        trycatch(
            function () {
                let busboy = new Busboy({ headers: req.headers, highWaterMark: FileConst.highWaterMark });
                let Files = [];
                let fileInfo = {};
                let formData = new Map();
                let fieldAr = [];
    
                busboy.on("file", function (fieldname, file, filename, encoding, mimetype) {
                    fileInfo[fieldname] = fileInfo[fieldname] || [];
                    if (filename.length > 0) {
                        if (FileConst.fileMime.indexOf(mimetype) === -1) {
                            file.resume();
                        } else {
                            let fileBuffer = [];
                            let fileSize = 0;
    
                            let fileData = {
                                filename,
                                mimetype,
                                encoding,
                                buffer: null,
                                fileSize: 0,
                            };
    
                            file.on("data", function (data) {
                                fileBuffer.push(data);
                                fileSize += data.length;
                            });
    
                            file.on("end", function () {
                                fileData.buffer = Buffer.concat(fileBuffer);
                                fileData.fileSize = fileSize;
                                Files.push(fileData);
                                fileInfo[fieldname].push(fileData);
                            });
                        }
                    } else {
                        file.resume();
                    }
                });
    
                busboy.on("field", function (fieldname, val) {
                    formData.set(fieldname, val);
                    fieldAr.push(fieldname);
                });
    
                busboy.on("finish", function () {
                    let Fields = {};
                    for (let i in fieldAr) {
                        Fields[fieldAr[i]] = formData.get(fieldAr[i]);
                    }
                    if (Fields.tableHeaders) {
                        try {
                            Fields.tableHeaders = JSON.parse(Fields.tableHeaders);
                        } catch (e) {
                            return dfd.reject({
                                path: "FileInterface.getData.parseJSON",
                                mes: "Invalid JSON format for tableHeaders",
                            });
                        }
                    }
                    if (Fields.forceSplit) {
                        Fields.forceSplit = Fields.forceSplit === "true";
                    }
                    req.body = Fields;
    
                    if (validateSchema !== undefined) {
                        let Joi = ValidationProvider.initModuleValidation();
                        let check = Joi.validate(Fields, validateSchema);
                        if (check.error) {
                            return dfd.reject({
                                path: "FileInterface.getData.validate",
                                mes: check.error,
                            });
                        }
                    }
    
                    dfd.resolve({ Fields, Files, fileInfo });
                });
    
                req.pipe(busboy);
            },
            function (err) {
                dfd.reject({ path: "FileInterface.getData.trycatch", err: err.stack });
            }
        );
        return dfd.promise;
    }

    upload(buffer, timeName, nameLib, thePath, folderName, username, dbNamePrfix, filename) {
        let dfd = q.defer();
        const newFolderName = folderName? folderName+'/':'';
        const newThePath = thePath? thePath+'/':'';
        const newNameLib = nameLib? nameLib+'/':'';
        const newUsername = username? username:'';

        let folderPath = dbNamePrfix + '/' + newFolderName + newThePath + newNameLib + newUsername;
        var named = filename.substring(0, filename.length - filename.split(".")[filename.split(".").length - 1].length - 1) + "_" + username + timeName + '.' + filename.split(".")[filename.split(".").length - 1];
        const folder = folderPath + '/' + named;
        
        // Detect mimetype from filename
        let mimetype = 'application/octet-stream';
        const ext = filename.split('.').pop().toLowerCase();
        if (ext === 'docx') mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        else if (ext === 'xlsx') mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        else if (ext === 'pdf') mimetype = 'application/pdf';

        // Upload to MinIO
        minioProvider.createFile(buffer, folder, mimetype)
            .then(() => {
                dfd.resolve(named);
            })
            .catch((err) => {
                dfd.reject({ path: "FileInterface.upload.minio", err });
            });

        return dfd.promise;
    }

    getField(req, validateSchema) {
        let dfd = q.defer();
        trycatch(function () {
            let busboy = new Busboy({ headers: req.headers, highWaterMark: FileConst.highWaterMark });
            let Fields = {};
            let fieldAr = [];
            let formData = new Map();

            busboy.on('field', function (fieldname, val) {
                formData.set(fieldname, val);
                fieldAr.push(fieldname);
            });

            busboy.on('finish', function () {
                for (let i in fieldAr) {
                    Fields[fieldAr[i]] = formData.get(fieldAr[i]);
                }

                if (validateSchema !== undefined) {
                    let Joi = ValidationProvider.initModuleValidation();
                    let check = Joi.validate(Fields, validateSchema);
                    if (check.error) {
                        dfd.reject({ path: "FileInterface.getData.validate", mes: check.error });
                    } else {
                        dfd.resolve({ Fields });
                    }
                } else {
                    dfd.resolve({ Fields });
                }
            });
            req.pipe(busboy);
        }, function (err) {
            dfd.reject({ path: "FileInterface.getField.trycatch", err: err.stack });
            err = undefined;
        });
        return dfd.promise;
    }

    delete(filePath) {
        let dfd = q.defer();
        
        // Delete from MinIO
        minioProvider.deleteFile(filePath)
            .then(() => {
                dfd.resolve(filePath);
            })
            .catch((err) => {
                dfd.reject({ path: "FileInterface.delete.minio", err });
            });

        return dfd.promise;
    }

    download(fileName) {
        let dfd = q.defer();
        
        // Download from MinIO
        minioProvider.downloadBuffer(fileName)
            .then((buffer) => {
                dfd.resolve(buffer);
            })
            .catch((err) => {
                dfd.reject({ path: 'FileInterface.download.minio', err });
            });
            
        return dfd.promise;
    }

    downloadMinIOBuffer(filename) {
        let dfd = q.defer();
        
        minioProvider.downloadBuffer(filename)
            .then(buffer => {
                dfd.resolve(buffer);
            })
            .catch(err => {
                dfd.reject(err); 
            });
            
        return dfd.promise;
    }

    getAllFilesFromRequest(request) {
        const dfd = q.defer();
        trycatch(
            function () {
                const filePromises = [];
                const busboy = new Busboy({
                    headers: request.headers,
                    highWaterMark: FileConst.highWaterMark,
                });

                busboy.on('file', function (fieldName, binary, fileName, encoding, mimetype) {
                    if (FileConst.fileMime.indexOf(mimetype) === -1) {
                        LogProvider.debug("Not support file with mime: %s", mimetype);
                        binary.resume();
                        return;
                    }

                    LogProvider.info(`Found file with mime: ${mimetype}`);
                    const filePromise = new Promise(function(resolve, reject) {
                        convertFileStreamToBuffer(binary)
                            .then(function (buffer) {
                                resolve({
                                    fieldName,
                                    fileName,
                                    encoding,
                                    mimetype,
                                    buffer,
                                });
                            })
                            .catch(reject)
                    })
                    filePromises.push(filePromise);
                });

                busboy.on('finish', function () {
                    q.all(filePromises).then(dfd.resolve).catch(dfd.reject);
                });

                request.pipe(busboy);
            },
            function (error) {
                dfd.reject({ path: "FileInterface.getAllFilesFromRequest.trycatch", err: error.stack });
            }
        );
        return dfd.promise;
    }
}

exports.FileInterface = new FileInterface();