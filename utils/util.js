const cluster = require('cluster');
var trycatch = require('trycatch');
const { v4: uuidv4 } = require('uuid');

var stringToKeys = function (keys_req, show) {
    var keys_ = keys_req;
    var keys;
    trycatch(function () {
        var key_array = keys_.split("|");
        keys = {};
        key_array.forEach(function (item) {
            keys[item.toString()] = show;
            if (item.toString() == "_id") {
                keys[item.toString()] = false;
            }
        })
    }, function (err) {
        keys = null;
        console.log(err);
    });
    return keys;
};

var getIP = function (req) {
    return req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        (req.connection.socket ? req.connection.socket.remoteAddress : null);
};

var getPublicIP = function (req) {
    if(!req.headers){
        return req.rawHeaders[req.rawHeaders.indexOf('x-public-ip') + 1] || null;
    }
    else{
        return req.headers['x-public-ip'] || null;
    }
};

var reques_log = function (request) {
    var clientIPaddr = null,
        clientProxy = null;

    // is client going through a proxy?
    if (request.headers['via']) { // yes
        clientIPaddr = request.headers['x-forwarded-for'];
        clientIPaddr = request.headers['x-public-ip'];
        clientProxy = request.headers['via'];
    } else { // no
        clientIPaddr = request.connection.remoteAddress;
        clientProxy = "none";
    }
    //var pathname = url.parse(request.url).pathname;
    //if (pathname != "/favicon.ico") {
    //    console.log("&gt;&gt; Request for " + pathname);
    //    console.log("&gt;&gt;&gt; Client : " + request.headers['user-agent']);
    //    console.log("&gt;&gt;&gt; IP address " + clientIPaddr + " via proxy " + clientProxy);
    //}

    console.log("&gt;&gt;&gt; Client : " + request.headers['user-agent']);
    console.log("&gt;&gt;&gt; IP address " + clientIPaddr + " via proxy " + clientProxy);

    // rest of request handling code
}

function objectIsRealValue(obj) {
    return obj && obj !== 'null' && obj !== 'undefined';
}

function objectIsEmpty(obj) {

    // null and undefined are "empty"
    if (obj == null) return true;

    // Assume if it has a length property with a non-zero value
    // that that property is correct.
    if (obj.length > 0) return false;
    if (obj.length === 0) return true;

    // If it isn't an object at this point
    // it is empty, but it can't be anything *but* empty
    // Is it empty?  Depends on your application.
    if (typeof obj !== "object") return true;

    // Otherwise, does it have any properties of its own?
    // Note that this doesn't handle
    // toString and valueOf enumeration bugs in IE < 9
    for (var key in obj) {
        if (hasOwnProperty.call(obj, key)) return false;
    }

    return true;
}

var JObjectSort = function (JObject) {
    var myObj = JObject;
    var keys = Object.keys(myObj),
        i, len = keys.length;

    keys.sort();

    var ordered = {};

    for (i = 0; i < len; i++) {
        ordered[keys[i]] = myObj[keys[i]];
        //alert(k + ':' + myObj[k]);
    }

    return ordered;
}

