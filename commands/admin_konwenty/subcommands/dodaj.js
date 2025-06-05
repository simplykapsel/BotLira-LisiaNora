const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { Konwent } = require('../../../models');

// Wczytaj konfigurację bezpośrednio
const config = require('../../../config/service-account.json');

/**
 * Parsuje datę w formacie dd.mm.rrrr
 * @param {string} dateString Data w formacie dd.mm.rrrr
 * @returns {Date|null} Obiekt Date lub null jeśli format jest nieprawidłowy
 */
function parseDate(dateString) {
    const dateRegex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
    const match = dateString.match(dateRegex);

    if (!match) return null;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // Miesiące są indeksowane od 0
    const year = parseInt(match[3], 10);

    const date = new Date(year, month, day);

    // Sprawdź czy data jest prawidłowa
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}

/**
 * Sprawdza czy wartość jest godziną w formacie "HH:MM" lub "HH"
 * @param {any} value Wartość do sprawdzenia
 * @returns {boolean} Czy wartość jest godziną
 */
function isTimeString(value) {
    if (!value) return false;

    const str = String(value).trim();

    // Format "HH:MM"
    if (/^\d{1,2}:\d{2}$/.test(str)) {
        return true;
    }

    // Format "HH"
    if (/^\d{1,2}$/.test(str)) {
        return true;
    }

    // Format dziesiętny (ułamek doby)
    const num = Number(str);
    if (!isNaN(num) && num >= 0 && num < 1) {
        return true;
    }

    return false;
}

