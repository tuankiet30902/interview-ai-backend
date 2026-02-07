const q = require('q');
const { FileProvider } = require('./file.provider');

class FileLimitation {
    constructor() {}

    checkFilesExceedLimit(req) {
        let dfd = q.defer();

        FileProvider.getAllFilesFromRequest(req)
        .then((allFiles) => {
            //console.log(allFiles);

            // 25 MB in bytes
            const MAX_FILE_SIZE = 25 * 1024 * 1024;
            const oversizedFile = allFiles.find(file => file.buffer.length > MAX_FILE_SIZE);

            if (oversizedFile) {
                dfd.reject({ 
                    message: `${oversizedFile.fileName} has exceed file limit`
                });
            } else {
                dfd.resolve();
            }
        })
        .catch((err) => {
            dfd.reject({ err: err });
        });

        return dfd.promise;
    }
}

exports.FileLimitation = new FileLimitation();