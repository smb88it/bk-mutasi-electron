const {app, BrowserWindow, ipcMain, Menu, dialog} = require('electron');
const log = require('electron-log');
const { autoUpdater } = require("electron-updater");
const isDev = require("electron-is-dev");
const path = require("path");
const os = require('os');
const tmp = require('tmp');
const util = require('util');
const childProcess = require('child_process');
const { fork } = require('child_process');
const exec = util.promisify(childProcess.exec);
const serverAuth = fork(`${__dirname}/pages/login/server.js`);
const TEN_MEGABYTES = 1000 * 1000 * 10;
const storage = require('electron-json-storage');
const GoogleSheet = require("./libraries/googleSheet");
const PW = require('./libraries/playwright');
const DB = require('./libraries/db');
const pjson = require('./package.json');
const macaddress = require('macaddress');
const config = require('./config.json');
let macDevice = null;
const activeWindow = require('active-win');
const adb = require('@devicefarmer/adbkit');
const adbClient = adb.Adb.createClient();
const sharp = require('sharp');
const fs = require("fs");
const adblib = require('./libraries/adb');
const moment = require("moment-timezone");
const tesseract = require("node-tesseract-ocr");

const exeDir = app.getPath("exe").replace("SMB Bottifire.exe","");
tmp.setGracefulCleanup();
if (!isDev) {
    app.commandLine.appendSwitch("log-file", path.join(exeDir, "log.txt"));
    app.commandLine.appendSwitch("enable-logging");
}

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
let winAuth, listRekening, winMac, winTools, playwright = {}, browser, dataTemp = [];

const win = {
    auth: () => {
        winAuth = new BrowserWindow({
            width: 520,
            height: 670,
            frame: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: true,
                nativeWindowOpen: true,
                preload: path.join(__dirname, 'preload/authentication.js')
            },
            resizable: false,
        });
        winAuth.on('closed', () => winAuth = null);
        winAuth.loadURL(config.urlAuth);
    
        winAuth.webContents.setWindowOpenHandler(() => {
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    autoHideMenuBar: true,
                    alwaysOnTop: true
                }
            }
        });
        
        winAuth.webContents.session.clearCache();
        winAuth.webContents.session.clearStorageData();
        // winAuth.webContents.openDevTools();
    },
    listRekening: async () => {
        listRekening = new BrowserWindow({
            width: 1000,
            frame: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            },
            resizable: false
        });
        listRekening.on('closed', () => listRekening = null);
        listRekening.loadURL(`file://${__dirname}/pages/list-rekening.html`);
        // listRekening.webContents.openDevTools();
    },
    mac: () => {
        winMac = new BrowserWindow({
            width: 1000,
            frame: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            },
            resizable: false
        });
        winMac.on('closed', () => winMac = null);
        winMac.loadURL(`file://${__dirname}/pages/mac-addres.html`);
        // winMac.webContents.openDevTools();
    },
    tools: async () => {
        winTools = new BrowserWindow({
            width: 1000,
            frame: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            },
            resizable: false
        });
        winTools.on('closed', () => winTools = null);
        winTools.loadURL(`file://${__dirname}/pages/tools.html`);
        // winTools.webContents.openDevTools();
    }
}

