const {
    SECRET_KEY,
    JWT_SECRET
} = process.env

module.exports = {
    secretkey: SECRET_KEY,
    JWTOptions: {
        jwtSecret: JWT_SECRET,
        expiresIn: '30d',
        longExpiresIn: '365d'
    }
};