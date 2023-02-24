const { firefox, chromium, webkit } = require("playwright");
const UserAgent = require("user-agents");
const Azcaptcha = require('../azcaptcha');
const config = require('../../config.json');
var HTMLParser = require('node-html-parser');
const moment = require("moment-timezone");
const readerExcel = require('../readerExcel');
const path = require("path");
const log = require('electron-log');

class bri {
    constructor(data, cnf) {
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
        this.browser = null;
        this.context = null;
        this.page = null;
        this.messageDialog = null;
        this.dataSaldo = null;
    }

    async createBrowser(tc = 0) {
        try {
            const $this = this;
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

            this.page.once('dialog', dialog => {
                console.log(`Dialog message: ${dialog.message()}`);
                this.messageDialog = dialog.message();
                dialog.dismiss().catch(() => {});
            });

            this.page.on('response', function(res) {
                if (res.url().includes('captcha')) {
                    res.body().then(async (e) => {
                        var base64 = e.toString('base64');
                        var az = new Azcaptcha();
                        var post = await az.post(base64);
                        if (post.status) {
                            var i = 1;
                            const intvGet = setInterval(async () => {
                                var get = await az.get(post.request);
                                if (get.status) {
                                    $this.captcha.text = get.request;
                                    clearInterval(intvGet);
                                }else{
                                    $this.captcha.error = true;
                                    $this.captcha.message = post.request;
                                }
                                if (i > 3) {
                                    clearInterval(intvGet);
                                    $this.captcha.error = true;
                                    $this.captcha.message = "captcha gak dapet terus dari azcaptcha"
                                }
                                i += 1;
                            }, 3000);
                        }else{
                            $this.captcha.error = true;
                            $this.captcha.message = post.request;
                        }
                    })
                }
            });

            await this.page.goto(this.config.url);
            const cek = await this.checkRejected();
            if (cek) return this.sendResponse(false, '', true);

            await this.page.waitForSelector('.header-wrap');
            await this.page.waitForTimeout(2000);
            var modal = await this.page.$$('.modal-content .close');
            if (modal.length > 0) {
                await this.page.locator('.modal-content .close').click();
            }

            await this.page.waitForSelector('input[placeholder="password"]');
            await this.page.locator('input[placeholder="password"]').click();
            var lang = await this.page.locator('input[name="j_language"]').inputValue();
            this.lang = lang == "en_EN" ? "en" : "id";

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
        if (this.captcha.text != null) {
            try {
                var trUsername = 'input[placeholder="user ID"], input[placeholder="username"]';
                var trPassword = 'input[placeholder="password"]';
                var trCaptcha = 'input[placeholder="validation"]';
                
                await this.page.locator(trUsername).dblclick();
                await this.page.locator(trUsername).type(this.data.username, {delay:this.getRandomDelay()});

                await this.page.locator(trPassword).click();
                await this.page.locator(trPassword).type(this.data.password, {delay:this.getRandomDelay()});

                await this.page.locator(trCaptcha).click();
                await this.page.locator(trCaptcha).type(this.captcha.text, {delay:this.getRandomDelay()});

                await this.page.locator('button[type="submit"]').click();
                await this.page.waitForURL(this.config.url_homepage);

                const cek = await this.checkRejected();
                if (cek) return this.sendResponse(false, '', true);

                var checkError = await this.page.$$("#errormsg-wrap");
                if (checkError.length > 0) {
                    var errText = await this.page.locator("#errormsg-wrap").textContent();
                    this.close = true;
                    return this.sendResponse(false, errText);
                }

                this.close = false;

                var iframemenu = this.page.frameLocator("#iframemenu");
                var user = await iframemenu.locator('.headerprofile .headinfowrap h3').textContent();
                await this.page.locator('#myaccounts').click();
                await this.page.waitForResponse(this.config.url_account);

                var txtSaldo = await iframemenu.locator("#saldo").textContent();
                console.log(txtSaldo);
                this.statusLogin = true;
                return this.sendResponse(true, user);
            } catch (error) {
                console.log("error login => ", error);
                return this.sendResponse(false, error.message);
            }
        }else{
            await this.page.waitForTimeout(1000);
            if (cb > 5) {
                return this.sendResponse(false, "captcha gak dapet terus dari azcaptcha");
            }else{
                return await this.login(cb+1);
            }
        }
    }

    async saldo() {
        this.close = false;
        try {
            var iframemenu = this.page.frameLocator("#iframemenu");
            var iframecontent = this.page.frameLocator("#content");
            await iframemenu.locator('a[href="BalanceInquiry.html"]').click();
            await this.page.waitForResponse(this.config.url_saldo);
            var table = await iframecontent.locator("#tabel-saldo").innerHTML();
            var parser = HTMLParser.parse(`<table>${table}<table>`);
            var data = parser.querySelector("tbody tr td:last-child").innerText;
            data = data.replaceAll("&nbsp", "").replaceAll(".","").replaceAll(",",".");

            var time = moment().tz(config.timezone).format("YYYY-MM-DD");
            this.dataSaldo = parseFloat(data);
            return this.sendResponse(true, "", false,{
                saldo: parseFloat(data),
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
            var iframemenu = this.page.frameLocator("#iframemenu");
            var iframecontent = this.page.frameLocator("#content");
            await iframemenu.locator('a[href="AccountStatement.html"]').click();
            await this.page.waitForResponse(this.config.url_mutasi);

            var time = moment().tz(config.timezone).format("YYYY-MM-DD");

            await iframecontent.locator("#ACCOUNT_NO").selectOption(this.data.norek);
            await this.page.waitForTimeout(2000);
            await iframecontent.locator('input[value="Download"]').first().click();
            const download = await this.page.waitForEvent("download");
            const downloadPath = await download.path();

            const dataConvert = readerExcel(downloadPath);

            return this.sendResponse(true, "", false, {
                data: dataConvert,
                time
            });
        } catch (error) {
            console.log("error mutasi => ", error);
            return this.sendResponse(false, error.message);
        }
    }

    async logout() {
        this.close = false;
        try {
            await this.page.locator('a[href="Logout.html"]').first().click();
            await this.page.waitForURL(this.config.url_logout);
            var thanks = await this.page.locator("#wrapper .thanks-text").textContent();
            await this.page.waitForTimeout(3000);
            console.log("logout berhasil => ", thanks);
            this.close = true;
            return this.sendResponse();
        } catch (error) {
            this.close = true;
            console.log("error logout", error);
            return this.sendResponse(false, error.message);
        }
    }

    async closeWindows() {
        if(this.context) this.context.close();
        if(this.browser) this.browser.close();
    }
}

module.exports = bri;