const localStorage = {
    session: {
        get: () => {
            return storage.getSync('sessionAccount');
        },
        put: (data) => {
            storage.set('sessionAccount', data, function(error) {
                if (error) throw error;
            });
        },
    },
    rekening: {
        get: () => {
            return storage.getSync('dataRekening');
        },
        put: (data) => {
            storage.set('dataRekening', data, function(error) {
                if (error) throw error;
            });
        },
        active: () => {
            var data = localStorage.rekening.get();
            return data.find(e => e.status);
        }
    },
    devices: {
        get: () => {
            return storage.getSync('dataDevices');
        },
        put: (data) => {
            storage.set('dataDevices', data, function(error) {
                if (error) throw error;
            });
        },
        download: async () => {
            const win = BrowserWindow.getFocusedWindow();
            const { canceled, filePaths } = await dialog.showOpenDialog(win, {
                properties: ['openDirectory']
            });
            if (!canceled) {
                var dr = path.join(filePaths[0], "setting-devices.json");
                var data = localStorage.devices.get();
                fs.writeFileSync(dr, JSON.stringify(data));
                var msg = "Data berhasil di download, lokasi downloadnya => "+dr;
                BrowserWindow.getFocusedWindow().webContents.send("message:info", msg);
            }
        },
        upload: (path) => {
            var data = localStorage.devices.get();
            fs.readFile(path, (err, dt) => {
                if (err) {
                    BrowserWindow.getFocusedWindow().webContents.send("message:error", err.message);
                } else {
                    dt = JSON.parse(dt);
                    dt.forEach(e => {
                        var check = data.find(x => x.deviceResolusi == e.deviceResolusi && x.bank == e.bank);
                        if (check) {
                            var i = data.indexOf(check);
                            data[i] = check;
                        }else{
                            data.push(e);
                        }
                    });

                    localStorage.devices.put(data);
                    BrowserWindow.getFocusedWindow().webContents.send("device:setting:upload", data);
                }
            })
        }
    },
    clear: () => {
        storage.clear(function(error) {
            if (error) throw error;
        });
    },
    has: () => {
        storage.has('dataRekening', function(error, hasKey) {
            if (error) throw error;
          
            if (!hasKey) {
                storage.set('dataRekening', [], function(error) {
                    if (error) throw error;
                });
            }
        });
        storage.has('sessionAccount', function(error, hasKey) {
            if (error) throw error;
          
            if (!hasKey) {
                storage.set('sessionAccount', {}, function(error) {
                    if (error) throw error;
                });
            }
        });
        storage.has('dataDevices', function(error, hasKey) {
            if (error) throw error;
          
            if (!hasKey) {
                storage.set('dataDevices', [], function(error) {
                    if (error) throw error;
                });
            }
        });
    },
    clearTmp: async () => {
        dataTemp.forEach(e => e.removeCallback());
        dataTemp = [];
    }
}

