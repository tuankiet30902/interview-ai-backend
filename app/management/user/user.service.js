const { MongoDBProvider } = require('../../../shared/mongodb/db.provider');
const mongoDBSettings = require('../../../shared/mongodb/mongodb.const');
const { systemUsername } = require('../../../shared/mongodb/mongodb.const');

const q = require('q');
const { FileConst } = require('../../../shared/file/file.const');
const { AuthenticationProvider } = require('../../../shared/authentication/authentication.provider');
const settings = require('../../../utils/setting');
const { removeUnicode } = require('../../../utils/util');
const { SocketProvider } = require('./../../../shared/socket/provider');
const folderArray = ['management', 'user']
const { ItemSetup } = require('../../../shared/setup/items.const');
const { FileProvider } = require('../../../shared/file/file.provider');
const { GoogleAuthProvider } = require('../../../shared/google-auth/google-auth.provider');


const nameLib = 'avatar';
class UserService {
    constructor() { }

    setup_mfa(dbname_prefix, username, mfa_secret) {
        return MongoDBProvider.update_onManagement(dbname_prefix, "user", username,
            { username: { $eq: username } },
            { $set: { mfa_secret, has_mfa: false } });
    }

    mark_mfa(dbname_prefix, username) {
        return MongoDBProvider.update_onManagement(dbname_prefix, "user", username,
            { username: { $eq: username } },
            { $set: { has_mfa: true } });
    }

    loadUserForAddFriend(dbname_prefix, username, search) {
        let dfd = q.defer();
        MongoDBProvider.load_onManagement(dbname_prefix, "user", { $text: { $search: search } }, 48, 0, { title: -1 }).then(function (data) {
            let usernameAr = [];
            for (var i in data) {
                usernameAr.push(data[i].username);
            }
            let dfdAr = [];
            dfdAr.push(MongoDBProvider.load_onBasic(dbname_prefix, "add_friend",
                {
                    $and: [{ username: { $eq: username } },
                    { friend: { $in: usernameAr } }]
                }));
            dfdAr.push(MongoDBProvider.load_onBasic(dbname_prefix, "request_add_friend",
                {
                    $and: [{ username: { $eq: username } }, { friend: { $in: usernameAr } }]
                }));
            q.all(dfdAr).then(function (data2) {
                let result = [];
                for (var i in data) {
                    var check = true;
                    for (var j in data2[0]) {
                        if (data[i].username == data2[0][j].friend) { check = false; break; }
                    }
                    for (var j in data2[1]) {
                        if (data[i].username == data2[1][j].friend) { check = false; break; }
                    }
                    if (check && username !== data[i].username) {
                        result.push(data[i]);
                    }
                }
                dfd.resolve(result);
            }, function (err) {
                dfd.reject(err);
            });
        }, function (err) {
            dfd.reject(err);
        });
        return dfd.promise;
    }

    checkExists(dbname_prefix, username, password) {
        return MongoDBProvider.load_onManagement(dbname_prefix, "user", {
            $and: [
                { username: { $eq: username } },
                { password: { $eq: password } },
                { isactive: { $eq: true } }
            ]
        }, undefined, undefined, undefined, { password: false });
    }

    changePassword(dbname_prefix, username, password, newPassword) {
        return MongoDBProvider.update_onManagement(dbname_prefix, "user", username
            , {
                $and: [
                    { username: { $eq: username } },
                    { password: { $eq: password } }
                ]

            }, {
            $set: { password: newPassword }
        });
    }

    changeLanguage(dbname_prefix, username, key) {
        return MongoDBProvider.update_onManagement(dbname_prefix, "user", username
            , {
                username: { $eq: username }
            }, {
            $set: { "language.current": key }
        });
    }

    changeTheme(dbname_prefix, username, theme) {
        return MongoDBProvider.update_onManagement(dbname_prefix, "user", username, { username: { $eq: username } }, { $set: { "theme": theme } });
    }

