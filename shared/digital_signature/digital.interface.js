
const NodeRSA = require('node-rsa');
const fs = require('fs');
const forge = require('node-forge');

var plainAddPlaceholder = require('@signpdf/placeholder-plain').plainAddPlaceholder;
// var plainAddPlaceholder = require('@signpdf/placeholder-pdf-lib').pdflibAddPlaceholder;
var signpdf = require('@signpdf/signpdf').default;
var P12Signer = require('@signpdf/signer-p12').P12Signer;
const q = require('q');

const { PDFDocument } = require('pdf-lib');
const { PDFExtract } = require('pdf.js-extract');

const { HTTPRequestProvider } = require("../httpRequest/http.provider");


// Tổng hợp các bước ( chỉ mới tạo ra chữ ký và ký nhiều chữ ký trên 1 file, chưa thêm hình chữ ký vào)
// 1) tạo cặp key
// 2) tạo file pfx từ key
// 3) tạo cert từ pfx 
// 4) ký bằng pfx 


class DigitalInterface {
    constructor() { }

    generateKeyPair(userInfo) {
        const key = new NodeRSA({ b: 2048 });
        return {
            publicKey: key.exportKey('public'),
            privateKey: key.exportKey('private'),
            userInfo
        };
    }

    createPfx(
        commonName,
        countryName,
        stateOrProvinceName,
        localityName,
        organizationName,
        organizationalUnitName,
        emailAddress,
        password,
        outputPath,
        keys //  keys.publicKey keys.privateKey
    ) {
        // Tạo chứng chỉ
        const cert = forge.pki.createCertificate();
        cert.publicKey = keys.publicKey;
        cert.serialNumber = '01';
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

        const attrs = [{
            name: 'commonName',
            value: commonName
        }, {
            name: 'countryName',
            value: countryName
        }, {
            shortName: 'ST',
            value: stateOrProvinceName
        }, {
            name: 'localityName',
            value: localityName
        }, {
            name: 'organizationName',
            value: organizationName
        }, {
            shortName: 'OU',
            value: organizationalUnitName
        }];

        if (emailAddress) {
            attrs.push({
                name: "emailAddress",
                value: emailAddress
            });
        }

        cert.setSubject(attrs);
        cert.setIssuer(attrs);

        // Thiết lập các thuộc tính mở rộng
        cert.setExtensions([{
            name: 'basicConstraints',
            cA: true
        }, {
            name: 'keyUsage',
            keyCertSign: true,
            digitalSignature: true,
            nonRepudiation: true,
            keyEncipherment: true,
            dataEncipherment: true
        }, {
            name: 'extKeyUsage',
            serverAuth: true,
            clientAuth: true,
            codeSigning: true,
            emailProtection: true,
            timeStamping: true
        }, {
            name: 'nsCertType',
            client: true,
            server: true,
            email: true,
            objsign: true,
            sslCA: true,
            emailCA: true,
            objCA: true
        }, {
            name: 'subjectAltName',
            altNames: [{
                type: 6, // URI
                value: 'http://example.org/webid#me'
            }, {
                type: 7, // IP
                ip: '127.0.0.1'
            }]
        }]);

        // Tự ký chứng chỉ
        cert.sign(keys.privateKey, forge.md.sha256.create());

        // Tạo PKCS12 (PFX)
        const pkcs12Asn1 = forge.pkcs12.toPkcs12Asn1(
            keys.privateKey,
            cert,
            password,
            {
                friendlyName: 'My Self-Signed Certificate',
                generateLocalKeyId: true,
                algorithm: '3des'
            }
        );

        const pkcs12Der = forge.asn1.toDer(pkcs12Asn1).getBytes();

        // Ghi file PFX
        fs.writeFileSync(outputPath, Buffer.from(pkcs12Der, 'binary'));

        console.log(`File PFX created in folder: ${outputPath}`);
    }

    extractCertFromPfx(pfxPath, pfxPassword, outputPath) {
        // Đọc file PFX
        const pfxDer = fs.readFileSync(pfxPath);
        const pfxAsn1 = forge.asn1.fromDer(pfxDer.toString('binary'));

        // Giải mã PKCS#12 (PFX)
        const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, pfxPassword);

        // Lấy chứng chỉ
        const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
        const cert = certBags[forge.pki.oids.certBag][0].cert;

        // Chuyển đổi chứng chỉ sang PEM
        const pemCert = forge.pki.certificateToPem(cert);

        // Ghi ra file
        fs.writeFileSync(outputPath, pemCert);