const robot = {
    sendMessage: (data, message, error, runInterval = false) => {
        listRekening.webContents.send("change-status", {
            username: data.username,
            error: error,
            message: message,
            runInterval
        });
    },
    play: async (data, cb = 0) => {
        try {
            var session = localStorage.session.get();
            if (session.bank == "brimo") {
                await RobotAdb.brimo(data);
            }else{
                const opt = {
                    dev: isDev,
                    exeDir
                }
                const usr = localStorage.session.get();
                let pw = new PW[usr.bank](data, opt, browser);
                playwright[data.username] = pw;
                const br = await pw.createBrowser();
                var msg = "Sedang membuat browser. percobaan ke "+(cb+1);
                robot.sendMessage(data, msg, false);
                if (br.status) {
                    robot.sendMessage(data, "Mencoba Login sabar ya gan...", false);
                    const lg = await pw.login();
                    if (lg.status) {
                        robot.sendMessage(data, "Login berhasil dengan user, "+lg.message, false);
                        setTimeout(async () => {
                            robot.sendMessage(data, "Lagi coba ambil saldo, "+lg.message, false);
                            await robot.saldo(data);
                            setTimeout(async () => {
                                if (!pw.error) {
                                    robot.sendMessage(data, "Lagi coba ambil mutasi, "+lg.message, false);
                                    await robot.mutasi(data);
                                }
                            }, 1000);
                        }, 1000);
                    }else{
                        if (lg.rejected) {
                            delete playwright[data.username];
                            if (cb > 5) {
                                msg = "Silahkan ganti Proxy atau ganti type browser. Jika masih berlanjut silahkan coba 30 menit lagi untuk proxy ini.";
                                robot.sendMessage(data, msg, true);
                            }else{
                                robot.sendMessage(data, msg, false);
                                await robot.play(cb+1);
                            }
            
                        }else{
                            if (pw.close) {
                                robot.sendMessage(data, lg.message, true);
                                delete playwright[data.username];
                            }else{
                                robot.sendMessage(data, "Lagi coba logout ", false);
                                const logout = await pw.logout();
                                if (logout.status) {
                                    robot.sendMessage(data, lg.message, true);
                                }else{
                                    robot.sendMessage(data, logout.message, true);
                                }
                                delete playwright[data.username];
                            }
                        }
                    }
                }else{
                    if (br.rejected) {
                        delete playwright[data.username];
                        if (cb > 5) {
                            msg = "Silahkan ganti Proxy atau ganti type browser. Jika masih berlanjut silahkan coba 30 menit lagi untuk proxy ini.";
                            robot.sendMessage(data, msg, true);
                        }else{
                            robot.sendMessage(data, msg, false);
                            await robot.play(data, cb+1);
                        }
                    }else{
                        robot.sendMessage(data, br.message, true);
                        delete playwright[data.username];
                    }
                }
            }
        } catch (error) {
            log.info(error);
            robot.sendMessage(data, error.message, true);
        }
    },
    stop: async (data) => {
        var tr = playwright[data.username];
        if (tr) {
            tr.closeWindows();
            delete playwright[data.username];
        }
    },
    saldo: async (data) => {
        const pw = playwright[data.username];
        const sl = await pw.saldo();
        const info = pw.info;
        if (sl.status) {
            robot.sendMessage(data, "Sedang upload data saldo ke DB", false);
            var usr = localStorage.session.get();
            const saveSaldo = await DB.saveData({
                data: {
                    info,
                    saldo: sl.data.saldo
                },
                norek: data.norek,
                username: data.username,
                email: usr.email,
                time: sl.data.time
            }, "saldo", usr.bank);
            if (saveSaldo.status) {
                robot.sendMessage(data, "Berhasil upload data saldo ke DB", false);
            }else{
                robot.sendMessage(data, "mencoba logout", false);
                var lg = await pw.logout();
                if (lg.status) {
                    robot.sendMessage(data, saveSaldo.message, true);
                } else {
                    robot.sendMessage(data, lg.message, true);
                }
            }

        }else{
            var msg = "ada error pada get saldo. ini error nya => "+sl.message;
            robot.sendMessage(data, msg, true);
            setTimeout(async () => {
                robot.sendMessage(data, "Lagi coba logout", true);
                const lg = await pw.logout();
                if (lg.status) {
                    robot.sendMessage(data, msg, true);
                }else{
                    robot.sendMessage(data, lg.message, true);
                }
                delete playwright[data.username];
            }, 1000);
        }
    },
    mutasi: async (data) => {
        robot.sendMessage(data, "Sedang ambil data mutasi", false);
        const pw = playwright[data.username];
        const mt = await pw.mutasi();
        const info = pw.info;
        const saldo = pw.dataSaldo;
        if (mt.status) {
            robot.sendMessage(data, "Sedang upload data mutasi ke DB", false);
            var usr = localStorage.session.get();
            var dt = [];
            if (usr.bank == "bri") dt = mt.data.data.mutasi.map(e => {
                e.type = e.debet != "" || e.debet > 0 ? "DB" : "CR";
                e.amount = e.debet == "" ? e.debet : e.credit;
                return e;
            });

            if (usr.bank == "mybca") dt = mt.data.data.mutasi;
            const saveMutasi = await DB.saveData({
                data: {
                    info,
                    saldo,
                    mutasi: dt
                },
                norek: data.norek,
                username: data.username,
                email: usr.email,
                time: mt.data.time
            }, "mutasi", usr.bank);

            if (saveMutasi.status) {
                if (data.statusGoogleSheet) {
                    robot.sendMessage(data, "Sedang upload data mutasi ke Google Sheet", false, false);
                    const gsheet = new GoogleSheet({
                        keyFile: path.join(__dirname, "libraries/augpt-credential.json"),
                        spreadsheetId: data.spreadsheetId,
                        range: data.range,
                        keys: ["tanggal","transaksi","debet","kredit","saldo"],
                    })

                    const gs = await gsheet.insert(dt);
                    if (gs.status) {
                        robot.sendMessage(data, "Berhasil upload data mutasi ke Google Sheet", false, true);
                    }else{
                        robot.sendMessage(data, "mencoba logout", false);
                        var lg = await pw.logout();
                        if (lg.status) {
                            robot.sendMessage(data, gs.message, true);
                        } else {
                            robot.sendMessage(data, lg.message, true);
                        }
                    }
                }else{
                    robot.sendMessage(data, "Berhasil upload data mutasi ke DB", false, true);
                }
            }else{
                robot.sendMessage(data, "mencoba logout", false);
                var lg = await pw.logout();
                if (lg.status) {
                    robot.sendMessage(data, saveMutasi.message, true);
                } else {
                    robot.sendMessage(data, lg.message, true);
                }
            }

        }else{
            var msg = "ada error pada get mutasi. ini error nya => "+mt.message;
            robot.sendMessage(data, msg, false);
            setTimeout(async () => {
                robot.sendMessage(data, "Lagi coba logout", false);
                const lg = await pw.logout();
                if (lg.status) {
                    robot.sendMessage(data, msg, true);
                }else{
                    robot.sendMessage(data, lg.message, true);
                }
                delete playwright[data.username];
            }, 1000);
        }
    },
    logout: async (username) => {
        var usr = localStorage.session.get();
        if (usr.bank == "brimo") {
            robot.sendMessage({username}, "Berhasil logout", true);
        }else{
            const pw = playwright[username];
            const data = {username};
            robot.sendMessage(data, "Lagi coba logout", false);
            const lg = await pw.logout();
            if (lg.status) {
                robot.sendMessage(data, "Berhasil logout", true);
            }else{
                robot.sendMessage(data, lg.message, true);
            }
            delete playwright[data.username];
        }
    },
    refreshMutasi: async (data) => {
        robot.sendMessage(data, "Sedang ambil data mutasi", false);
        const pw = playwright[data.username];
        const mt = await pw.refreshMutasi();
        const info = pw.info;
        const saldo = pw.dataSaldo;
        if (mt.status) {
            robot.sendMessage(data, "Sedang upload data mutasi ke DB", false);
            var usr = localStorage.session.get();
            var dt = [];
            if (usr.bank == "bri") dt = mt.data.data.mutasi.map(e => {
                e.type = e.debet != "" || e.debet > 0 ? "DB" : "CR";
                e.amount = e.debet == "" ? e.debet : e.credit;
                return e;
            });

            if (usr.bank == "mybca") dt = mt.data.data.mutasi;
            const saveMutasi = await DB.saveData({
                data: {
                    info,
                    saldo,
                    mutasi: dt
                },
                norek: data.norek,
                username: data.username,
                email: usr.email,
                time: mt.data.time
            }, "mutasi", usr.bank);

            if (saveMutasi.status) {
                if (data.statusGoogleSheet) {
                    robot.sendMessage(data, "Sedang upload data mutasi ke Google Sheet", false, false);
                    const gsheet = new GoogleSheet({
                        keyFile: path.join(__dirname, "libraries/augpt-credential.json"),
                        spreadsheetId: data.spreadsheetId,
                        range: data.range,
                        keys: ["tanggal","transaksi","debet","kredit","saldo"],
                    })

                    const gs = await gsheet.insert(dt);
                    if (gs.status) {
                        robot.sendMessage(data, "Berhasil upload data mutasi ke Google Sheet", false, true);
                    }else{
                        robot.sendMessage(data, "mencoba logout", false);
                        var lg = await pw.logout();
                        if (lg.status) {
                            robot.sendMessage(data, gs.message, true);
                        } else {
                            robot.sendMessage(data, lg.message, true);
                        }
                    }
                }else{
                    robot.sendMessage(data, "Berhasil upload data mutasi ke DB", false, true);
                }
            }else{
                robot.sendMessage(data, "mencoba logout", false);
                var lg = await pw.logout();
                if (lg.status) {
                    robot.sendMessage(data, saveMutasi.message, true);
                } else {
                    robot.sendMessage(data, lg.message, true);
                }
            }

        }else{
            var msg = "ada error pada get mutasi. ini error nya => "+mt.message;
            robot.sendMessage(data, msg, false);
            setTimeout(async () => {
                robot.sendMessage(data, "Lagi coba logout", false);
                const lg = await pw.logout();
                if (lg.status) {
                    robot.sendMessage(data, msg, true);
                }else{
                    robot.sendMessage(data, lg.message, true);
                }
                delete playwright[data.username];
            }, 1000);
        }
    },
    refreshSaldo: async (data) => {
        const pw = playwright[data.username];
        const sl = pw.dataSaldo;
        const time = pw.time;
        const info = pw.info;
        robot.sendMessage(data, "Sedang upload data saldo ke DB", false);
        var usr = localStorage.session.get();
        const saveSaldo = await DB.saveData({
            data: {
                info,
                saldo: sl
            },
            norek: data.norek,
            username: data.username,
            email: usr.email,
            time: time
        }, "saldo", usr.bank);
        if (saveSaldo.status) {
            robot.sendMessage(data, "Berhasil upload data saldo ke DB", false);
        }else{
            robot.sendMessage(data, "mencoba logout", false);
            var lg = await pw.logout();
            if (lg.status) {
                robot.sendMessage(data, saveSaldo.message, true);
            } else {
                robot.sendMessage(data, lg.message, true);
            }
        }
    },
    interval: async (data) => {
        var usr = localStorage.session.get();
        if (usr.bank == "brimo") {
            await RobotAdb.brimo(data);
        }else{
            const pw = playwright[data.username];
            if (usr.bank == "bri") {
                await robot.saldo(data);
                if (!pw.error) await robot.mutasi(data);
            }
    
            if (usr.bank == "mybca") {
                await robot.refreshMutasi(data);
                if (!pw.error) await robot.refreshSaldo(data);
            }
        }
    }
}

