const axios = require("axios");
const qs = require('qs');
const config = require('../config.json');
class BK {
    constructor() {

    }

    async situs() {
        try {
            var url = config.bk_url1+"/account/account/sites";
			const response = await axios({
				method: "get",
				url: url
			})
			return await response.data;
		} catch (err) {
			console.log(err.message);
			return {
				status: false,
				message: err.message
			}
		}
    }

	async login(data) {
		try {
			var url = `${config.bk_url}${data.situs}/dashboard/account/api-login/${data.type}`;
			const response = await axios({
				method: "post",
				url: url,
				data: qs.stringify({
					user_email: data.username,
					user_password: data.password
				})
			})
            
			return await response.data;
		} catch (err) {
			console.log(err.message);
			return {
				status: false,
				message: err.message
			}
		}
	}

	async account(token) {
		try {
			var url = `${config.bk_url1}account/account/account`;
			const response = await axios({
				method: "get",
				url: url,
				headers: {
					authorization: token
				}
			})
            
			return await response.data;
		} catch (err) {
			console.log(err.message);
			return {
				status: false,
				message: err.message
			}
		}
	}

	async rekening(user) {
		try {
			var url = `${config.bk_url}${user.situs}/mutasi/api/rekening/listaccount/${config.bankCode}`;
			const response = await axios({
				method: "get",
				url: url,
				headers: {
					authorization: user.token
				}
			})
            
			return await response.data
		} catch (err) {
			console.log(err.message);
			return {
				status: false,
				message: err.message
			}
		}
	}
}

module.exports = new BK();