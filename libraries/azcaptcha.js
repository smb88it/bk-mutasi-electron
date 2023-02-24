const config = require('../config.json');
var axios = require('axios');
var qs = require('qs');

class Azcaptcha {
    constructor() {
        this.key = config.az_key
        this.url = {
            post: config.az_url+"/in.php",
            get: config.az_url+"/res.php"
        }
    }

    async post(base64) {
        var data = qs.stringify({
            'method': 'base64',
            'key': this.key,
            'body': base64,
            'json': 1
        })
        
        var res = await axios({
            method: 'post',
            url: this.url.post,
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: data
        })

        return res.data;
    }

    async get(id) {
        var res = await axios.get(`${this.url.get}?key=${this.key}&action=get&id=${id}&json=1`);
        return res.data;
    }
}

module.exports = Azcaptcha