const RobotAdb = {
    track: async () => {
        try {
            const tracker = await adbClient.trackDevices();
            tracker.on('add', (device) => BrowserWindow.getFocusedWindow().webContents.send("device:add", device));
            tracker.on('remove', (device) => BrowserWindow.getFocusedWindow().webContents.send("device:remove", device));
            tracker.on('end', () => console.log('Tracking stopped'));
        } catch (err) {
            BrowserWindow.getFocusedWindow().webContents.send("message:error", "Ada masalah ketika listen ADB, ini errornya. "+ err.stack);
        }
    },
    resolusi: async (id) => {
        try {
            const device = adbClient.getDevice(id);
            return await new Promise((solve, reject) => {
                try {
                    device.shell('wm size').then(adb.Adb.util.readAll).then(e => {
                        var x = e.toString().trim().replaceAll("Physical size: ", "").split("x");
                        solve({
                            status: true,
                            data: {
                                w: Number(x[0]),
                                h: Number(x[1])
                            }
                        })
                    })
                } catch (error) {
                    reject({
                        status: false,
                        message: error.message
                    })
                }
            })

        } catch (error) {
            return {
                status: false,
                message: error.message
            }
        }
    },
    slide: async (data) => {
        try {
            const device = adbClient.getDevice(data.id);
            return await new Promise((solve, reject) => {
                try {
                    var command = `input touchscreen swipe ${data.start.x} ${data.start.y} ${data.end.x} ${data.end.y} ${data.durasi}`;
                    device.shell(command).then(e => {
                        solve({
                            status: true,
                        })
                    })
                } catch (error) {
                    reject({
                        status: false,
                        message: error.message
                    })
                }
            })

        } catch (error) {
            return {
                status: false,
                message: error.message
            }
        }
    },
    click: async (data) => {
        try {
            const device = adbClient.getDevice(data.id);
            return await new Promise((solve, reject) => {
                try {
                    var command = `input touchscreen swipe ${data.x} ${data.y} ${data.x} ${data.y}`;
                    device.shell(command).then(e => {
                        solve({
                            status: true,
                        })
                    })
                } catch (error) {
                    reject({
                        status: false,
                        message: error.message
                    })
                }
            })

        } catch (error) {
            return {
                status: false,
                message: error.message
            }
        }
    },
    crop: async (data) => {
        try {
            const {id, top, bottom} = data;
            const device = adbClient.getDevice(id);
            await localStorage.clearTmp();
            return await new Promise(async (resolve, reject) => {
                var tmpBefore = tmp.fileSync({ keep: true, prefix: 'before-', postfix: '.png' });
                var tmpAfter = tmp.fileSync({ keep: true, prefix: 'after-', postfix: '.png' });
                dataTemp.push(tmpBefore);
                dataTemp.push(tmpAfter);
                await device.screencap().then(e => {
                    var pip = e.pipe(fs.createWriteStream(tmpBefore.name));
                    pip.on("finish", async () => {
                        var imgsharp = sharp(pip.path);
                        var metafirst = await imgsharp.metadata();
                        sharp(pip.path).extract({
                            top: Number(top),
                            left: 0,
                            width: metafirst.width,
                            height: (metafirst.height-Number(top))-Number(bottom)
                        }).toFile(tmpAfter.name).then(data => {
                            resolve({
                                status: true,
                                data: {
                                    before: pip.path,
                                    after: tmpAfter.name
                                }
                            })
                        }).catch(err => {
                            resolve({
                                status: false,
                                message: err.message
                            })
                        })
                        
                    })
                }).catch(err => {
                    resolve({
                        status: false,
                        message: err.message
                    })
                })
            });
        } catch (error) {
            return {
                status: false,
                message: error.message
            }
        }
    },
    ocr: async (data) => {
        try {
            if (data.type == "computer") {
                const win = winTools;
                const { canceled, filePaths } = await dialog.showOpenDialog(win, {
                    properties: ['openFile'],
                    filters: [
                        {
                            name: 'Images', extensions: ['jpg', 'png', 'gif']
                        }
                    ]

                });
                if (canceled) {
                    winTools.webContents.send("ocr:cancel");
                }else{
                    var prog = 20;
                    var loading = true;
                    winTools.webContents.send("ocr:progres", {
                        text: "Sedang merubah gambar menjadi text.",
                        prog: prog
                    });
                    const file = filePaths[0];
                    const intProg = setInterval(() => {
                        prog += 5;
                        winTools.webContents.send("ocr:progres", {
                            text: "Sedang merubah gambar menjadi text.",
                            prog: prog
                        });
                        if (prog >= 100) {
                            clearInterval(intProg);
                            loading = false;
                        }
                    }, 1000);
                    var dt = await tesseract.recognize(file, {
                        lang: "eng",
                        oem: 1,
                        psm: 4,
                    });
                    
                    prog = 95;
                    setTimeout(() => {
                        winTools.webContents.send("ocr:hasil", {
                            text:dt,
                            data: data,
                            img: file
                        });
                    }, 1000);
                }
            }else if(data.type == "hp") {
                var prog = 20;
                var loading = true;
                winTools.webContents.send("ocr:progres", {
                    text: "Sedang mengambil gambar dari HP.",
                    prog: prog
                });
                var intProg = setInterval(() => {
                    prog += 5;
                    winTools.webContents.send("ocr:progres", {
                        text: "Sedang mengambil gambar dari HP.",
                        prog: prog
                    });
                    if (prog >= 100) {
                        clearInterval(intProg);
                        loading = false;
                    }
                }, 1000);

                const device = adbClient.getDevice(data.device);
                localStorage.clearTmp();
                const ss = await new Promise(async (resolve, reject) => {
                    var tmpBefore = tmp.fileSync({ keep: true, prefix: 'ss-', postfix: '.png' });
                    dataTemp.push(tmpBefore);
                    await device.screencap().then(e => {
                        var pip = e.pipe(fs.createWriteStream(tmpBefore.name));
                        pip.on("finish", async () => {
                            resolve({
                                status: true,
                                path: pip.path
                            });
                        })
                    }).catch(err => {
                        resolve({
                            status: false
                        })
                    })
                });

                if (ss.status) {
                    prog = 95;
                    setTimeout(async () => {
                        prog = 20;
                        loading = true;
                        winTools.webContents.send("ocr:progres", {
                            text: "Sedang merubah gambar menjadi text.",
                            prog: prog
                        });
                        intProg = setInterval(() => {
                            prog += 5;
                            winTools.webContents.send("ocr:progres", {
                                text: "Sedang merubah gambar menjadi text.",
                                prog: prog
                            });
                            if (prog >= 100) {
                                clearInterval(intProg);
                                loading = false;
                            }
                        }, 1000);
                        
                        var dt = await tesseract.recognize(ss.path, {
                            lang: "eng",
                            oem: 1,
                            psm: 4,
                        });
                        prog = 95;
                        setTimeout(() => {
                            winTools.webContents.send("ocr:hasil", {
                                text:dt,
                                data: data,
                                img: ss.path
                            });
                        }, 1000);
                    }, 1000);
                }else{
                    loading = false;
                    prog = 95;
                    localStorage.clearTmp();
                    winTools.webContents.send("ocr:cancel");
                }
            }else{
                winTools.webContents.send("ocr:cancel");
            }
            
        } catch (error) {
            console.log(error.message);
            winTools.webContents.send("ocr:cancel");
        }
    },
    brimo: async (data) => {
        try {
            const brimo = new adblib.Brimo(adbClient, data);
            const info = brimo.info;
            const time = moment().tz(config.timezone).format("YYYY-MM-DD");
            const usr = localStorage.session.get();
            robot.sendMessage(data, "Sedang mengecek halaman mutasi dari device "+ data.deviceid, false);
            const halamanMutasi = await brimo.halamanMutasi();
            if (halamanMutasi.status) {
                robot.sendMessage(data, "Lagi loading mutasi", false);
                const clickMutasi = await brimo.clickMutasi();
                if (clickMutasi.status) {
                    if (clickMutasi.empty) {
                        robot.sendMessage(data, "Lagi coba upload data ke DB", false);
                        const saveMutasi = await DB.saveData({
                            data: {
                                info,
                                saldo: 0,
                                mutasi: []
                            },
                            norek: data.norek,
                            username: data.username,
                            email: usr.email,
                            time: time
                        }, "mutasi", data.bank);
            
                        if (saveMutasi.status) {
                            if (data.statusGoogleSheet) {
                                robot.sendMessage(data, "Sedang upload data mutasi ke Google Sheet", false, false);
                                const gsheet = new GoogleSheet({
                                    keyFile: path.join(__dirname, "libraries/augpt-credential.json"),
                                    spreadsheetId: data.spreadsheetId,
                                    range: data.range,
                                    keys: ["tanggal","transaksi","debet","kredit","saldo"],
                                })
            
                                const gs = await gsheet.insert(dt);
                                if (gs.status) {
                                    robot.sendMessage(data, "Berhasil upload data mutasi ke Google Sheet", false, true);
                                }else{
                                    robot.sendMessage(data, gs.message, true);
                                }
                            }else{
                                robot.sendMessage(data, "Berhasil upload data mutasi ke DB", false, true);
                            }
                        }else{
                            robot.sendMessage(data, saveMutasi.message, true);
                        }
                    }else{
                        robot.sendMessage(data, "Lagi mengumpulkan gambar", false);
                        const screencap = await brimo.screencap();
                        if (screencap.status) {
                            robot.sendMessage(data, "Lagi mengubah gambar menjadi text", false);
                            const getText = await brimo.getText();
                            if (getText.status) {
                                robot.sendMessage(data, "Lagi coba upload data ke DB", false);
                                const saveMutasi = await DB.saveData({
                                    data: {
                                        info,
                                        saldo: 0,
                                        mutasi: getText.data
                                    },
                                    norek: data.norek,
                                    username: data.username,
                                    email: usr.email,
                                    time: time
                                }, "mutasi", data.bank);
                                if (saveMutasi.status) {
                                    if (data.statusGoogleSheet) {
                                        robot.sendMessage(data, "Sedang upload data mutasi ke Google Sheet", false, false);
                                        const gsheet = new GoogleSheet({
                                            keyFile: path.join(__dirname, "libraries/augpt-credential.json"),
                                            spreadsheetId: data.spreadsheetId,
                                            range: data.range,
                                            keys: ["tanggal","transaksi","debet","kredit","saldo"],
                                        })
                    
                                        const gs = await gsheet.insert(dt);
                                        if (gs.status) {
                                            robot.sendMessage(data, "Berhasil upload data mutasi ke Google Sheet", false, true);
                                        }else{
                                            robot.sendMessage(data, gs.message, true);
                                        }
                                    }else{
                                        robot.sendMessage(data, "Berhasil upload data mutasi ke DB", false, true);
                                    }
                                }else{
                                    robot.sendMessage(data, saveMutasi.message, true);
                                }
                            } else {
                                robot.sendMessage(data, getText.message, true);   
                            }
                        } else {
                            robot.sendMessage(data, screencap.message, true);   
                        }
                    }
                } else {
                    robot.sendMessage(data, clickMutasi.message, true);
                }
            } else {
                robot.sendMessage(data, halamanMutasi.message, true);
            }
        } catch (error) {
            log.info(error);
            robot.sendMessage(data, error.message, true);
        }
    }
}

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

