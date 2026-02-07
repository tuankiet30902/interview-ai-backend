const BaseError = require("../error/BaseError");
const { FileProvider } = require("../file/file.provider");
const { LogProvider } = require("../log_nohierarchy/log.provider");

function resolveFormData(nameLib, validateSchema, thePath, parentFolder, usernameStatic = null) {
    return function (request, response, next) {
        // Check if request is multipart/form-data
        const contentType = request.headers['content-type'] || '';
        const isMultipart = contentType.includes('multipart/form-data');

        // If not multipart, skip file processing
        if (!isMultipart) {
            request.formData = null;
            next();
            return;
        }

        // For multipart requests, FileProvider.upload will parse FormData using Busboy
        // and extract username from the parsed fields. We don't need to get username here.
        // If usernameStatic is provided, use it; otherwise FileProvider will get it from parsed FormData.
        // For tenant avatar, we need to get username from FormData fields after parsing
        // So we'll parse FormData first to get username, then pass it to FileProvider.upload
        let usernameToUse = usernameStatic;
        
        // If usernameStatic is not provided, we need to get it from FormData
        // But we can't parse FormData before FileProvider.upload does, so we'll let FileProvider handle it
        // However, for tenant avatar, username is in FormData, so FileProvider.upload will get it from req.body.username
        FileProvider.upload(request, nameLib, validateSchema, thePath, parentFolder, usernameStatic)
            .then((result) => {
                request.formData = result;
                // Ensure req.body exists (preserve _service set by MultiTenant middleware)
                if (!request.body) {
                    request.body = {};
                }

                // Parse fields from FormData and merge into req.body for validation
                if (result && result.Fields) {
                    // Set all fields from FormData to req.body for validation
                    // This ensures all fields (id, username, etc.) are available for validation
                    Object.keys(result.Fields).forEach(function (key) {
                        if (key === 'data') {
                            // Parse the 'data' field if exists (JSON string)
                            try {
                                const parsedData = JSON.parse(result.Fields.data);
                                request.body.data = parsedData;
                            } catch (e) {
                                // If parsing fails, keep original
                            }
                        } else {
                            // Set other fields directly (id, username, etc.)
                            request.body[key] = result.Fields[key];
                        }
                    });
                }
                next();
            })
            .catch((error) => {
                LogProvider.error("Processing form data failed with reason: " + (error.message || error));
                response.status(500).json({ mes: "ProcessingFormDataFailed" });
            });
    };
}

module.exports = resolveFormData;