    checkExist(dbname_prefix, username) {
        let dfd = q.defer();
        MongoDBProvider.load_onManagement(dbname_prefix, "user", { username: { $eq: username } }).then(function (res) {
            if (res[0]) {
                dfd.resolve(false);
            } else {
                dfd.resolve(true);
            }
        }, function (err) {
            dfd.reject({ path: "UserService.checkExist.db", err });
        });

        return dfd.promise;
    }

    insert(dbname_prefix, username, title, account, password, language, isactive, department) {
        let dfd = q.defer();
        if (systemUsername.indexOf(account) != -1) {
            dfd.reject({ path: "UserService.insert.CantCreateAccountWithSystemUsername", mes: "CantCreateAccountWithSystemUsername" });
        } else {
            MongoDBProvider.load_onManagement(dbname_prefix, "user", { username: { $eq: account } }, 1, 0).then(function (check_data) {
                if (check_data[0]) {
                    dfd.reject({ path: "UserService.insert.UserIsExists", mes: "UserIsExists" });
                } else {
                    MongoDBProvider.insert_onOffice(dbname_prefix, "employee", username,
                        { fullname: title, department, competence: "Staff", update_mission_general: true }).then(function (e) {
                            let dfdAr = [];

                            dfdAr.push(MongoDBProvider.insert_onManagement(dbname_prefix, "user", username,
                                {
                                    username: account, title, title_search: removeUnicode(title),
                                    password, language, isactive, rule: [{ rule: "Authorized" }], role: [],
                                    employee: e.ops[0]._id.toString(),
                                    department
                                }));
                            dfdAr.push(MongoDBProvider.insert_onBasic(dbname_prefix, "room", username, { name: account, members: [account] }));
                            q.all(dfdAr).then(function () {
                                dfd.resolve(true);
                            }, function (err) {
                                dfd.reject(err);
                            });
                        }, function (err) {
                            dfd.reject(err);
                        });
                }
            }, function (err) {
                dfd.reject(err);
            });


        }

        return dfd.promise;
    }

    registerPublic(dbname_prefix, email, name, password, language, isactive) {
        let dfd = q.defer();
        const account = email;
        const username = email;
        const title = name || email.split('@')[0];
        const department = "Public";

        if (systemUsername.indexOf(account) != -1) {
            dfd.reject({ path: "UserService.registerPublic.CantCreateAccountWithSystemUsername", mes: "CantCreateAccountWithSystemUsername" });
        } else {
            // Check if user exists
            MongoDBProvider.load_onManagement(dbname_prefix, "user", { username: { $eq: account } }, 1, 0).then(function (check_data) {
                if (check_data[0]) {
                    dfd.reject({ path: "UserService.registerPublic.UserIsExists", mes: "UserIsExists" });
                } else {
                    // Create employee record first
                    MongoDBProvider.insert_onOffice(dbname_prefix, "employee", username,
                        { fullname: title, department, competence: "Staff", update_mission_general: true }).then(function (e) {
                            let dfdAr = [];

                            // Create user record
                            dfdAr.push(MongoDBProvider.insert_onManagement(dbname_prefix, "user", username,
                                {
                                    username: account,
                                    email: email,
                                    title,
                                    title_search: removeUnicode(title),
                                    password,
                                    language,
                                    isactive,
                                    rule: [{ rule: "Authorized" }],
                                    role: [],
                                    employee: e.ops && e.ops[0] ? e.ops[0]._id.toString() : null,
                                    department,
                                    email_verified: true // Auto-verify for public registration
                                }));

                            // Create personal room
                            dfdAr.push(MongoDBProvider.insert_onBasic(dbname_prefix, "room", username, { name: account, members: [account] }));

                            q.all(dfdAr).then(function () {
                                dfd.resolve(true);
                            }, function (err) {
                                dfd.reject(err);
                            });
                        }, function (err) {
                            dfd.reject(err);
                        });
                }
            }, function (err) {
                dfd.reject(err);
            });
        }
        return dfd.promise;
    }

