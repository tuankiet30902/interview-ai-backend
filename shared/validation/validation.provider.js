const BaseError = require("../error/BaseError")

const Joi = require('joi');
function overrideSchemaBody(schemaBody) {
    if (!schemaBody.username) {
        // Username might be an email, so we shouldn't force alphanum
        schemaBody.username = Joi.string();
    }
    if (!schemaBody.session) {
        schemaBody.session = Joi.any();
    }
    if (!schemaBody._service) {
        schemaBody._service = Joi.any();
    }
    // Đã xóa _performanceId validation - không còn sử dụng performance tracking
    return Joi.object().keys(schemaBody).required();
}

function transformJoiError(error) {
    let errorDetails = error.details.map((detail) => {
        return {
            message: detail.message,
            path: detail.path.join("."),
        };
    });
    return errorDetails;
}


// function overrideExtendConfigJoi(config){
//     config.
// }
class ValidationProvider {
    constructor() { }
    initModuleValidation() {
        return Joi;
    }


    createMiddleware(schemaBody, req, res, next) {
        try {
            // console.log(`[ValidationProvider] createMiddleware called for ${req.path}`);
            let overrideSchemaBodyValue = overrideSchemaBody(schemaBody);

            Joi.validate(req.body, overrideSchemaBodyValue, { allowUnknown: true }, (err, value) => {
                if (err) {
                    // send a 422 error response if validation fails
                    console.error(`[ValidationProvider] Validation error for ${req.path}:`, err.details);
                    res.status(422).json({
                        status: 'error',
                        message: 'Invalid request data',
                        data: err
                    });
                    res.end();
                } else {
                    // send a success response if validation passes
                    // console.log(`[ValidationProvider] Validation passed for ${req.path}, calling next()`);
                    // attach the random ID to the data response
                    // res.json({
                    //     status: 'success',
                    //     message: 'User created successfully',
                    //     data: Object.assign({id}, value)
                    // });
                    next();
                }
            });
        } catch (error) {
            console.error(`[ValidationProvider] Exception in createMiddleware for ${req.path}:`, error);
            console.error(`[ValidationProvider] Exception stack:`, error?.stack);
            res.status(500).json({
                status: 'error',
                message: 'Validation error',
                error: error.message || error
            });
            res.end();
        }
    }

    getDefaultKeys() {
        return {
            username: Joi.string().alphanum(),
            session: Joi.any()
        }
    }

    createCustomMiddleware(schemaBody, req, res, next) {
        Joi.validate(req.body, schemaBody, (err, value) => {

            // create a random number as id
            // const id = Math.ceil(Math.random() * 9999999);

            if (err) {
                // send a 422 error response if validation fails
                res.status(422).json({
                    status: 'error',
                    message: 'Invalid request data',
                    data: err
                });
                res.end();
            } else {
                // send a success response if validation passes
                // attach the random ID to the data response
                // res.json({
                //     status: 'success',
                //     message: 'User created successfully',
                //     data: Object.assign({id}, value)
                // });
                next();
            }
        });
    }

    createValidator(schemaBody, req, res, next, message = null) {
        const schema = overrideSchemaBody(schemaBody);
        const validateResult = Joi.validate(req.body, schema);
        if (validateResult.error) {
            res
                .status(422)
                .json({
                    status: "Validation Error",
                    message: message || "Invalid request data",
                    errors: validateResult.error,
                });
            return;
        }
        req.body = validateResult.value;
        next();
    }

    validateData(schema, data) {
        const validate = Joi.validate(data, schema, {});
        if (validate.error) {
            throw new BaseError("ValidationProvider.validateData", transformJoiError(validate.error), 422);
        }
        return validate.value;
    }

}

exports.ValidationProvider = new ValidationProvider();
