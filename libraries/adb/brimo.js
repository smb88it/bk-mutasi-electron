const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const tesseract = require("node-tesseract-ocr");
const os = require('os');
const tmp = require("tmp");
const blockhash = require("blockhash-core");
const { imageFromBuffer, getImageData } = require("@canvas/image");

class Brimo {
    constructor(client, data) {
        this.device = client.getDevice(data.deviceid);
        this.dir = {
            brimo: path.join(os.tmpdir(), "brimo-temp"),
            device: path.join(os.tmpdir(), "brimo-temp/"+data.deviceid),
            tmp: path.join(os.tmpdir(), "brimo-temp",data.deviceid,"tmp"),
            ss: path.join(os.tmpdir(), "brimo-temp",data.deviceid,"ss")
        }
        if (!fs.existsSync(this.dir.brimo)) fs.mkdirSync(this.dir.brimo);
        if (!fs.existsSync(this.dir.device)) fs.mkdirSync(this.dir.device);
        if (!fs.existsSync(this.dir.tmp)) fs.mkdirSync(this.dir.tmp);
        if (!fs.existsSync(this.dir.ss)) fs.mkdirSync(this.dir.ss);

        this.info = {
            username: data.username,
            norek: data.norek
        }

        this.cropImg = {
            top: data.crop_top,
            left: 0,
            width: 'auto',
            height: data.crop_bottom
        }

        this.dataSwipe = {
            x: data.slide_startX,
            y: data.slide_startY,
            x1: data.slide_endX,
            y1: data.slide_endY,
            time: data.slide_durasi
        }

        this.btnMutasi = {
            x: data.coordinate_X,
            y: data.coordinate_Y
        }

        this.timeAfterClick = data.delayAfterClick;

        this.jumlah = 0;

    }

    async halamanMutasi() {
        return await new Promise(async (resolve, reject) => {
            var tmpHalaman = tmp.fileSync({ keep: true, prefix: 'halamanBrimo-', postfix: '.png' });
            await this.device.screencap().then(e => {
                var pip = e.pipe(fs.createWriteStream(tmpHalaman.name));
                pip.on("finish", async () => {
                    var dt = await tesseract.recognize(pip.path, {
                        lang: "eng",
                        oem: 1,
                        psm: 4,
        
                    });

                    if (dt.toLocaleLowerCase().includes('cari mutasi')) {
                        tmpHalaman.removeCallback();
                        resolve({
                            status: true
                        })
                    }else{
                        tmpHalaman.removeCallback();
                        resolve({
                            status: false,
                            message: "Silahkan standby kan aplikasi BRImo pada halaman mutasi"
                        });
                    }
                    
                })
            }).catch(err => {
                resolve({
                    status: false,
                    message: err.message
                })
            })
        });
    }

