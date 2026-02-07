const  q  = require('q');
const trycatch = require('trycatch');
const {AuthenticationProvider} = require('../authentication/authentication.provider');
class ControllerProvider{
    constructor(){}
    reconstruct(func){
        let dfd  = q.defer();
            func().then(function(data){
                dfd.resolve({data:AuthenticationProvider.encrypt_lv1(data)});
            },function(err){
                if (err.mes){
                    err.mes = AuthenticationProvider.encrypt_lv1(err.mes);
                }
                dfd.reject(err);
            });

        return dfd.promise;
    }
}

exports.ControllerProvider = new ControllerProvider();