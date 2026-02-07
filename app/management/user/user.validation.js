const { ValidationProvider } = require('../../../shared/validation/validation.provider');
const Joi = ValidationProvider.initModuleValidation();
var validation = {};

validation.login = function (req, res, next) {
    const schema_body = {
        data: Joi.object().keys({
            username: Joi.string().optional(), // Optional: can use email instead
            email: Joi.string().email().optional(), // Optional: can use username instead
            password: Joi.string().required(),
            remember: Joi.boolean().optional()
        }).or('username', 'email').required() // At least one of username or email is required
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.setup_mfa = function (req, res, next) {
    const schema_body = {
        data: Joi.object().keys({
            username: Joi.string().alphanum().lowercase().required(),
            password: Joi.string().required()
        }).required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.verify_mfa = function (req, res, next) {
    const schema_body = {
        data: Joi.object().keys({
            username: Joi.string().alphanum().lowercase().required(),
            password: Joi.string().required(),
            token_mfa: Joi.string().required(),
            remember: Joi.boolean().required()
        }).required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.refreshToken = function (req, res, next) {
    const schema_body = {
        refreshToken: Joi.string().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.changePassword = function (req, res, next) {
    const schema_body = {
        password: Joi.string().required(),
        newpassword: Joi.string().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.changeLanguage = function (req, res, next) {
    const schema_body = {
        key: Joi.string().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.changeTheme = function (req, res, next) {
    const schema_body = {
        theme: Joi.string().valid('light', 'dark').required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}


validation.register = function (req, res, next) {
    const schema_body = {
        title: Joi.string().required(),
        account: Joi.string().alphanum().required(),
        password: Joi.string().required(),
        language: Joi.string(),
        isactive: Joi.boolean(),
        department: Joi.string().allow('', null).optional()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.registerPublic = function (req, res, next) {
    const schema_body = {
        email: Joi.string().email().required(),
        name: Joi.string().allow('', null),
        password: Joi.string().min(8).required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.getGoogleAuthUrl = function (req, res, next) {
    // No body validation needed for GET request
    ValidationProvider.createMiddleware({}, req, res, next);
}

validation.loginWithGoogle = function (req, res, next) {
    const schema_body = {
        code: Joi.string().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.loginWithApple = function (req, res, next) {
    const schema_body = {
        identityToken: Joi.string().required(),
        authorizationCode: Joi.string().required(),
        email: Joi.string().email().allow(null, ''),
        displayName: Joi.string().allow(null, ''),
        nonce: Joi.string().allow(null, '')
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.load_for_add_friend = function (req, res, next) {
    const schema_body = {
        search: Joi.string().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.load = function (req, res, next) {
    const schema_body = {
        search: Joi.string(),
        isactive: Joi.boolean(),
        top: Joi.number().required(),
        offset: Joi.number().required(),
        sort: Joi.object().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.load_for_pick_user_directive = function (req, res, next) {
    const schema_body = {
        search: Joi.string(),
        department: Joi.string().required(),
        top: Joi.number().required(),
        offset: Joi.number().required(),
        sort: Joi.object().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.loadForDirective = function (req, res, next) {
    const schema_body = {
        account: Joi.string().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.loadDetails = function (req, res, next) {
    const schema_body = {
        account: Joi.string().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.count = function (req, res, next) {
    const schema_body = {
        search: Joi.string(),
        isactive: Joi.boolean()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.count_for_pick_user_directive = function (req, res, next) {
    const schema_body = {
        search: Joi.string(),
        department: Joi.string().required(),
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.checkexist = function (req, res, next) {
    const schema_body = {
        account: Joi.string().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.update = function (req, res, next) {
    const schema_body = {
        id: Joi.string().required(),
        title: Joi.string(),
        isactive: Joi.boolean().required(),
        role: Joi.array().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.reset_password = function (req, res, next) {
    const schema_body = {
        account: Joi.string().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.pushRule = function (req, res, next) {
    const schema_body = {
        id: Joi.string().required(),
        rule: Joi.object({
            rule: Joi.string().required(),
            details: Joi.object()
        }).required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.removeRule = function (req, res, next) {
    const schema_body = {
        id: Joi.string().required(),
        rule: Joi.object({
            rule: Joi.string().required(),
            details: Joi.object()
        }).required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}




validation.delete = function (req, res, next) {
    const schema_body = {
        id: Joi.string().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.deleteAccount = function (req, res, next) {
    // No validation needed - user is authenticated via middleware
    next();
}


validation.loadByRole = function (req, res, next) {
    const schema_body = {
        role: Joi.string()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.sendVerificationCode = function (req, res, next) {
    const schema_body = {
        data: Joi.object().keys({
            email: Joi.string().email().required()
        }).required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.verifyCode = function (req, res, next) {
    const schema_body = {
        data: Joi.object().keys({
            email: Joi.string().email().required(),
            code: Joi.string().regex(/^\d{4}$/).required().options({
                language: {
                    string: {
                        regex: {
                            base: 'Code must be exactly 4 digits'
                        }
                    }
                }
            })
        }).required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

exports.validation = validation;