var removeUnicode = function (value) {
    if (typeof value === 'number') { value = value.toString(); }
    if (typeof value !== "string") return value;
    var str = value;
    str = str.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/!|@|%|\^|\*|\(|\)|\+|\=|\<|\>|\?|\/|,|\.|\:|\;|\'|\"|\&|\#|\[|\]|~|\$|_|`|-|{|}|\||\\/g, " ");
    str = str.replace(/ + /g, " ");
    str = str.trim();
    return str;
}
var removeUnicode_UpperCase = function (value) {
    if (typeof value === 'number') { value = value.toString(); }
    if (typeof value !== "string") return value;
    var str = value;
    str = str.toUpperCase();
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    str = str.replace(/!|@|%|\^|\*|\(|\)|\+|\=|\<|\>|\?|\/|,|\.|\:|\;|\'|\"|\&|\#|\[|\]|~|\$|_|`|-|{|}|\||\\/g, " ");
    str = str.replace(/ + /g, " ");
    str = str.trim();
    return str;
}

var generateSearchText = function (value) {
    if (typeof value === 'number') { value = value.toString(); }
    if (typeof value !== "string") return value;
    let result = "";
    result += removeUnicode(value);
    // result += " "+removeUnicode_UpperCase(value);
    return result;
}

const countFilter = function (body, fieldSearchAr) {
    let count = 0;
    for (var i in fieldSearchAr) {
        if (body[fieldSearchAr[i]] !== undefined && body[fieldSearchAr[i]] !== "") {
            count++;
        }
    }
    return count;
}

const genFilter = function (body, count, fieldSearchAr) {
    if (count == 0) { return {}; }
    if (count == 1) {
        let filter = {};
        for (var i in fieldSearchAr) {
            if (body[fieldSearchAr[i]] !== undefined && body[fieldSearchAr[i]] !== "") {
                switch (fieldSearchAr[i]) {
                    case "search":
                        filter = {
                            $text: { $search: body[fieldSearchAr[i]] }
                        };
                        break;
                    default:
                        filter[fieldSearchAr[i]] = { $eq: body[fieldSearchAr[i]] };
                }
            }
        }
        return filter;
    }

    let filter = { $and: [] };
    for (var i in fieldSearchAr) {
        if (body[fieldSearchAr[i]] !== undefined && body[fieldSearchAr[i]] !== "") {
            switch (fieldSearchAr[i]) {
                case "search":
                    filter.$and.push({
                        $text: { $search: body[fieldSearchAr[i]] }
                    });
                    break;
                default:
                    let item = {};
                    item[fieldSearchAr[i]] = { $eq: body[fieldSearchAr[i]] };
                    filter.$and.push(item);
            }
        }
    }

    return filter;
}

const NumberToStringForDate = function (input) {
    input = input + "";
    input = parseInt(input);
    if (input > 9) {
        return input + "";
    } else {
        return "0" + input;
    }
}
const generateDBName = function (domain) {
    domain = domain.replace(/[.:]/g, "_");
    return domain;
}

if (Array.prototype.equals) {
    console.warn("Overriding existing Array.prototype.equals. Possible causes: New API defines the method, there's a framework conflict or you've got double inclusions in your code.");
}

// attach the .equals method to Array's prototype to call it on any array
Array.prototype.equals = function (array) {
    // if the other array is a falsy value, return
    if (!array)
        return false;

    // compare lengths - can save a lot of time
    if (this.length != array.length)
        return false;

    for (var i = 0, l = this.length; i < l; i++) {
        // Check if we have nested arrays
        if (this[i] instanceof Array && array[i] instanceof Array) {
            // recurse into the nested arrays
            if (!this[i].equals(array[i]))
                return false;
        }
        else if (this[i] != array[i]) {
            // Warning - two different object instances will never be equal: {x:20} != {x:20}
            return false;
        }
    }
    return true;
}

const getCurrentDate = function () {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const day = currentDate.getDate().toString().padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    return formattedDate;
}

const praseStringToObject = function (value, defaultVal = null) {
    try {
        return JSON.parse(value);
    } catch (error) {
        return defaultVal || value;
    }
};

const isValidValue = function (value) {
    if (!value) return false;
    if (["undefined", "null"].includes(value)) return false;
    return true;
};

const getValidValue = function (value, defaultValue = null) {
    if (isValidValue(value)) {
        return value;
    } else {
        return defaultValue;
    }
};

const getDbNamePrefix = function (request) {
    return request.body._service[0].dbname_prefix;
};

const isMasterCluster = function () {
    // Handle for pm2 cluster mode
    if (process.env.NODE_APP_INSTANCE === '0') {
        return true;
    }

    // Handle for node cluster mode
    return cluster.isMaster;
};

const generateParent = function (parents, parent) {
    let max = 0;

    let thisParents = JSON.parse(JSON.stringify(parents));
    for (let x of thisParents) {
        if (x.order > max) { max = x.order }
        delete x["$$hashKey"];
    }

    if (parent && (parent.id || parent.code)) {
        thisParents.push({
            order: max + 1,
            code: parent.code,
            id: parent.id,
            object: parent.object
        });
    }
    return thisParents;
}

const generateLocalizeTitle = function (title) {
    if (!title) {
        return null;
    }

    if (typeof title === "string") {
        return {
            "vi-VN": title,
            "en-US": title,
        };
    }

    if (title["vi-VN"] && title["en-US"]) {
        return title;
    }

    return title;
};

const generateEvent = function({username, time = (new Date).getTime(), action, note = "", additionalInfo}) {
    return {
        id: uuidv4(),
        username,
        time,
        action,
        note,
        ...additionalInfo
    }
}

// Hide method from for-in loops
Object.defineProperty(Array.prototype, "equals", { enumerable: false });
exports.generateParent = generateParent;
exports.NumberToStringForDate = NumberToStringForDate;
exports.countFilter = countFilter;
exports.genFilter = genFilter;
exports.removeUnicode = removeUnicode;
exports.removeUnicode_UpperCase = removeUnicode_UpperCase;
exports.generateSearchText = generateSearchText;
exports.stringToKeys = stringToKeys;
exports.getIP = getIP;
exports.getPublicIP = getPublicIP;
exports.reques_log = reques_log;
exports.objectIsRealValue = objectIsRealValue;
exports.objectIsEmpty = objectIsEmpty;
exports.JObjectSort = JObjectSort;
exports.generateDBName = generateDBName;
exports.getCurrentDate = getCurrentDate;
exports.praseStringToObject = praseStringToObject;
exports.isValidValue = isValidValue;
exports.getValidValue = getValidValue;
exports.getDbNamePrefix = getDbNamePrefix;
exports.isMasterCluster = isMasterCluster;
exports.generateLocalizeTitle = generateLocalizeTitle;
exports.generateEvent = generateEvent;