ipcMain.on("version", (e) => e.returnValue = app.getVersion())
       .on("close", () => app.quit())
       .on("minimize", () => BrowserWindow.getFocusedWindow().minimize())
       .on("fullscreen", () => {
            if (BrowserWindow.getFocusedWindow().isMaximized()) {
                BrowserWindow.getFocusedWindow().restore();
            } else {
                BrowserWindow.getFocusedWindow().maximize();
            }
        });

ipcMain.on("session:put", (e, data) => localStorage.session.put(data))
       .on("session:get", (e) => e.returnValue = localStorage.session.get())
       .on("session:clearTmp", () => localStorage.clearTmp());

ipcMain.on("rekening:get", (e) => e.returnValue = localStorage.rekening.get())
       .on("rekening:put", (e, data) => localStorage.rekening.put(data));

ipcMain.on("db:privilage", async (e, data) => {
    var privilage = await DB.privilage(data.email);
    e.reply("db:privilage", {
        data,
        res: privilage
    });
}).on("db:macaddres", async (e, data) => {
    var opt = {
        username: data.email,
        situs: data.situs,
        macaddres: macDevice
    };
    var macaddres = await DB.getMacaddres(opt)
    e.reply("db:macaddres", {
        data,
        res: macaddres,
        mac: macDevice,
    });
})

