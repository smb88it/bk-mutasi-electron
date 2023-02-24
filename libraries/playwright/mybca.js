const {app, BrowserWindow} = require('electron');

const { firefox, chromium, webkit } = require("playwright");
const UserAgent = require("user-agents");
const config = require('../../config.json');
const moment = require("moment-timezone");
const path = require("path");
const log = require('electron-log');

class mybca {
    constructor(data, cnf, browser) {
        this.app = app;
        this.data = data;
        this.info = {
            username: data.username,
            norek: data.norek
        }
        this.config = config.data_bank.find(e => e.code == data.bank);
        this.cnf = cnf;
        this.executablePath = {
            chromium: path.join(cnf.exeDir,"browser/chromium/chrome-win/chrome.exe"),
            firefox: path.join(cnf.exeDir,"browser/firefox/firefox/firefox.exe"),
            webkit: path.join(cnf.exeDir,"browser/webkit/Playwright.exe"),
        }
        this.captcha = {
            text: null,
            error: false,
            message: ''
        }
        this.error = false;
        this.statusLogin = false;
        this.close = true;
        this.lang = "id";
        this.browser = browser;
        this.context = null;
        this.page = null;
        this.messageDialog = null;
        this.dataSaldo = null;
        this.time = moment().tz(config.timezone).format("YYYY-MM-DD");
    }

    async createBrowser(tc = 0) {
        try {
            const userAgent = new UserAgent({ deviceCategory: 'desktop' });
            var opt = {
                headless: this.data.showBrowser == undefined ? false : this.data.showBrowser
            };
            if (this.data.proxyStatus) opt.proxy = {
                server: this.data.proxyIp,
                username: this.data.proxyUsername,
                password: this.data.proxyPassword
            }
            var tb = this.data.typeBrowser;
            if (tb == undefined) {
                if(!this.cnf.dev) opt.executablePath = this.executablePath.chromium;
                this.browser = await chromium.launch(opt);
            }else{
                if(tb == "chromium") {
                    if(!this.cnf.dev) opt.executablePath = this.executablePath.chromium;
                    this.browser = await chromium.launch(opt);
                }else if(tb == "firefox") {
                    if(!this.cnf.dev) opt.executablePath = this.executablePath.firefox;
                    this.browser = await firefox.launch(opt);
                }else if(tb == "safari") {
                    if(!this.cnf.dev) opt.executablePath = this.executablePath.webkit;
                    this.browser = await webkit.launch(opt);
                }else{
                    if(!this.cnf.dev) opt.executablePath = this.executablePath.chromium;
                    this.browser = await chromium.launch(opt);
                }
            }
            
            this.context = await this.browser.newContext({
                userAgent: userAgent.toString(),
            });
            
            this.context.setDefaultNavigationTimeout(60000);
            this.context.setDefaultTimeout(60000);
            this.page = await this.context.newPage();

            await this.page.goto(this.config.url);

            await this.page.waitForSelector('input[name="username"]').then(e => e.click());

            this.close = false;
            return this.sendResponse();
            
        } catch (error) {
            log.info(error);
            console.log(error);
            return this.sendResponse(false, error.message);
        }
    }

    getRandomDelay() {
        var x = Math.floor(Math.random() * 200);
        if (x < 100) return x+100;
        return x;
    }

    async sendResponse(st = true, msg = '', rejected = false, data = {}) {
        if(this.close) await this.closeWindows();
        return {
            status: st,
            message: msg,
            rejected,
            data
        };
    }

    async checkRejected() {
        const titleGet = await this.page.waitForSelector("title", {state: "attached"});
        const title = await titleGet.textContent();
        return title.toLocaleLowerCase().includes('request rejected');
    }

