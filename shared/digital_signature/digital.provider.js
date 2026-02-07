const { DigitalInterface } = require('./digital.interface');
const q = require('q');
const { DigitalConst } = require('./digital.const');
const fs = require('fs');

class DigitalProvider {
    constructor() { }
    //a digital signature includes: key pair, pfx file, cert file.
    generateDigital(tenant, username, fullName, email, organizationName, organizationalUnit, country, state, locality, competence_title, nationalID, uniqueIdentifier,
        password
    ) {
        const defaultUserInfo = {
            fullName,
            email,
            organizationName,
            organizationalUnit,
            country,
            state,
            locality,
            title: competence_title,
            nationalID,
            uniqueIdentifier,
            keyUsage: 'digitalSignature',
            validityPeriod: '1 year'
        };
        const keys = DigitalInterface.generateKeyPair(defaultUserInfo);
        const pfxPath = `${DigitalConst.pathLocal}/digital_signature/${tenant}/${username}/${uniqueIdentifier}.pfx`;
        const certPath = `${DigitalConst.pathLocal}/digital_signature/${tenant}/${username}/${uniqueIdentifier}.crt`;
        DigitalInterface.createPfx(fullName, country, state, locality, organizationName, organizationalUnit, email, password, pfxPath, keys);
        DigitalInterface.extractCertFromPfx(pfxPath, password, certPath);
        return {
            pfxPath: `/digital_signature/${tenant}/${username}/${uniqueIdentifier}.pfx`,
            certPath: `/digital_signature/${tenant}/${username}/${uniqueIdentifier}.crt`,
            keys
        }
    }

    signPDF(pdfPath, pfxPath,pdfBuf,pfxBuf, outputPath, password, reason, email, full_name, country, state, locality, address) {
        let dfd = q.defer();
        let pdfBuffer, pfxBuffer;
        if(pdfPath){
            pdfBuffer = fs.readFileSync(pdfPath);
        }else{
            pdfBuffer = pdfBuf;
        }

        if(pfxPath){
            pfxBuffer = fs.readFileSync(pfxPath);
        }else{
            pfxBuffer = pfxBuf;
        }

        DigitalInterface.sign(pdfBuffer, pfxBuffer, outputPath, password, reason, email, full_name,
            `${address}, ${locality}, ${state}, ${country}`).then(function () {
                dfd.resolve(outputPath);
            }, function (err) {
                dfd.reject(err);
            })
        return dfd.promise;
    }

    async insertImageAndSign(imageBuffer,pdfBuffer,sign_tag,pfxPath,outputPath,password, reason, email, full_name, country, state, locality, address){
        let dfd  = q.defer();
        
        const  {buffer,dimension} =  await DigitalInterface.findTextAndInsertImage(pdfBuffer,imageBuffer,sign_tag);
        
        let pfxBuffer = fs.readFileSync(pfxPath);
        
        DigitalInterface.sign(pdfBuffer,imageBuffer,outputPath,dimension).then(function () {
                
                dfd.resolve(outputPath);
            }, function (err) {
                // console.log(err)
                dfd.reject(err);
            })
  
        return dfd.promise;
    }
}

exports.DigitalProvider = new DigitalProvider();