ipcMain.on("win:listRekening", () => {
    if (winAuth) winAuth.close();
    if (winMac) winMac.close();
    if (winTools) winTools.close();
    win.listRekening();
}).on("win:auth", () => {
    if (listRekening) listRekening.close();
    if (winMac) winMac.close();
    if (winTools) winTools.close();
    win.auth();
}).on("win:macAddress", () => {
    if (winAuth) winAuth.close();
    if (listRekening) listRekening.close();
    if (winTools) winTools.close();
    win.mac();
}).on("win:tools", () => {
    if (listRekening) listRekening.close();
    if (winAuth) winAuth.close();
    if (winMac) winMac.close();
    win.tools();
});

ipcMain.on("device:get", async (e) => {
    const devices = await adbClient.listDevices();
    e.reply("device:get", devices);
}).on("device:resolusi", async (e, id) => {
    var x = await RobotAdb.resolusi(id);
    if (x.status) {
        e.reply("device:resolusi", x.data);
    } else {
        e.reply("message:error", x.message);    
    }
}).on("device:slide", async (e, data) => {
    var x = await RobotAdb.slide(data);
    if (!x.status) e.reply("message:error", x.message);
}).on("device:click", async (e, data) => {
    var x = await RobotAdb.click(data);
    if (!x.status) e.reply("message:error", x.message);
}).on("device:crop", async (e, data) => {
    var x = await RobotAdb.crop(data);
    e.reply("device:crop", x);
}).on("device:setting:get", (e) => e.returnValue = localStorage.devices.get())
  .on("device:setting:put", (e, data) => localStorage.devices.put(data))
  .on("device:setting:download", (e, data) => localStorage.devices.download())
  .on("device:setting:upload", (e, path) => localStorage.devices.upload(path))
  .on("device:ocr", (e, data) => RobotAdb.ocr(data));