        console.log(`Certificate extracted and saved to ${outputPath}`);
    }

    signInternal(pdfBuffer, certificateBuffer, targetPath, password, reason, contactInfo, name, location, dimension) {
        let dfd = q.defer();

        var pdfWithPlaceholder = plainAddPlaceholder({
            pdfBuffer: pdfBuffer,
            reason,
            contactInfo,
            name,
            location,
            widgetRect: [dimension.x, dimension.y, dimension.width, dimension.height],
            page: dimension.page
        });

        var signer = new P12Signer(certificateBuffer, {
            passphrase: password,
            asn1StrictParsing: true,
            reason,
            contactInfo,
            location
        });


        try {
            signpdf
                .sign(pdfWithPlaceholder, signer)
                .then(function (signedPdf) {

                    // signedPdf is a Buffer of an electronically signed PDF. Store it.

                    fs.writeFileSync(targetPath, signedPdf);

                    dfd.resolve(true);
                })
        } catch (error) {
            console.log(error);
        }

        return dfd.promise;
    }

    sign(pdfBuffer, signImageBuffer, targetPath, dimension) {
        const PdfBase64 = pdfBuffer.toString('base64');
        const RecImgBase64 = signImageBuffer.toString('base64');
        const dimensionRounded = {
            x : Math.round(dimension.x),
            y : Math.round(dimension.y),
            width : Math.round(dimension.width),
            height: Math.round(dimension.height)
        };
        let dfd = q.defer();
        HTTPRequestProvider.post("https://demo-api-signcloud.matbao.in/signing-matbaoca/signature-pdf", {
            Page: dimension.page,
            X: dimensionRounded.x,
            Y: dimensionRounded.y,
            RecWidth: dimensionRounded.width,
            RecHeight: dimensionRounded.height,
            RecImgBase64,
            PdfBase64
        }, {
            headers: {
                rejectUnauthorized: false,
                timeout: 30000, // Tăng timeout lên 30 giây
                maxContentLength: Infinity, // Cho phép gửi dữ liệu lớn
                maxBodyLength: Infinity,
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1bmlxdWVfbmFtZSI6IjAzMDI3MTI1NzEtOTk5IiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy91c2VyZGF0YSI6IntcImlkXCI6MSxcInRheGNvZGVcIjpcIjAzMDI3MTI1NzEtOTk5XCIsXCJjZXJ0X3BhdGhcIjpcIkM6XFxcXFNlY3VyaXR5XFxcXE1hdEJhby1DQS1TaWduRmlsZVxcXFwwMzAyNzEyNTcxLTk5OV9vR0VsU1ZjUC5wMTJcIixcImNlcnRfcGFzc3dvcmRcIjpcIm9HRWxTVmNQXCJ9IiwibmJmIjoxNzI2ODM1Mzg2LCJleHAiOjE3MjY4MzY1ODYsImlhdCI6MTcyNjgzNTM4Nn0.ykz-U_zJPZQqeVVUSA1Vrqtr6ss4ya1MHR0cOzOqftU"
            }
        }).then(function (data) {
            const fileBuffer = Buffer.from(data.data.Data, 'base64');
            fs.writeFile(targetPath, fileBuffer, (err) => {
                if (err) {
                    console.log(err);
                    dfd.reject(err);
                } else {
                    dfd.resolve(targetPath);
                }
            });
        }, function (err) {
            dfd.reject(err);
            console.log(err.response);
        });
        return dfd.promise;
    }


    async findTextAndInsertImage(pdfBuffer, imageBuffer, searchText) {

        const pdfExtract = new PDFExtract();
        const extractOptions = {}; // Tùy chọn mặc định

        // Trích xuất text từ PDF
        const data = await pdfExtract.extractBuffer(pdfBuffer, extractOptions);

        let targetPage, targetX, targetY;

        // Tìm kiếm text trong các trang đã trích xuất
        for (let i = 0; i < data.pages.length; i++) {
            const page = data.pages[i];
            for (const item of page.content) {
                if (item.str.includes(searchText)) {
                    targetPage = i;
                    targetX = item.x;
                    targetY = item.y;
                    break;
                }
            }
            if (targetPage !== undefined) break;
        }

        if (targetPage === undefined) {
            console.log('Không tìm thấy text trong PDF.');
            return null;
        }

        // Load PDF document với pdf-lib để chỉnh sửa
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const pages = pdfDoc.getPages();
        const page = pages[targetPage];

        // Nhúng hình ảnh
        const image = await pdfDoc.embedPng(imageBuffer);

        // Kích thước hình ảnh
        const imageWidth = 100;
        const imageHeight = 50;

        // Điều chỉnh vị trí Y do hệ tọa độ khác nhau giữa pdf.js-extract và pdf-lib
        const { height , width } = page.getSize();
        const adjustedY = height - targetY - imageHeight +14;
   
        
        const adjustedX = width - targetX + imageWidth - 55;

        // Chèn hình ảnh
        page.drawImage(image, {
            x: adjustedX,
            y: adjustedY,
            width: imageWidth,
            height: imageHeight,
        });

        // Lưu PDF đã chỉnh sửa
        const pdfBytes = await pdfDoc.save();

        return {
            buffer: Buffer.from(pdfBytes),
            dimension: { x: adjustedX, y: adjustedY, width: imageWidth, height: imageHeight, page: targetPage + 1 }
        };

    }
}

exports.DigitalInterface = new DigitalInterface();