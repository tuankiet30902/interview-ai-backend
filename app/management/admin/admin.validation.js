const { ValidationProvider } = require('../../../shared/validation/validation.provider');
const Joi = ValidationProvider.initModuleValidation();
var validation = {};

validation.login = function (req, res, next) {
    const schema_body = {
        data: Joi.object().keys({
            username: Joi.string().optional(),
            email: Joi.string().email().optional(),
            password: Joi.string().required(),
            remember: Joi.boolean().optional()
        }).or('username', 'email').required() // At least one of username or email is required
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.refreshToken = function (req, res, next) {
    const schema_body = {
        refreshToken: Joi.string().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

validation.loadDetails = function (req, res, next) {
    const schema_body = {
        account : Joi.string().required()
    };
    ValidationProvider.createMiddleware(schema_body, req, res, next);
}

exports.validation = validation;