ipcMain.on("robot:play", (e, data) => robot.play(data))
       .on("robot:stop", (e, data) => robot.stop(data))
       .on("robot:interval", (e, data) => robot.interval(data))
       .on("robot:logout", (e, username) => robot.logout(username));

ipcMain.on("update:check", () => autoUpdater.checkForUpdates())
       .on("update:download", () => autoUpdater.downloadUpdate())
       .on("update:install", () => autoUpdater.quitAndInstall());

autoUpdater.on('checking-for-update', () => {
    log.info("Tunggu yah, lagi di check...");
    BrowserWindow.getFocusedWindow().webContents.send("autoUpdater:message", {
        message: "Tunggu yah, lagi di check...",
        close: false,
        update: false,
        install: false,
        prog: 0
    });
}).on("update-not-available", (info) => {
    log.info("Update not available", info);
    BrowserWindow.getFocusedWindow().webContents.send("autoUpdater:message", {
        message: "Aplikasi sudah yang terbaru. versi terakhir "+info.version,
        close: true,
        update: false,
        install: false,
        prog: 0
    });
}).on("update-available", (info) => {
    log.info("Update Available", info);
    BrowserWindow.getFocusedWindow().webContents.send("autoUpdater:message", {
        message: "Ada update nih... versi terbaru "+info.version,
        close: false,
        update: true,
        install: false,
        prog: 0
    });
}).on("download-progress", (prog) => {
    var percent = Math.ceil(prog.percent);
    var transferred = formatBytes(prog.transferred);
    var total = formatBytes(prog.total);

    BrowserWindow.getFocusedWindow().webContents.send("autoUpdater:message", {
        message: "Downloaded "+transferred+" / "+total,
        close: false,
        update: false,
        install: false,
        prog: percent
    });
}).on("update-downloaded", (info) => {
    BrowserWindow.getFocusedWindow().webContents.send("autoUpdater:message", {
        message: "Download berhasil, apakah anda ingin langsung menginstal ??",
        close: false,
        update: false,
        install: true,
        prog: 0
    });
});

