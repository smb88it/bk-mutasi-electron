const { google } = require('googleapis');

class GoogleSheet {
    constructor(opt) {
        this.cnf = opt;
        this.scopes = 'https://www.googleapis.com/auth/spreadsheets';
        this.auth = new google.auth.GoogleAuth({
            keyFile: this.cnf.keyFile,
            scopes: this.scopes,
        });
    }

    async getGoogleSheet() {
        const client = await this.auth.getClient();
        const googleSheet = google.sheets({ version: 'v4', auth: client });
        return googleSheet;
    }

    async getAll() {
        const googleSheet = await this.getGoogleSheet(this.auth);

        const getSheetData = await googleSheet.spreadsheets.values.get({
            auth: this.cnf.auth,
            spreadsheetId : this.cnf.spreadsheetId,
            range: this.cnf.range,
        });
        var data = getSheetData.data.values;
        if (data) data = data.map(e => {
            var x = {};
            this.cnf.keys.forEach((val,i) => {
                x[val] = e[i];
            });

            return x;
        })

        return data;
    }

    async getOne() {
        var data = await this.getAll();
        return [...data].shift();
    }

    async insert(newData) {
        try {
            const googleSheet = await this.getGoogleSheet(this.auth);
            await googleSheet.spreadsheets.values.clear({
                auth: this.cnf.auth,
                spreadsheetId: this.cnf.spreadsheetId,
                range: this.cnf.range,
            });
            var newDataInsert = newData.map(e => [e.tanggal, e.transaksi, e.amount, e.debet, e.kredit, e.type, e.saldo]);

            googleSheet.spreadsheets.values.append({
                auth: this.cnf.auth,
                spreadsheetId: this.cnf.spreadsheetId,
                range: this.cnf.range,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: newDataInsert,
                },
            });
            return {
                status: true,
            };
        } catch (error) {
            return {
                status: false,
                data: error.message
            };
        }
    }
}

module.exports = GoogleSheet;