const { google } = require('googleapis');
const { authorize } = require('./sheetsAuth');

class SheetsService {
    constructor() {
        this.sheets = null;
    }

    async init() {
        const auth = await authorize();
        this.sheets = google.sheets({ version: 'v4', auth });
        return this;
    }

    /**
     * Tworzy arkusz "Ekipa" jeśli nie istnieje
     * Jeśli istnieje, nie robi nic
     */
    async ensureEkipaSheet(spreadsheetId) {
        // Pobierz wszystkie arkusze
        const res = await this.sheets.spreadsheets.get({ spreadsheetId });
        const ekipaSheet = res.data.sheets.find(
            (sheet) => sheet.properties.title === 'Ekipa'
        );

        if (ekipaSheet) {
            return ekipaSheet.properties.sheetId;
        }

        // Dodaj arkusz "Ekipa" jeśli nie istnieje
        const addReq = {
            spreadsheetId,
            resource: {
                requests: [
                    {
                        addSheet: {
                            properties: {
                                title: 'Ekipa',
                            },
                        },
                    },
                ],
            },
        };

        const resp = await this.sheets.spreadsheets.batchUpdate(addReq);
        // Nowo utworzony sheetId:
        const newSheetId = resp.data.replies[0].addSheet.properties.sheetId;
        return newSheetId;
    }

    /**
     * Czyści całą zawartość arkusza "Ekipa"
     */
    async clearEkipaSheet(spreadsheetId) {
        try {
            await this.sheets.spreadsheets.values.clear({
                spreadsheetId,
                range: 'Ekipa',
            });
            console.log('Wyczyszczono arkusz "Ekipa"');
            return true;
        } catch (error) {
            console.error('Błąd podczas czyszczenia arkusza:', error.message);
            return false;
        }
    }

    /**
     * Zapisuje dane pomocliskich do arkusza "Ekipa"
     * - sortuje dane alfabetycznie
     * - dodaje "-" na końcu listy
     */
    async writeDataToEkipaSheet(spreadsheetId, data) {
        try {
            // Upewnij się że arkusz jest
            await this.ensureEkipaSheet(spreadsheetId);

            // Wyczyść arkusz przed zapisem
            await this.clearEkipaSheet(spreadsheetId);

            // Sortuj dane alfabetycznie po nazwaPrzyjazna
            data.sort((a, b) => {
                const nameA = (a.nazwaPrzyjazna || '').toLowerCase();
                const nameB = (b.nazwaPrzyjazna || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });

            // Przekształć dane do formatu wymaganego przez Sheets API
            const values = [
                ...data.map(item => [
                    item.nazwaPrzyjazna || '',
                ]),
                ["-"],
            ];

            // Zapisz dane
            const updateRequest = {
                spreadsheetId,
                range: 'Ekipa!A1',
                valueInputOption: 'RAW',
                resource: {
                    values,
                },
            };

            await this.sheets.spreadsheets.values.update(updateRequest);
            console.log('Dane zapisane do arkusza "Ekipa"');

            return true;
        } catch (error) {
            console.error('Błąd podczas zapisywania danych:', error.message);
            return false;
        }
    }

    /**
     * Sprawdza czy link do arkusza jest poprawny
     * i zwraca ID arkusza
     */
    extractSpreadsheetId(sheetUrl) {
        const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        return match ? match[1] : null;
    }
}

module.exports = SheetsService;