app.on('ready', async function() {
    var winActive = await activeWindow.getOpenWindows();
    var nm = isDev ? 'electron' : pjson.name;
    winActive = winActive.filter(e => e.owner.name.toLowerCase().includes(nm) && !e.title.toLowerCase().includes('developer'));
    if(winActive.length > 0) {
        try {
            if (process.platform !== "darwin") {
                var pid = winActive[0].owner.processId;
                var dir = path.join(isDev ? __dirname : exeDir, isDev ? "focusWin.bat" : "libraries/focusWin.bat");
                childProcess.execSync(`${dir} "${pid}" ""`, (error, stdout, stderr) => {
                    if (error) {
                        log.info(error);
                        throw error;
                    }
                    if (stderr) log.info(stderr);
                    log.info(stdout);
                })
            }
            setTimeout(() => app.quit(), 1000);
        } catch (error) {
            log.info(error);
            app.quit();
            throw error;
        }
        
    }else{
        macaddress.all(function (err, all) {
            all = Object.keys(all).map(e => all[e].mac);
            macDevice = all[0];
        });
        macDevice = await macaddress.one();
        localStorage.has();
        win.auth();
    }

    await RobotAdb.track();
});

app.on("before-quit", async () => {
    await localStorage.clearTmp();
})

app.on('window-all-closed', () => {
    if (process.platform !== "darwin") {
        app.quit();
        serverAuth.kill('SIGINT');
    }
});
