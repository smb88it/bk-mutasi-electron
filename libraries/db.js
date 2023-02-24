const config = require('../config.json');
const axios = require("axios");

class DB {
	constructor() {
		
	}
	
	async saveData(prm, type, bankCode) {
		try {
			var mongoUrl = config.url_mongo+"/insert";
			var doUrl = config.url_do+"/"+type;

			var opt = {
				method : 'post',
				url: mongoUrl,
				data : JSON.stringify(prm.data),
				headers : {
					'Content-Type' : 'application/json',
					'X-Augipt-Gtwmutasi' : config.key_header_mongo
				}
			}
			let req = await axios(opt);
			let res = await req.data;
			if (res.status) {
				var dataDo = {
					"bank": bankCode,
					"norek": prm.norek,
					"username": prm.username,
					"mongo_id": res.id,
					"created_by": prm.email,
					"date": prm.time
				}
				opt.url = doUrl;
				opt.data = JSON.stringify(dataDo);
				opt.headers['X-Augipt-Gtwmutasi'] = config.key_header_do;
				req = await axios(opt);
				res = await req.data;
				if (res.status) return res;
				else return {
					status: false,
					message: res.message.join(",")
				}
			}else{
				return {
					status: false,
					message: res.errors.join(",")
				}
			}
		} catch (err) {
			console.log(err.message);
			return {
				status: false,
				message: err.message
			}
		}
	}

	async privilage(email) {
		try {
			var doUrl = config.url_do+"/privilage/"+email;
	
			var opt = {
				method : 'get',
				url: doUrl,
				headers : {
					'X-Augipt-Gtwmutasi' : config.key_header_do,
					'X-Augipt-Trustmail': config.key_header_email
				}
			}
			let req = await axios(opt);
			let res = await req.data;
			return res;
		} catch (error) {
			if ([401, 422].includes(error.response.status)) {
				return error.response.data;
			}else{
				return {
					status: false,
					message: error.message
				}
			}
		}
	}

	async getMacaddres(where) {
		try {
			var doUrl = config.url_do+"/macaddres";
	
			var opt = {
				method : 'get',
				url: doUrl,
				params: where,
				headers : {
					'X-Augipt-Gtwmutasi' : config.key_header_do,
					'X-Augipt-Trustmail': config.key_header_email
				}
			}
			let req = await axios(opt);
			let res = await req.data;
			return res;
		} catch (error) {
			if ([401, 422].includes(error.response.status)) {
				return error.response.data;
			}else{
				return {
					status: false,
					message: error.message
				}
			}
		}
	}

}

module.exports = new DB();