    async clickMutasi() {
        try {
            var command = `input touchscreen swipe ${this.btnMutasi.x} ${this.btnMutasi.y} ${this.btnMutasi.x} ${this.btnMutasi.y}`;
            var x = await this.device.shell(command);
            var xx = await new Promise((resolve, reject) => setTimeout(() => resolve({status: true}), this.timeAfterClick));

            return await new Promise(async (resolve, reject) => {
                var tmpHalaman = tmp.fileSync({ keep: true, prefix: 'halamanBrimo-', postfix: '.png' });
                await this.device.screencap().then(e => {
                    var pip = e.pipe(fs.createWriteStream(tmpHalaman.name));
                    pip.on("finish", async () => {
                        var dt = await tesseract.recognize(pip.path, {
                            lang: "eng",
                            oem: 1,
                            psm: 4,
            
                        });
    
                        if (dt.toLocaleLowerCase().includes('belum ada catatan')) {
                            resolve({
                                status: true,
                                empty: true
                            });
                        }else if (dt.toLocaleLowerCase().includes('login')) {
                            resolve({
                                status: false,
                                message: "Aplikasi sudah logout, silahkan lakukan login kemabli."
                            });
                        }else{
                            resolve({
                                status: true,
                                empty: false
                            });
                        }
                        
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
    }

    async swipeDown() {
        try {
            var command = `input touchscreen swipe ${this.dataSwipe.x} ${this.dataSwipe.y} ${this.dataSwipe.x1} ${this.dataSwipe.y1} ${this.dataSwipe.time}`;
            var x = await this.device.shell(command);
            return await new Promise((resolve, reject) => setTimeout(() => resolve({status: true}), Number(this.dataSwipe.time)+500));
        } catch (error) {
            return {
                status: false,
                message: error.message
            }
        }
    }

    async swipeUp() {
        try {
            var command = `input touchscreen swipe ${this.dataSwipe.x1} ${this.dataSwipe.y1} ${this.dataSwipe.x} ${this.dataSwipe.y}`;
            var x = await this.device.shell(command);
            return await new Promise((resolve, reject) => setTimeout(() => resolve({status: true}), Number(this.dataSwipe.time)+500));
        } catch (error) {
            return {
                status: false,
                message: error.message
            }
        }
    }

    async screencap() {
        try {
            fs.rmSync(this.dir.tmp, {recursive: true, force: true});
            if (!fs.existsSync(this.dir.tmp)) fs.mkdirSync(this.dir.tmp);
            var last = null;
            for (let i = 0; i < 1000; i++) {
                var ftmp = fs.readdirSync(this.dir.tmp);
                var nameTmp = path.join(this.dir.tmp, ftmp.length+'.png');
                var check = await new Promise(async(solve, reject) => {
                    try {
                        await this.device.screencap().then(async(e) => {
                            var pip = await e.pipe(fs.createWriteStream(nameTmp));
                            pip.on("finish", async () => {
                                if (last != null) {
                                    const same = await this.looksSame(pip.path,last);
                                    if (same) {
                                        fs.unlinkSync(pip.path);
                                        solve({
                                            status: true,
                                            loop: false,
                                        })
                                    }else{
                                        solve({
                                            status: true,
                                            loop: true,
                                            data: pip.path
                                        })
                                    }
                                } else {
                                    solve({
                                        status: true,
                                        loop: true,
                                        data: pip.path
                                    })
                                }
                            })
                        })
                    } catch (error) {
                        solve({
                            status: false,
                            message: error.message
                        })
                    }
                });
    
                if (check.status) {
                    last = check.data;
                    if (check.loop) {
                        var sw = await this.swipeDown();
                        if (!sw.status) return sw;
                    }else{
                        break;
                    }
                } else {
                    return check;
                }
                
            }

            var ftmp = fs.readdirSync(this.dir.tmp);
            
            return {
                status: true,
                data: ftmp.length,
            }
        } catch (error) {
            console.log(error);
            return {
                status: false,
                message: error.message
            }
        }
    }

    async getText() {
        try {
            fs.rmSync(this.dir.ss, {recursive: true, force: true});
            if (!fs.existsSync(this.dir.ss)) fs.mkdirSync(this.dir.ss);
            var ftmp = fs.readdirSync(this.dir.tmp);

            var data = [];
            var durasi = 0;
            for (let i = 0; i < ftmp.length; i++) {
                const f = ftmp[i];
                var dir = path.join(this.dir.tmp, f);
                var out = path.join(this.dir.ss, f);
                var rpath = path.join(__dirname, "../readerImage.js");
                var child = fork(rpath, [
                    dir,
                    out,
                    this.cropImg.top,
                    this.cropImg.left,
                    this.cropImg.width,
                    this.cropImg.height
                ]);
                child.on("message", (res) => {
                    res = res.filter(e => {
                        var f = data.find(item => item.tanggal == e.tanggal && item.transaksi == e.transaksi && item.amount == e.amount);
                        return f === undefined;
                    });
                    data = data.concat(res);
                    this.jumlah += 1;
                });

                child.on("error", (err) => {
                    log.info(err.message);
                    throw err;
                })

                var su = await this.swipeUp();
            }

            var wait = await new Promise((resolve, reject) => {
                var x = setInterval(() => {
                    durasi += 1;
                    if (ftmp.length == this.jumlah) {
                        clearInterval(x);
                        resolve(this.jumlah);
                    }
                }, 1000);
            });

            data = data.sort((a,b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
            return {
                status: true,
                data: data,
                durasi
            }
        } catch (error) {
            log.info(error.message);
            return {
                status: false,
                message: error.message
            }
        }
    }

    async getPosition(text) {
        try {
            var ss = await this.device.screencap();
            var nameTmp = path.join(this.dir.tmp, 'check.png');
            var x = await new Promise((resolve, reject) => {
                ss.pipe(fs.createWriteStream(nameTmp));
                setTimeout(() => resolve(true), 1000);
            });
            
            // var dt = await tesseract.recognize(nameTmp, {
            //     lang: "eng",
            //     oem: 1,
            //     psm: 4,

            // });

            console.log(dt);

            // dt = dt.split("\r\n").map((v,i,arr) => {
            //     var key = arr[0].split("\t");
            //     var val = v.split("\t");
            //     var x = {};
            //     key.forEach((item, index) => {
            //     x[item] = val[index];
            //     });
            
            //     return x;
            // }).filter(e => e.text != '');

            return {
                status: true
            }
        } catch (error) {
            return {
                status: false,
                message: error.message
            }
        }
    }

    async looksSame(img1, img2) {
        try {
            const d1 = await this.readFile(img1);
            const d2 = await this.readFile(img2);
            const h1 = blockhash.bmvbhash(getImageData(d1), 16);
            const h2 = blockhash.bmvbhash(getImageData(d2), 16);

            var x = this.hexToBin(h1);
            var x1 = this.hexToBin(h2);
            return x == x1;
        } catch (error) {
            console.log(error);
        }
    }
      
    async readFile(path) {
        return new Promise((resolve, reject) => {
            fs.readFile(path, (err, data) => {
            if (err) reject(err);
            resolve(imageFromBuffer(data));
            });
        });
    }
      
    hexToBin(hexString) {
        const hexBinLookup = {
            0: "0000",
            1: "0001",
            2: "0010",
            3: "0011",
            4: "0100",
            5: "0101",
            6: "0110",
            7: "0111",
            8: "1000",
            9: "1001",
            a: "1010",
            b: "1011",
            c: "1100",
            d: "1101",
            e: "1110",
            f: "1111",
            A: "1010",
            B: "1011",
            C: "1100",
            D: "1101",
            E: "1110",
            F: "1111",
        };
        let result = "";
        for (let i = 0; i < hexString.length; i++) {
            result += hexBinLookup[hexString[i]];
        }
        return result;
    }
    
}

module.exports = Brimo