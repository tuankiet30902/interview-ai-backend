const { MongoDBProvider } = require('../../../shared/mongodb/db.provider');

const { FileProvider } = require('../../../shared/file/file.provider');
const settings = require('../../../utils/setting');

const { FileConst } = require('../../../shared/file/file.const');
const q = require('q');

const SESSION_CONST = {};
const FOLDER_CONST = ['management'];

function generateConfigFileSetting(dbname_prefix, settingObject) {
    let dfd = q.defer();
    const imagesKeyArray = ['logo', 'backgroundLogin', 'background'];
    if (imagesKeyArray.indexOf(settingObject.key) === -1) {
        dfd.resolve(settingObject);
    } else {
        if(settingObject.value.name){

            FileProvider.loadFile(dbname_prefix, SESSION_CONST, settingObject.value.nameLib, settingObject.value.name, settingObject.value.timePath, settingObject.value.locate || 'local', FOLDER_CONST, undefined).then((fileObject) => {
                settingObject.value.urlDisplay = fileObject.url;
                dfd.resolve(settingObject);
            }, (err) => {
                dfd.reject(err);
            });
        }else{
            switch(settingObject.key){
                case 'logo':
                    settingObject.value.urlDisplay = settings.imageDefault.logo;
                    dfd.resolve(settingObject);
                    break;
                case 'backgroundLogin':
                    settingObject.value.urlDisplay = settings.imageDefault.backgroundLogin;
                    dfd.resolve(settingObject);
                    break;
                case 'background':
                    settingObject.value.urlDisplay = settings.imageDefault.background;
                    dfd.resolve(settingObject);
                    break;
                default:
                    settingObject.value.urlDisplay = settings.imageDefault.logo;
                    dfd.resolve(settingObject);
                    break;
            }
        }
    }
    return dfd.promise;
}

class SetupService {
    constructor() { }

    load_setting(dbname_prefix) {
        let dfd = q.defer();
        MongoDBProvider.loadMain(dbname_prefix, "setting", {}).then(function (data) {
            let dfdArray = [];
            for (var i in data) {
                dfdArray.push(generateConfigFileSetting(dbname_prefix, data[i]));
            }
            q.all(dfdArray).then((result) => {
                result.push({
                    key: 'user_manual_document',
                    value: settings.videoUserManual.document,
                })
                dfd.resolve(result);

            }, (err) => {
                dfd.reject(err);

            })
        }, function (err) {
            dfd.reject(err);
        });
        return dfd.promise;
    }

}

exports.SetupService = new SetupService();