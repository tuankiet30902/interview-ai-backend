
const trycatch = require('trycatch');
const q = require('q');
// Đã xóa ItemSetup - không còn sử dụng setup
class RuleController {
    constructor() { }
    load() {
        let dfd = q.defer();
        trycatch(function () {
            // Đã xóa ItemSetup.getItems - không còn sử dụng setup
            // Trả về mảng rỗng thay vì items từ setup
            dfd.resolve([]);
        }, function (err) {
            dfd.reject({ path: "RuleController.load.trycatch", err: err.stack });
            err = undefined;
        });
        return dfd.promise;
    }
  
}

exports.RuleController = new RuleController(); 