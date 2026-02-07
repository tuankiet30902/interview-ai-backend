

const q = require('q');
const { SetupService } = require('./setup.service');
const { LanguageProvider } = require('../../../shared/localization/language.provider');

class SetupController {
    constructor() { }

    loadLanguage(body) {
        let dfd = q.defer();
        let dfdAr = [];
        dfdAr.push(LanguageProvider.getCurrentLanguage(body._service[0].dbname_prefix));
        dfdAr.push(LanguageProvider.getLanguageList(body._service[0].dbname_prefix));
        q.all(dfdAr).then(function (data) {
            LanguageProvider.getLanguageDetails(body._service[0].dbname_prefix,data[0]).then(function (details) {
                dfd.resolve({
                    current: data[0],
                    list: data[1],
                    details
                });
                data = undefined;
                details = undefined;

            }, function (err) {
                dfd.reject(err);
                err = undefined;
                data = undefined;
            });
            dfdAr = undefined;
        }, function (err) {
            dfd.reject(err);
            err = undefined;
        });
        return dfd.promise;
    }

    init(body) {
        let dfd = q.defer();
        let dfdAr = [];
        let obj = new SetupController();
        dfdAr.push(obj.loadLanguage(body));
        dfdAr.push(SetupService.load_setting(body._service[0].dbname_prefix));
        q.all(dfdAr).then(function (data) {
            let result = {
                language: data[0],
                setting: data[1]
            };
            dfd.resolve(result);
            result = undefined;
            dfdAr = undefined;
            obj = undefined;
            data = undefined;
        }, function (err) {
            dfd.reject(err);
            result = undefined;
            dfdAr = undefined;
            obj = undefined;
            data = undefined;
        });

        return dfd.promise;
    }
}

exports.SetupController = new SetupController();