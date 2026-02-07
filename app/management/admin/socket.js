
const { SocketProvider } = require('./../../../shared/socket/provider');
const q = require('q');
const { UserService } = require('./admin.service');
const { AdminService } = require('./admin.service');
const _tennantPrefix = "tenant_";
const _adminRoomPrefix = "admin_";

function sendSignalToUserFriend(username, event, data) {
    let dfd = q.defer();
    UserService.getFriend(username).then(function (friends) {
        for (var i in friends) {
            SocketProvider.IOEmitToRoom(friends[i].username, event, data);
        }
        SocketProvider.IOEmitToRoom(username, event, data);
    }, function (err) {
        dfd.reject(err);
    });
    return dfd.promise;
}

// Realtime update functions removed - no longer needed

module.exports = function (socket) {
    // Handle admin login - join admin room (realtime updates removed)
    SocketProvider.socketOn(socket, 'admin_login', function (data) {
        const dbname_prefix = data.data.dbname_prefix || "";
        const adminRoom = `${_adminRoomPrefix}${dbname_prefix}`;

        console.log(`[AdminSocket] admin_login received - username: ${data.username}, dbname_prefix: "${dbname_prefix}"`);
        console.log(`[AdminSocket] Joining admin room: "${adminRoom}"`);

        SocketProvider.joinRoom(socket, adminRoom);

        // Also join global admin room (empty dbname_prefix) to receive all updates
        if (dbname_prefix && dbname_prefix !== '') {
            const globalAdminRoom = `${_adminRoomPrefix}`;
            console.log(`[AdminSocket] Also joining global admin room: "${globalAdminRoom}"`);
            SocketProvider.joinRoom(socket, globalAdminRoom);
        }

        // Also join tenant room and user room for compatibility
        SocketProvider.joinRoom(socket, `${_tennantPrefix}${dbname_prefix}`);
        SocketProvider.joinRoom(socket, data.username);
    });

    SocketProvider.socketOn(socket, 'login', function (data) {
        SocketProvider.joinRoom(socket, `${_tennantPrefix}${data.data.dbname_prefix}`);
        SocketProvider.joinRoom(socket, data.username);
        SocketProvider.getData("memberOnline").then(function (memberOnline) {
            let thisGuy = memberOnline.filter(member => member.username === data.username);

            if (thisGuy.length == 0) {
                memberOnline.push({ username: data.username, socketIds: [socket.id] });
            } else {
                for (var i in memberOnline) {
                    if (memberOnline[i].socketIds.indexOf(socket.id) == -1
                        && memberOnline[i].username === data.username) {
                        memberOnline[i].socketIds.push(socket.id);
                    }
                }
            }

            SocketProvider.putData('memberOnline', memberOnline).then(function (params) {

                sendSignalToUserFriend(data.username, "updateMemberOnline", data.username);
            });
        }, function (err) {
            SocketProvider.putData('memberOnline', [{ username: data.username, socketIds: [socket.id] }]).then(function (params) {
                sendSignalToUserFriend(data.username, "updateMemberOnline", data.username);
            });
        });

    });

    SocketProvider.socketOn(socket, "logout", function (data) {
        SocketProvider.leaveRoom(socket, data.username);

        SocketProvider.socketEmitToRoom(socket, data.username, "logout", data.username);
        SocketProvider.getData("memberOnline").then(function (memberOnline) {
            let member = memberOnline.filter(mem =>mem.username !==data.username );
            SocketProvider.putData('memberOnline', member).then(function (params) {
                sendSignalToUserFriend(data.username, "updateMemberOnline", data.username);
            });
        }, function (err) {
            SocketProvider.putData('memberOnline', []);
        });
    })

    SocketProvider.socketOn(socket, "disconnect", function (data) {

        SocketProvider.getData("memberOnline").then(function (memberOnline) {
            let members = [];
            for (var i in memberOnline) {

                if (data.username === memberOnline[i].username) {
                    let socketId = [];
                    for (var j in memberOnline[i].socketIds) {
                        if (socket.id !== memberOnline[i].socketIds[j]) {
                            socketId.push(memberOnline[i].socketIds[j]);
                        }
                    }
                    memberOnline[i].socketIds = socketId;
                    if (memberOnline[i].socketIds.length > 0) {
                        members.push(memberOnline[i]);
                    }
                } else {
                    members.push(memberOnline[i]);
                }
            }
            SocketProvider.putData('memberOnline', members).then(function () {
                sendSignalToUserFriend(data.username, "updateMemberOnline", data.username);
            });

        }, function (err) {
            SocketProvider.putData('memberOnline', []);

        });
    });
}

// Export empty functions to prevent errors if called elsewhere (realtime updates removed)
module.exports.emitAdminDashboardUpdate = function(dbname_prefix) { /* No-op */ };
module.exports.emitAdminDataChanged = function(dbname_prefix, dataType) { /* No-op */ };
module.exports.emitTodayUsersUpdate = function(dbname_prefix) { /* No-op */ };