module.exports = async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    try {
        console.log("=== DEBUG: Rozpoczęto komendę dodaj ===");
        // Pobierz parametry
        const nazwa = interaction.options.getString('nazwa');
        const dataStartString = interaction.options.getString('data_start');
        const dataKoniecString = interaction.options.getString('data_koniec');
        const linkDoczek = interaction.options.getString('link_doczek');

        console.log(`DEBUG: Parametry: nazwa=${nazwa}, dataStart=${dataStartString}, dataKoniec=${dataKoniecString}, link=${linkDoczek}`);

        // Parsuj daty
        let dataStart = parseDate(dataStartString);
        if (!dataStart) {
            console.log(`DEBUG: Nieprawidłowa data rozpoczęcia: ${dataStartString}`);
            return interaction.editReply(`Data rozpoczęcia "${dataStartString}" jest nieprawidłowa. Użyj formatu dd.mm.rrrr (np. 01.06.2025)`);
        }
        // Ustaw godzinę 00:00:00.000
        dataStart.setHours(0, 0, 0, 0);
        console.log(`DEBUG: Data rozpoczęcia po ustawieniu czasu: ${dataStart.toISOString()}`);

        let dataKoniec = parseDate(dataKoniecString);
        if (!dataKoniec) {
            console.log(`DEBUG: Nieprawidłowa data zakończenia: ${dataKoniecString}`);
            return interaction.editReply(`Data zakończenia "${dataKoniecString}" jest nieprawidłowa. Użyj formatu dd.mm.rrrr (np. 03.06.2025)`);
        }
        // Ustaw godzinę 23:59:59.999
        dataKoniec.setHours(23, 59, 59, 999);
        console.log(`DEBUG: Data zakończenia po ustawieniu czasu: ${dataKoniec.toISOString()}`);

        // Walidacja dat
        if (dataStart > dataKoniec) {
            console.log(`DEBUG: Data rozpoczęcia (${dataStartString}) jest późniejsza niż data zakończenia (${dataKoniecString})`);
            return interaction.editReply('Data rozpoczęcia konwentu nie może być późniejsza niż data zakończenia!');
        }

        // Walidacja linku do Google Sheets
        if (!linkDoczek.includes('docs.google.com/spreadsheets')) {
            console.log(`DEBUG: Nieprawidłowy link do arkusza: ${linkDoczek}`);
            return interaction.editReply('Podany link nie prowadzi do arkusza Google Sheets!');
        }

        // Wyciągnij ID arkusza z URL
        const matches = linkDoczek.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!matches || !matches[1]) {
            console.log(`DEBUG: Nie można wyodrębnić ID arkusza z linku: ${linkDoczek}`);
            return interaction.editReply('Nie udało się wyodrębnić ID arkusza z podanego linku!');
        }
        const spreadsheetId = matches[1];
        console.log(`DEBUG: Wyodrębniono ID arkusza: ${spreadsheetId}`);

        // Inicjalizacja JWT dla Google API
        const serviceAccountAuth = new JWT({
            email: config.client_email,
            key: config.private_key,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/drive.file',
                'https://spreadsheets.google.com/feeds',
                'https://www.googleapis.com/auth/drive.readonly'
            ],
        });

        // Sprawdzenie dostępu do arkusza
        try {
            console.log(`DEBUG: Próba dostępu do arkusza ${spreadsheetId}`);
            const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
            await doc.loadInfo();
            console.log(`DEBUG: Pomyślnie załadowano arkusz '${doc.title}'`);

            // Sprawdź czy arkusz ma odpowiednią strukturę
            const sheetTitles = doc.sheetsByIndex.map(sheet => sheet.title);
            console.log(`DEBUG: Znalezione zakładki: ${sheetTitles.join(', ')}`);

            // Sprawdź czy jest zakładka Ustawienia
            if (!sheetTitles.includes('Ustawienia')) {
                console.log(`DEBUG: Brak zakładki 'Ustawienia'`);
                return interaction.editReply('Arkusz nie zawiera wymaganej zakładki "Ustawienia"!');
            }

            // Znajdź wszystkie arkusze z harmonogramem (wszystkie oprócz "Ustawienia", "Ekipa" i "WSZYSTKO")
            const harmonogramSheets = doc.sheetsByIndex.filter(sheet => {
                const title = sheet.title;
                return title !== 'Ustawienia' && title !== 'Ekipa' && title !== 'WSZYSTKO';
            });

            console.log(`DEBUG: Znaleziono ${harmonogramSheets.length} potencjalnych arkuszy z harmonogramem: ${harmonogramSheets.map(s => s.title).join(', ')}`);

            if (harmonogramSheets.length === 0) {
                console.log(`DEBUG: Nie znaleziono żadnych arkuszy z harmonogramem`);
                return interaction.editReply('Arkusz nie zawiera żadnych zakładek z harmonogramem!');
            }

            // Sprawdź czy w arkuszach z harmonogramem jest odpowiednia struktura
            let poprawnyFormatZnaleziony = false;
            console.log(`DEBUG: Rozpoczynam sprawdzanie struktury arkuszy`);

            for (const sheet of harmonogramSheets) {
                console.log(`DEBUG: Sprawdzam arkusz '${sheet.title}'`);
                try {
                    // Wczytaj wiersze arkusza
                    console.log(`DEBUG: Pobieranie wierszy z arkusza ${sheet.title}`);
                    const rows = await sheet.getRows();
                    console.log(`DEBUG: Pobrano ${rows.length} wierszy z arkusza ${sheet.title}`);

                    // Flagi do sprawdzenia czy znaleźliśmy dni i godziny
                    let znalezionoDzien = false;
                    let znalezionoGodzine = false;
                    let znalezionoOsobe = false;

                    // Debugowanie - wypisz pierwsze kilka wierszy
                    console.log(`DEBUG: Pierwsze wiersze arkusza ${sheet.title}:`);
                    for (let i = 0; i < Math.min(10, rows.length); i++) {
                        console.log(`DEBUG: Wiersz ${i}: ${JSON.stringify(rows[i]._rawData)}`);
                    }

                    // Sprawdź wiersze (zawartość, nie pozycję w arkuszu)
                    for (let i = 0; i < rows.length; i++) {
                        const row = rows[i];

                        // Dzień (kolumna A)
                        if (row._rawData[0]) {
                            const wartoscDzien = String(row._rawData[0]).trim().toLowerCase();
                            console.log(`DEBUG: Wiersz ${i}, dzień: '${wartoscDzien}'`);
                            if (['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'].includes(wartoscDzien)) {
                                console.log(`DEBUG: Znaleziono dzień tygodnia w wierszu ${i}: '${wartoscDzien}'`);
                                znalezionoDzien = true;
                            }
                        }

                        // Godzina (kolumna B)
                        if (row._rawData[1]) {
                            const wartoscGodzina = row._rawData[1];
                            console.log(`DEBUG: Wiersz ${i}, godzina: '${wartoscGodzina}'`);
                            if (isTimeString(wartoscGodzina)) {
                                console.log(`DEBUG: Znaleziono wartość czasu w wierszu ${i}: '${wartoscGodzina}'`);
                                znalezionoGodzine = true;
                            }
                        }

                        // Sprawdź kolumny z osobami (w zakresie ilości osób dyżurujących)
                        // Pobierz informacje z arkusza Ustawienia
                        const settingsSheet = doc.sheetsByTitle['Ustawienia'];
                        const settingsRows = await settingsSheet.getRows();

                        // Znajdź ilość osób dyżurujących
                        let iloscOsobDyzurujacych = 2; // domyślnie 2

                        for (let j = 0; j < settingsRows.length; j++) {
                            const settingsRow = settingsRows[j];
                            if (settingsRow._rawData[0] === 'Ilość osób dyżurujących') {
                                iloscOsobDyzurujacych = Number(settingsRow._rawData[1]);
                                break;
                            }
                        }

                        console.log(`DEBUG: Znaleziono 'Ilość osób dyżurujących': ${iloscOsobDyzurujacych}`);

                        // Sprawdź osoby w kolumnach od C do C+iloscOsobDyzurujacych
                        for (let j = 2; j < 2 + iloscOsobDyzurujacych; j++) {
                            if (j >= row._rawData.length) break; // Upewnij się, że nie przekraczamy granic tablicy

                            const osoba = row._rawData[j];
                            if (osoba &&
                                String(osoba).trim() !== '' &&
                                String(osoba).trim() !== '-' &&
                                String(osoba).trim() !== 'NIE RUSZAĆ!' &&
                                String(osoba).trim() !== 'Ilość godzin') {
                                console.log(`DEBUG: Wiersz ${i}, osoba: '${osoba}' w kolumnie ${String.fromCharCode(65 + j)}`);
                                znalezionoOsobe = true;
                            }
                        }
                    }

                    console.log(`DEBUG: Status weryfikacji arkusza '${sheet.title}': dzień=${znalezionoDzien}, godzina=${znalezionoGodzine}, osoba=${znalezionoOsobe}`);

                    // Jeśli znaleźliśmy wszystkie wymagane elementy
                    if (znalezionoDzien && znalezionoGodzine && znalezionoOsobe) {
                        poprawnyFormatZnaleziony = true;
                        console.log(`DEBUG: Znaleziono poprawny format w arkuszu ${sheet.title}`);
                        break;
                    }

                } catch (error) {
                    console.error(`DEBUG: Błąd podczas weryfikacji arkusza ${sheet.title}:`, error);
                }
            }

            console.log(`DEBUG: Status końcowy weryfikacji: poprawnyFormatZnaleziony=${poprawnyFormatZnaleziony}`);

            if (!poprawnyFormatZnaleziony) {
                console.log("DEBUG: Nie znaleziono arkusza z poprawnym formatem");
                return interaction.editReply('Nie znaleziono arkusza z odpowiednią strukturą harmonogramu. Arkusz powinien zawierać dni tygodnia w kolumnie A, godziny w kolumnie B oraz osoby dyżurujące od kolumny C.');
            }

            // Pobierz informacje z arkusza Ustawienia
            console.log(`DEBUG: Pobieranie informacji z arkusza Ustawienia`);
            const settingsSheet = doc.sheetsByTitle['Ustawienia'];
            const settingsRows = await settingsSheet.getRows();

            // Znajdź ilość osób dyżurujących
            console.log(`DEBUG: Szukam 'Ilość osób dyżurujących' w arkuszu Ustawienia`);
            let iloscOsobDyzurujacych = null;

            for (let i = 0; i < settingsRows.length; i++) {
                const row = settingsRows[i];
                if (row._rawData[0] === 'Ilość osób dyżurujących') {
                    iloscOsobDyzurujacych = Number(row._rawData[1]);
                    console.log(`DEBUG: Znaleziono 'Ilość osób dyżurujących' = ${iloscOsobDyzurujacych} w wierszu ${i}`);
                    break;
                }
            }

            if (iloscOsobDyzurujacych === null || !Number.isInteger(iloscOsobDyzurujacych) || iloscOsobDyzurujacych <= 0) {
                console.log(`DEBUG: Nie znaleziono lub nieprawidłowa 'Ilość osób dyżurujących': ${iloscOsobDyzurujacych}`);
                return interaction.editReply('Nie znaleziono poprawnie zdefiniowanej "Ilości osób dyżurujących" w arkuszu Ustawienia!');
            }

            // Zapisz dane konwentu używając Sequelize
            console.log(`DEBUG: Zapisywanie konwentu do bazy danych`);
            console.log(`DEBUG: dataStart przed zapisem: ${dataStart.toISOString()}`);
            console.log(`DEBUG: dataKoniec przed zapisem: ${dataKoniec.toISOString()}`);

            // Upewniamy się, że daty mają odpowiedni format w modelu
            const konwentData = {
                nazwa,
                dataStart,
                dataKoniec,
                linkArkusz: spreadsheetId,
                osobyDyzurujace: iloscOsobDyzurujacych,
                powiadomieniaAktywne: true
            };

            await Konwent.upsert(konwentData);
            console.log(`DEBUG: Konwent zapisany pomyślnie`);

            // Dodaj informację o godzinach w komunikacie zwrotnym
            const dataStartFormatted = `${dataStartString} 00:00`;
            const dataKoniecFormatted = `${dataKoniecString} 23:59`;
            await interaction.editReply(`Konwent "${nazwa}" został pomyślnie dodany do bazy danych! Konwent trwa od ${dataStartFormatted} do ${dataKoniecFormatted}.`);
            console.log(`DEBUG: Operacja zakończona powodzeniem`);

        } catch (error) {
            console.error('DEBUG: Błąd podczas weryfikacji arkusza:', error);
            return interaction.editReply('Wystąpił błąd podczas weryfikacji arkusza. Sprawdź uprawnienia dostępu lub poprawność linku.');
        }

    } catch (error) {
        console.error('DEBUG: Błąd wykonania subkomendy dodaj:', error);
        await interaction.editReply('Wystąpił błąd podczas dodawania konwentu.');
    }
};