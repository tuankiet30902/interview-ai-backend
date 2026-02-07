const winston = require('winston');
const {LogConst} = require('./log.const');

var getTime = function () {
    let date = new Date();

    let hour = date.getHours();
    hour = (hour < 10 ? '0' : '') + hour;

    let min = date.getMinutes();
    min = (min < 10 ? '0' : '') + min;

    let sec = date.getSeconds();
    sec = (sec < 10 ? '0' : '') + sec;

    let year = date.getFullYear();

    let month = date.getMonth() + 1;
    month = (month < 10 ? '0' : '') + month;

    let day = date.getDate();
    day = (day < 10 ? '0' : '') + day;

    let millisecond = date.getMilliseconds();

    return year + '-' + month + '-' + day + ' ' + hour + ':' + min + ':' + sec + '.' + millisecond;
};

// Đã xóa logic tạo folder logs-tenant và file log
// Chỉ giữ lại console logging
winston.addColors(LogConst.colors);
exports.LogInterface =  new winston.Logger({
    levels: LogConst.levels,
    transports: [
        new winston.transports.Console({
            handleExceptions: false,
            json: LogConst.isjson.console,
            colorize: true,
            timestamp: getTime,
            formatter: function (options) {
                // Return string will be passed to logger.
               
                if (LogConst.isjson.console){
                    return {
                        timestamp: options.timestamp(),
                        level: options.level,
                        path: options.meta.path,
                        type: options.meta.type,
                        details: options.meta.details,
                        service: options.meta.service,
                        microservice:options.meta.microservice,
                        parameter:options.meta.parameter
                    }
                }else{
                    
                    return options.timestamp() + ' ' + options.level.toUpperCase() + ' ' + (undefined !== options.meta ? options.meta.details : ''); 
                }
                
            }
        })
        // Đã xóa File transport - không còn tạo file log nữa
    ],
    //exitOnError: false
});

