const user = require('./user/socket');
const admin = require('./admin/socket');
module.exports = function(socket){
    user(socket);
    admin(socket);
}