    loginWithGoogle(dbname_prefix, code) {
        let dfd = q.defer();
        const self = this;

        GoogleAuthProvider.authenticate(code).then(function (authData) {
            const googleUser = authData.user || {};
            const email = googleUser.email;

            if (!email) {
                dfd.reject({ mes: "Google authentication did not return email" });
                return;
            }

            MongoDBProvider.load_onManagement(dbname_prefix, "user", { username: { $eq: email } }, 1, 0)
                .then(function (users) {
                    if (users && users[0]) {
                        return MongoDBProvider.update_onManagement(
                            dbname_prefix,
                            "user",
                            email,
                            { username: { $eq: email } },
                            { $set: { avatar_url: googleUser.picture || null } }
                        ).catch(function () { })
                            .then(function () {
                                return MongoDBProvider.getOne_onManagement(dbname_prefix, "user", { username: { $eq: email } });
                            })
                            .then(function (user) {
                                dfd.resolve({ user: user, isNewUser: false });
                            });
                    }

                    // 2) Create user if not exists (no tenant/space/project setup)
                    const title = googleUser.name || email.split('@')[0];
                    const passwordPlain = Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-16);
                    const password = AuthenticationProvider.encrypt_oneDirection_lv1(passwordPlain);

                    return MongoDBProvider.insert_onOffice(dbname_prefix, "employee", email, {
                        fullname: title,
                        department: "Public",
                        competence: "Staff",
                        update_mission_general: true
                    }).then(function (e) {
                        const employeeId = e && e.ops && e.ops[0] ? e.ops[0]._id.toString() : null;

                        return MongoDBProvider.insert_onManagement(dbname_prefix, "user", email, {
                            username: email,
                            email: email,
                            title: title,
                            title_search: removeUnicode(title),
                            password: password,
                            language: { current: "vi-VN" },
                            isactive: true,
                            rule: [{ rule: "Authorized" }],
                            role: [],
                            employee: employeeId,
                            department: "Public",
                            email_verified: true,
                            avatar_url: googleUser.picture || null
                        });
                    }).then(function () {
                        return MongoDBProvider.getOne_onManagement(dbname_prefix, "user", { username: { $eq: email } });
                    }).then(function (user) {
                        dfd.resolve({ user: user, isNewUser: true });
                    });
                })
                .catch(function (err) {
                    dfd.reject(err);
                });
        }, function (err) {
            console.error("UserService.loginWithGoogle error:", err);
            dfd.reject({ mes: err && err.message ? err.message : "Google login failed" });
        });

