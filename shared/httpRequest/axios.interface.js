const axios = require('axios');
const https = require('https');
const q = require('q');
const {
    MODE_PRODUCTION
} = process.env;
const {LogProvider} = require('../log_nohierarchy/log.provider')
class AxiosInterface {
  constructor() {
    let rejectUnauthorized = true;
    if(MODE_PRODUCTION === "development"){
        rejectUnauthorized = false;
    } 
    this.agent = new https.Agent({ rejectUnauthorized });
  }

  post(url, body, options) {
    let dfd = q.defer();
     axios.post(url, body, { ...options, httpsAgent: this.agent }).then(function(data){
      
      dfd.resolve(data);
     },function(err){
      LogProvider.error(err,"fda","fdaf","fdaf");
     });
    return dfd.promise;
  }

  get(url, options) {
    return axios.get(url, { ...options, httpsAgent: this.agent });
  }

  put(url, body, options) {
    return axios.put(url, body, { ...options, httpsAgent: this.agent });
  }

  delete(url, body, options) {
    return axios.delete(url, { ...options, httpsAgent: this.agent, data: body });
  }
}

// Sử dụng với xác minh SSL
exports.AxiosInterface = new AxiosInterface();

