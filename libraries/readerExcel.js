const xlsx = require('node-xlsx').default;


const readerExcel = (dir) => {
    const hasil = {
        info: {
            nama: null,
            noRek: null,
            mataUang: "IDR",
            periode: null,
            tertanggal: null,
            saldoAwal: 0,
            saldoAkhir: 0
        },
        mutasi: []
    }
    const workSheetsFromFile = xlsx.parse(dir);
    
    workSheetsFromFile.forEach(e => {
        var data = e.data;
        if (e.name == "Sheet1") {
            hasil.info.nama = data[0][1];
            hasil.info.noRek = data[1][1].replaceAll(" ","");
            hasil.info.mataUang = data[2][1];
            hasil.info.periode = data[3][1];
            hasil.info.tertanggal = data[4][1];
        }
    
        if (e.name == "Sheet2") {
            var key = [ 'tanggal', 'transaksi', 'debet', 'kredit', 'saldo' ];
            var saldoAwal = data[1];
            var saldoAkhir = data.at(-2);
            hasil.mutasi = data.slice(2,-3).map(e => {
                var res = {};
                key.forEach((val, ind) => {
                    res[val] = e[ind] ?? "";
                });
    
                return res;
            })
    
            hasil.info.saldoAwal = saldoAwal.at(-1).replaceAll(" ", "");
            hasil.info.saldoAkhir = saldoAkhir.at(-1).replaceAll(" ", "");
        }
    });

    return hasil
}

module.exports = readerExcel;

