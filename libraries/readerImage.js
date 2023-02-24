const tesseract = require("node-tesseract-ocr");
const sharp = require('sharp');
const moment = require('moment-timezone');

(async () => {
    var date = moment().tz('Asia/Bangkok').format("DD/MM/YYYY");
    var first = moment().tz('Asia/Bangkok').locale("id").format("MMMM YYYY");
    var dirIn = process.argv[2];
    var dirOut = process.argv[3];
    var crop = {
        top: process.argv[4],
        left: process.argv[5],
        with: process.argv[6],
        height: process.argv[7]
    }
    var imgsharp = sharp(dirIn);
    var metafirst = await imgsharp.metadata();
    await sharp(dirIn).extract({
        top: Number(crop.top),
        left: Number(crop.left),
        width: crop.with == 'auto' ? metafirst.width : Number(crop.with),
        height: (metafirst.height-Number(crop.top))-(crop.height == 'auto' ? 0 : Number(crop.height))
    }).toFile(dirOut);

    var dt = await tesseract.recognize(dirOut, {
        lang: "eng",
        oem: 1,
        psm: 4,
    });

    if (dt.toLocaleLowerCase().includes('cari mutasi')) dt = dt.split(first+'\r\n')[1];
    dt = dt.split('\r\n').filter(e => e != '').reduce((a,b) => {
        if (typeof a == "string") a = [[a]];
        var i = a.length;
        if (b.includes(date)) {
            a[i-1].push(b);
            a.push([]);
        }else{
            a[i-1].push(b);
        }

        return a;
    }).filter(e => {
        var found = e.join("").toLocaleLowerCase().match(/rp\d/gm);
        return e.length > 1 && found != null && e.join(",").includes(date);
    }).map(x => {
        var matchRp = x.find(e => e.toLowerCase().match(/rp\d/g));
        var matchDate = x.find(e => e.toLowerCase().match(/\d\d\W\d\d\W\d\d\d\d/g));
        var indexRp = matchRp ? x.findIndex(e => e == matchRp) : 0;
        var indexDate = matchDate ? x.findIndex(e => e == matchDate) : x.length;
        var newData = x.filter((e, i) => i <= indexDate && i >= indexRp);
        if (newData.length == 0) return null;
        var l1 = matchRp.split("Rp");
        var transaksi = l1[0];
        var amount = Number(l1[1].replaceAll('.','').replaceAll(',','.'));
        var type = transaksi.includes("+") ? "CR" : "DB";
        var debit = transaksi.includes("+") ? 0 : amount;
        var credit = transaksi.includes("+") ? amount : 0;
        var saldo = 0;
        transaksi = transaksi.replaceAll("+", "").replaceAll("-", "");
        var tanggal = matchDate.substr(0,21).replaceAll(" | ", " ");
        transaksi = transaksi+newData.filter((x, i) => i != 0 && i != (newData.length - 1)).join(" ");

        return {
            tanggal: moment(tanggal, "DD/MM/YYYY HH:mm:ss").format("YYYY-MM-DD HH:mm:ss"),
            transaksi,
            debit,
            credit,
            type,
            amount,
            saldo
        } 
    }).filter(e => e != null);
    process.send(dt);
})()