        return dfd.promise;
    }

    loadForDirective(dbname_prefix, username) {
        let dfd = q.defer();
        let dfdAr = [];

        MongoDBProvider.load_onManagement(dbname_prefix, "user", { username: { $eq: username } }, 1).then(function (userArray) {
            if (userArray[0]) {
                let res = userArray[0];
                dfdAr.push(
                    SocketProvider.getData('memberOnline').then(
                        (memberOnline) => {
                            var thisUsername = memberOnline.filter((member) => member.username === username);
                            if (thisUsername.length > 0) {
                                res.online = true;
                            } else {
                                res.online = false;
                            }
                            memberOnline = undefined;
                        },
                        (err) => {
                            res.online = false;
                            err = undefined;
                        }
                    )
                );

                if (res.avatar) {
                    dfdAr.push(
                        FileProvider.loadFile(
                            dbname_prefix,
                            {},
                            res.avatar.nameLib,
                            res.avatar.name,
                            undefined,
                            undefined,
                            folderArray,
                            username,
                        ).then(
                            (img) => {
                                res.avatar.url = img.url;
                                img = undefined;
                            },
                            (err) => {
                                res.avatar = {
                                    url: settings.adminDomain + "/datasources/images/default/avatar_default.png",
                                };
                                err = undefined;
                            },
                        ),
                    );

                }


                if (dfdAr.length > 0) {
                    q.allSettled(dfdAr)
                        .then((data) => {
                            dfd.resolve(res);
                            res = undefined;
                            data = undefined;
                        })
                        .catch((error) => {
                            console.log('===<<>>=== ~ file: user.service.js:211 ~ UserService ~ error:', error);
                            dfd.reject(error);
                            res = undefined;
                            error = undefined;
                        });
                } else {
                    dfd.resolve(res);
                    res = undefined;
                }
            } else {
                if (systemUsername.indexOf(username) != -1) {
                    let result = {};
                    result.title = "Automatic System";
                    result.avatar = { url: settings.adminDomain + "/datasources/images/default/avatar_default.png" };
                    dfd.resolve(result);
                } else {
                    dfd.reject({ path: "UserService.loadForDirective.DataIsNotExists", mes: "DataIsNotExists" });
                }
            }
        }, function (err) {
            dfd.reject(err);
            err = undefined;
        });
        return dfd.promise;
    }

    loadUser(dbname_prefix, filter, top, offset, sort) {
        function loadUserAvatar(fileName) {
            let dfd = q.defer();
            gcpProvider.getSignedUrl(fileName).then(
                (img) => {
                    dfd.resolve(img);
                },
                () => {
                    dfd.resolve('');
                }
            );
            return dfd.promise;
        }

        let dfd = q.defer();
        let dfdArr = [];
        MongoDBProvider.load_onManagement(dbname_prefix, 'user', filter, top, offset, sort, {
            _id: true,
            username: true,
            title: true,
            rule: true,
            role: true,
            isactive: true,
            language: true,
            root: true,
            avatar: true,
            competence: true,
            department: true,
            avatar_url: true
        }).then(
            function (data) {
                for (var i in data) {
                    if (data[i].avatar) {
                        dfdArr.push(dfdArr.push(FileProvider.loadFile(dbname_prefix, {}, data[i].avatar.nameLib, data[i].avatar.name, undefined, undefined, folderArray, data[i].username)));

                    } else {
                        data[i].avatar = {
                            url: settings.adminDomain + '/datasources/images/default/avatar_default.png',
                        };
                    }

                    if (data[i].competence) {
                        let itemCompetence = ItemSetup.getItems('management', 'directory');
                        for (var j in itemCompetence) {
                            if (itemCompetence[j].master_key === 'competence' && itemCompetence[j].value === data[i].competence) {
                                data[i].competence = itemCompetence[j];
                                break;
                            }
                        }
                    }

                    if (data[i].department) {
                        dfdArr.push(
                            MongoDBProvider.load_onOffice(dbname_prefix, "organization", { id: data[i].department }, undefined, undefined, { ordernumber: 1 })
                        );
                    }
                }
                if (dfdArr.length > 0) {
                    q.all(dfdArr).then(
                        (items) => {
                            const listOfImageUrls = items.filter(item => typeof (item) === 'string');
                            let listOfDepartments = [];
                            items.filter(item => {
                                if (!listOfImageUrls.includes(item) && item[0]) {
                                    listOfDepartments.push(item[0]);
                                }
                            });

                            let count = 0;
                            for (const i in data) {
                                if (data[i].avatar && listOfImageUrls[count] && listOfImageUrls[count].includes(`/${data[i].username}/`)) {
                                    data[i].avatar.url = listOfImageUrls[count];
                                    count++;
                                } else if (data[i].avatar_url) {
                                    data[i].avatar = {
                                        url: data[i].avatar_url
                                    };
                                } else {
                                    data[i].avatar = {
                                        url: settings.adminDomain + '/datasources/images/default/avatar_default.png',
                                    };
                                }

                                if (data[i].department) {
                                    const currentDep = listOfDepartments.find(dep => dep.id === data[i].department);
                                    if (currentDep) {
                                        data[i].departmentName = currentDep.title;
                                        data[i].departmentId = currentDep.id;
                                    } else {
                                        data[i].departmentName = {
                                            "vi-VN": "",
                                            "en-US": "",
                                        };
                                    }
                                    delete data[i].department;
                                }
                            }
                            dfd.resolve(data);
                            data = undefined;
                            count = undefined;
                        },
                        (err) => {
                            dfd.reject(err);
                            data = undefined;
                            err = undefined;
                        }
                    );
                } else {
                    dfd.resolve(data);
                    data = undefined;
                }
            },
            function (err) {
                dfd.reject(err);
                err = undefined;
            }
        );
        return dfd.promise;
    }

    countUser(dbname_prefix, filter) {
        return MongoDBProvider.count_onManagement(dbname_prefix, "user", filter);
    }

    update(dbname_prefix, username, id, title, isactive, role) {
        return MongoDBProvider.update_onManagement(dbname_prefix, "user", username,
            { _id: { $eq: new require('mongodb').ObjectID(id) } },
            { $set: { title, title_search: removeUnicode(title), isactive, role } });
    }

    delete(dbname_prefix, id, username) {
        return MongoDBProvider.delete_onManagement(dbname_prefix, "user", username,
            {
                $and: [{ _id: { $eq: new require('mongodb').ObjectID(id) } },
                { isactive: { $ne: true } }]
            });

    }

    pushRule(dbname_prefix, username, id, rule) {
        let dfd = q.defer();
        MongoDBProvider.update_onManagement(dbname_prefix, "user", username,
            { _id: { $eq: new require('mongodb').ObjectID(id) } },
            {
                $pull: { rule: { rule: { $eq: rule.rule } } }
            }).then(function () {
                MongoDBProvider.update_onManagement(dbname_prefix, "user", username,
                    { _id: { $eq: new require('mongodb').ObjectID(id) } },
                    {
                        $push: { rule: rule }
                    }).then(function () {
                        dfd.resolve(true);
                    }, function (err) {
                        dfd.reject(err);
                    });
            }, function (err) {
                dfd.reject(err);
            });
        return dfd.promise;
    }

    removeRule(dbname_prefix, username, id, rule) {
        return MongoDBProvider.update_onManagement(dbname_prefix, "user", username,
            { _id: { $eq: new require('mongodb').ObjectID(id) } }, { $pull: { rule: { rule: rule.rule } } });
    }

    loadDetails(dbname_prefix, account) {
        return MongoDBProvider.getOne_onManagement(dbname_prefix, "user", { username: { $eq: account } });
    }

    updateAvatar(dbname_prefix, username, avatar) {
        return MongoDBProvider.update_onManagement(dbname_prefix, "user", username,
            { username: { $eq: username } },
            { $set: { avatar } });
    }

    resetPassword(dbname_prefix, username, account) {
        let myPassword = settings.defaultPassword;
        myPassword = AuthenticationProvider.encrypt_oneDirection_lv1(myPassword);
        let d = new Date();
        return MongoDBProvider.update_onManagement(dbname_prefix, "user", username,
            { username: { $eq: account } },
            {
                $set: { password: myPassword },
                $push: { events: { username, action: "ResetPassword", time: d.getTime() } }
            });
    }

    getFriend(dbname_prefix, username) {
        return MongoDBProvider.load_onBasic(dbname_prefix, 'add_friend', { friend: { $eq: username } },
            5000, 0, { count: -1 });
    }

    loadByEmployeeIds(dbname_prefix, employeeIds) {
        return MongoDBProvider.load_onManagement(dbname_prefix, "user", { employee: { $in: employeeIds } });
    }

    loadByDepartmentIds(dbname_prefix, departmentIds) {
        return MongoDBProvider.load_onManagement(dbname_prefix, "user", { department: { $in: departmentIds } });
    }

    loadByRole(dbname_prefix, role) {
        return MongoDBProvider.load_onManagement(dbname_prefix, "user", { role: { $eq: role } });
    }

    increaseOCRProcessed(dbname_prefix, username) {
        return MongoDBProvider.update_onManagement(
            dbname_prefix,
            "user",
            username,
            { username: { $eq: username } },
            { $inc: { ocr_processed: 1 } }
        );
    }

    updateStorageUsage(dbname_prefix, username, storageUsage) {
        return MongoDBProvider.update_onManagement(
            dbname_prefix,
            "user",
            username,
            { username: { $eq: username } },
            { $set: { usage_storage: storageUsage } }
        );
    }

}

exports.UserService = new UserService();
