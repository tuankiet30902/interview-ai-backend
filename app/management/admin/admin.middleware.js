const jwt = require('jsonwebtoken');
const { AuthenticationProvider } = require('../../../shared/authentication/authentication.provider');
const { JWTOptions } = require('../../../shared/authentication/authentication.const');
const { ConfigSetup } = require('../../../shared/setup/config.const');
const { statusHTTP, messageHTTP } = require('../../../utils/setting');

/**
 * Middleware to verify admin authentication token
 * Similar to SessionProvider.match but for admin (doesn't load session from user collection)
 * Supports both jwtSecret and jwtSecret_onHost
 */
function verifyAdminToken(req, res, next) {
    req.body = req.body || {};
    
    if (req.headers &&
        req.headers.authorization &&
        req.headers.authorization.split(' ')[0] === 'DTTOKEN') {
        
        let jwtToken = req.headers.authorization.split(' ')[1];
        // Try both secrets (admin might use jwtSecret_onHost if separateTenantFrontend is true)
        let secrets = [JWTOptions.jwtSecret];
        if (ConfigSetup.system.separateTenantFrontend && JWTOptions.jwtSecret_onHost) {
            secrets.push(JWTOptions.jwtSecret_onHost);
        }
        
        let verified = false;
        let payload = null;
        
        // Try each secret
        for (let i = 0; i < secrets.length; i++) {
            try {
                payload = jwt.verify(jwtToken, secrets[i]);
                verified = true;
                break;
            } catch (err) {
                // Continue to next secret
                if (i === secrets.length - 1) {
                    // Last secret failed
                    res.status(statusHTTP.authorized);
                    res.send({ mes: messageHTTP.authorized });
                    res.end();
                    return;
                }
            }
        }
        
        if (verified && payload) {
            try {
                let obj = new AuthenticationProvider();
                let data = obj.decrypt_lv1(payload.data);
                req.body.username = data.username;
                next();
                return;
            } catch (err) {
                res.status(statusHTTP.authorized);
                res.send({ mes: messageHTTP.authorized });
                res.end();
                return;
            }
        } else {
            res.status(statusHTTP.authorized);
            res.send({ mes: messageHTTP.authorized });
            res.end();
            return;
        }
    } else {
        res.status(statusHTTP.authorized);
        res.send({ mes: messageHTTP.authorized });
        res.end();
        return;
    }
}

module.exports = {
    verifyAdminToken: verifyAdminToken
};