    async login(cb = 0) {
        try {
            await this.page.focus('input[name="username"]');
            await this.page.keyboard.type(this.data.username);
            // await this.page.keyboard.type("SKYMULAN250817");

            await this.page.focus('input[name="password"]');
            await this.page.keyboard.type(this.data.password);
            // await this.page.keyboard.type("@Cepalansuhendar08041994");
            
            await this.page.click('button[type="submit"]');
            
            const res = await new Promise(async (resolve, reject) => {
                await this.page.waitForResponse(async res => {
                    if (res.url().includes('bca-id/login')) {
                        try {
                            var resJson = await res.json();
                            if (res.status() == 200) {
                                resolve({
                                    status: true,
                                    data: resJson
                                })
                            }else if(res.status() == 400){
                                resolve({
                                    status: false,
                                    data: resJson.error_schema.error_message.indonesian
                                })
                            }else{
                                resolve({
                                    status: false,
                                    data: "error ambil data json, pada saat login"
                                })
                            }
                        } catch (error) {
                            resolve({
                                status: false,
                                message: error.message
                            })
                        }
                    }
    
                    return res.url().includes('bca-id/login');
                })
            })

            if (!res.status) {
                this.close = true;
                return this.sendResponse(false, res.message);
            }

            await this.page.waitForSelector('a[href="/profile/balance"]');
            this.statusLogin = true;
            return this.sendResponse(true, res.data.output_schema.full_name);
        } catch (error) {
            console.log("error login => ", error);
            return this.sendResponse(false, error.message);
        }
    }

    async saldo() {
        this.close = false;
        try {

            await this.page.click('a[href="/profile/balance"]');
            const res = await new Promise(async (resolve, reject) => {
                await this.page.waitForResponse(async res => {
                    if (res.url().includes('api/account/getAccountTotal')) {
                        try {
                            var resJson = await res.json();
                            if (res.status() == 200) {
                                resolve({
                                    status: true,
                                    data: resJson
                                })
                            }else if(res.status() == 400){
                                resolve({
                                    status: false,
                                    data: resJson.error_schema.error_message.indonesian
                                })
                            }else{
                                resolve({
                                    status: false,
                                    data: "error ambil data json, pada saat get saldo"
                                })
                            }
                        } catch (error) {
                            resolve({
                                status: false,
                                message: error.message
                            })
                        }
                    }
    
                    return res.url().includes('api/account/getAccountTotal');
                })
            })

            if (!res.status) {
                this.close = true;
                return this.sendResponse(false, res.message);
            }

            var time = moment(res.data.localDateTime, "YYYY-MM-DD hh:mm:ss").format("YYYY-MM-DD");
            this.dataSaldo = parseFloat(res.data.totalBalance);
            return this.sendResponse(true, "", false,{
                saldo: parseFloat(res.data.totalBalance),
                time
            });
        } catch (error) {
            console.log("error saldo => ", error);
            this.error = true;
            return this.sendResponse(false, error.message);
        }
    }

    async mutasi() {
        this.close = false;
        try {
            var y = moment().tz(config.timezone).format("YYYY");
            var m = moment().tz(config.timezone).locale('id').format("MMMM");
            var d = moment().tz(config.timezone).format("D");
            // await this.page.click('.list-group.list-group-menu.d-lg-none .list-group-header');
            await this.page.click('a[href="/profile/statement"]');
            await this.page.waitForResponse(e => e.url().includes('api/account/myAccountDetailSaving'));
            await this.page.waitForTimeout(10000);
            await this.page.click('input[name="duration"]');
            await this.page.waitForTimeout(500);
            await this.page.click('.bs-datepicker-head .current:not(.ng-star-inserted)');

            await this.page.click('.bs-datepicker-body table.years tbody tr td:is(:text("'+y+'")), :text("'+y+'")');
            await this.page.click('.bs-datepicker-body table.months tbody tr td:is(:text("'+m+'")), :text("'+m+'")');
            await this.page.click('.bs-datepicker-body table.days tbody tr td:is(:text("'+d+'")), :text("'+d+'")');
            await this.page.click('.bs-datepicker-body table.days tbody tr td:is(:text("'+d+'")), :text("'+d+'")');
            await this.page.click('button[type="submit"]:is(:text("Tampilkan")), :text("Tampilkan")');

            const res = await new Promise(async (resolve, reject) => {
                await this.page.waitForResponse(async res => {
                    if (res.url().includes('api/account/myAccountDetailSaving')) {
                        try {
                            var resJson = await res.json();
                            if (res.status() == 200) {
                                resolve({
                                    status: true,
                                    data: resJson
                                })
                            }else if(res.status() == 400){
                                resolve({
                                    status: false,
                                    data: resJson.error_schema.error_message.indonesian
                                })
                            }else{
                                resolve({
                                    status: false,
                                    data: "error ambil data json, pada saat get saldo"
                                })
                            }
                        } catch (error) {
                            resolve({
                                status: false,
                                message: error.message
                            })
                        }
                    }
    
                    return res.url().includes('api/account/myAccountDetailSaving');
                })
            })

            if (!res.status) {
                this.close = true;
                return this.sendResponse(false, res.message);
            }

            var status = res.data.errorMessage.toLocaleLowerCase().includes('sukses');
            var saldoAkhir = 0;
            var data = [];
            if (status) {
                saldoAkhir = parseFloat(res.data.startingBalance);
                data = res.data.transactionData.map(e => {
                    var date = e.trxDt.toLocaleLowerCase().includes('pend') ? res.data.startDate : moment(e.trxDt, "DD/MM").format("YYYY-MM-DD");
                    var type = e.txnType.toLocaleLowerCase();
                    var amount = parseFloat(e.txnAmount);
                    saldoAkhir = type == 'c' ? (saldoAkhir+amount) : (saldoAkhir-amount)
                    return {
                        tanggal: date,
                        transaksi: e.trailer,
                        debet: type == 'c' ? 0 : amount,
                        kredit: type == 'c' ? amount : 0,
                        saldo: saldoAkhir,
                        amount: amount,
                        type: type == 'c' ? "CR" : "DB",
                    }
                });

                this.dataSaldo = saldoAkhir-50000;
            }

            return this.sendResponse(true, "", false, {
                data: {
                    mutasi: data
                },
                time: res.data.startDate
            });
        } catch (error) {
            console.log("error mutasi => ", error);
            return this.sendResponse(false, error.message);
        }
    }

