const { DEFAULT_PASSWORD, HOST_NAME, HOST_DOMAIN, PORT, SOCKET_HOST, ADMIN_DOMAIN, FOLDER_NAME, SECRET_SESSION, MFA_APP_NAME, LOGO_DEFAULT, BACKGROUND, BACKGROUND_LOGIN, VIDEO_VN_USER_MANUAL, VIDEO_EN_USER_MANUAL} =
    process.env;

var obj = {
    modeProduction: "production",
    defaultPassword: DEFAULT_PASSWORD,
    hostname: HOST_NAME,
    hostDomain: HOST_DOMAIN,
    port: PORT,
    socketHost: SOCKET_HOST,
    adminDomain: ADMIN_DOMAIN,
    folderName: FOLDER_NAME,
    secretSession: SECRET_SESSION,
    mfa_app_name : MFA_APP_NAME,
    windowms: 15 * 60 * 1000,
    maxRequestPerIp: 100,
    statusHTTP: {
        internalServer: 500,
        forbidden: 403,
        authorized: 401,
        notFound: 404,
        notPermission: 401,
        unknownError: 520,
        outOfDate: 401,
        maintenance: 401,
        unregistered: 401,
        badRequest: 400,
    },
    messageHTTP: {
        internalServer: "FailureAction",
        forbidden: "Forbidden",
        authorized: "Unauthorized",
        notFound: "NotFound",
        notPermission: "NotPermission",
        unknownError: "UnknownError",
        outOfDate: "YourServiceIsOutOfDate",
        maintenance: "YourServiceIsMaintaining",
        unregistered: "YourServiceIsUnregistered",
    },
    signatureDimension: {
        width: 180,
        height: 70,
    },
    quotationMarkDimension: {
        width: 50,
        height: 17,
    },
    imageDefault: {
        logo: LOGO_DEFAULT,
        background: BACKGROUND,
        backgroundLogin: BACKGROUND_LOGIN,
    },
    videoUserManual: {
        document: {
            'vi-VN': VIDEO_VN_USER_MANUAL,
            'en-US': VIDEO_EN_USER_MANUAL
        }
    }
};

module.exports = obj;
