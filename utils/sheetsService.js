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
     * Tworzy nowy arkusz o nazwie "Ekipa" w podanym dokumencie
     */
    async createEkipaSheet(spreadsheetId) {
        try {
            // Najpierw sprawdź czy arkusz istnieje
            const res = await this.sheets.spreadsheets.get({ spreadsheetId });
            const ekipaSheet = res.data.sheets.find(
                (sheet) => sheet.properties.title === 'Ekipa'
            );

            if (ekipaSheet) {
                // Jeśli arkusz istnieje, wyczyść jego zawartość zamiast usuwać
                console.log('Arkusz "Ekipa" już istnieje, czyszczenie zawartości...');
                await this.clearEkipaSheet(spreadsheetId);
                return true;
            }

            // Jeśli arkusz nie istnieje, utwórz nowy
            const request = {
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

            await this.sheets.spreadsheets.batchUpdate(request);
            console.log('Utworzono nowy arkusz "Ekipa"');
            return true;
        } catch (error) {
            console.error('Błąd podczas tworzenia/czyszczenia arkusza:', error);
            return false;
        }
    }

    /**
     * Usuwa arkusz "Ekipa" z dokumentu
     */
    async deleteEkipaSheet(spreadsheetId) {
        try {
            // Pobierz wszystkie arkusze
            const res = await this.sheets.spreadsheets.get({ spreadsheetId });

            // Znajdź arkusz "Ekipa"
            const ekipaSheet = res.data.sheets.find(
                (sheet) => sheet.properties.title === 'Ekipa'
            );

            if (ekipaSheet) {
                // Usuń arkusz
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    resource: {
                        requests: [
                            {
                                deleteSheet: {
                                    sheetId: ekipaSheet.properties.sheetId,
                                },
                            },
                        ],
                    },
                });

                console.log('Usunięto istniejący arkusz "Ekipa"');
                return true;
            }
        } catch (error) {
            console.error('Błąd podczas usuwania arkusza:', error.message);
        }

        return false;
    }

    /**
     * Zapisuje dane pomocliskich do arkusza "Ekipa"
     * Teraz z dodatkową funkcjonalnością:
     * - sortuje dane alfabetycznie
     * - dodaje "-" na końcu listy
     * - usuwa puste kolumny i wiersze
     */
    async writeDataToEkipaSheet(spreadsheetId, data) {
        try {
            // Najpierw pobierz informacje o arkuszu, aby znaleźć jego sheetId
            const sheetInfo = await this.sheets.spreadsheets.get({
                spreadsheetId,
            });

            const ekipaSheet = sheetInfo.data.sheets.find(
                (sheet) => sheet.properties.title === 'Ekipa'
            );

            if (!ekipaSheet) {
                console.error('Nie znaleziono arkusza "Ekipa"');
                return false;
            }

            // Sortuj dane alfabetycznie po nazwaPrzyjazna
            data.sort((a, b) => {
                const nameA = (a.nazwaPrzyjazna || a.nazwaUnikalna || '').toLowerCase();
                const nameB = (b.nazwaPrzyjazna || b.nazwaUnikalna || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });

            // Przekształć dane do formatu wymaganego przez Sheets API
            const values = [
                ...data.map(item => [
                    item.nazwaPrzyjazna || item.nazwaUnikalna || '',
                ]),
                // Dodaj "-" na końcu listy
                ["-"],
            ];

            // Użyj append zamiast update
            const appendRequest = {
                spreadsheetId,
                range: 'Ekipa!A1',
                valueInputOption: 'RAW',
                insertDataOption: 'OVERWRITE', // Można użyć 'INSERT_ROWS' aby wstawiać nowe wiersze
                resource: {
                    values,
                },
            };

            await this.sheets.spreadsheets.values.append(appendRequest);
            console.log('Dane dodane do arkusza "Ekipa"');

            return true;
        } catch (error) {
            console.error('Błąd podczas zapisywania danych:', error.message);
            return false;
        }
    }
    /**
     * Czyści zawartość arkusza "Ekipa"
     * Używane do resetowania danych przed ponownym zapisem
     */
    async clearEkipaSheet(spreadsheetId) {
        try {
            await this.sheets.spreadsheets.values.clear({
                spreadsheetId,
                range: 'Ekipa!A:Z', // Czyści wszystkie kolumny w arkuszu
            });
            console.log('Wyczyszczono arkusz "Ekipa"');
            return true;
        } catch (error) {
            console.error('Błąd podczas czyszczenia arkusza:', error);
            return false;
        }
    }

    /**
     * Sprawdza czy link do arkusza jest poprawny
     * i zwraca ID arkusza
     */
    extractSpreadsheetId(sheetUrl) {
        // Typowy URL Sheets: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
        const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        return match ? match[1] : null;
    }
}

module.exports = SheetsService;