    async refreshMutasi(){
        this.close = false;
        try {
            await this.page.click('button[type="submit"]:is(:text("Tampilkan")), :text("Tampilkan")');

            const res = await new Promise(async (resolve, reject) => {
                await this.page.waitForResponse(async res => {
                    if (res.url().includes('api/account/myAccountDetailSaving')) {
                        try {
                            var resJson = await res.json();
                            if (res.status() == 200) {
                                resolve({
                                    status: true,
                                    data: resJson
                                })
                            }else if(res.status() == 400){
                                resolve({
                                    status: false,
                                    data: resJson.error_schema.error_message.indonesian
                                })
                            }else{
                                resolve({
                                    status: false,
                                    data: "error ambil data json, pada saat get saldo"
                                })
                            }
                        } catch (error) {
                            resolve({
                                status: false,
                                message: error.message
                            })
                        }
                    }
    
                    return res.url().includes('api/account/myAccountDetailSaving');
                })
            })

            if (!res.status) {
                this.close = true;
                return this.sendResponse(false, res.message);
            }

            var status = res.data.errorMessage.toLocaleLowerCase().includes('sukses');
            var saldoAkhir = 0;
            var data = [];
            if (status) {
                saldoAkhir = parseFloat(res.data.startingBalance);
                data = res.data.transactionData.map(e => {
                    var date = e.trxDt.toLocaleLowerCase().includes('pend') ? res.data.startDate : moment(e.trxDt, "DD/MM").format("YYYY-MM-DD");
                    var type = e.txnType.toLocaleLowerCase();
                    var amount = parseFloat(e.txnAmount);
                    saldoAkhir = type == 'c' ? (saldoAkhir+amount) : (saldoAkhir-amount)
                    return {
                        tanggal: date,
                        transaksi: e.txnName+" - "+e.trailer,
                        debit: type == 'c' ? 0 : amount,
                        credit: type == 'c' ? amount : 0,
                        saldo: saldoAkhir,
                        amount: amount,
                        type: type == 'c' ? "CR" : "DB",
                    }
                });

                this.dataSaldo = saldoAkhir-50000;
            }

            return this.sendResponse(true, "", false, {
                data: {
                    mutasi: data
                },
                time: res.data.startDate
            });
        } catch (error) {
            console.log("error mutasi => ", error);
            return this.sendResponse(false, error.message);
        }
    }

    async logout() {
        this.close = true;
        try {
            await this.page.click('.container-lg .navbar-collapse .nav-item a:is(:text("Keluar")), :text("Keluar"), :text("KELUAR")');
            await this.page.waitForResponse(e => e.url().includes('api/logout'));
            await this.page.waitForTimeout(2000);
            return this.sendResponse();
        } catch (error) {
            console.log("error logout", error);
            return this.sendResponse(false, error.message);
        }
    }

    async closeWindows() {
        if(this.context) this.context.close();
        if(this.browser) this.browser.close();
    }
}

module.exports = mybca;