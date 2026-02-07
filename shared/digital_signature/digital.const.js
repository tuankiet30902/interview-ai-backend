const settings = require('../../utils/setting');
const {
    TENANT_DOMAIN,
    MODE_PRODUCTION
} = process.env;

exports.DigitalConst = {
    pathLocal: (function(){
        let myDirname = __dirname;
        let splitPath; 
        if(MODE_PRODUCTION =="production"){
            splitPath = myDirname.split('/');
        }else{
            splitPath = myDirname.split('\\');
        }
        let uploadPath = "";
        for (var i = 0; i < splitPath.length;i++ ){

            if(splitPath[i] === settings.folderName){
                break;
            }else{
                uploadPath += splitPath[i] + "/";
            }
            
        }
        uploadPath += "tenant_uploads";
        return uploadPath;
    })(),
    tenantDomain: TENANT_DOMAIN
}