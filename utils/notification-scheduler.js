const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { Sequelize } = require('sequelize');
const { Konwent, Pomocliski, Dyzur } = require('../models');
require('dotenv').config();

// Definiujemy strefę czasową dla Warszawy
const TIMEZONE = 'Europe/Warsaw';

// Zamiast stałego pliku konfiguracyjnego, używamy zmiennych środowiskowych
// lub, jeśli istnieje konfiguracja w innym miejscu, możemy ją importować
let config;
try {
    // Próbujemy załadować plik, jeśli istnieje
    config = require('../config/service-account.json');
    console.log('DEBUG: Załadowano konfigurację z pliku config/service-account.json');
} catch (error) {
    // W przypadku braku pliku, używamy zmiennych środowiskowych
    console.log('DEBUG: Używam konfiguracji z zmiennych środowiskowych');
    config = {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n') // Konwersja \n na rzeczywiste znaki nowej linii
    };
}

/**
 * Konwertuje datę UTC na czas warszawski
 * @param {Date} date Data w UTC
 * @returns {Date} Data w czasie warszawskim
 */
function getWarsawTime(date = new Date()) {
    return new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
}

/**
 * Formatuje datę do postaci YYYY-MM-DD HH:MM:SS
 * @param {Date} date Data do sformatowania
 * @returns {string} Sformatowana data
 */
function formatDateTime(date) {
    return date.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Inicjalizacja systemu powiadomień
 * @param {Client} client Discord Client
 */
function initializeNotificationSystem(client) {
    console.log('DEBUG: Inicjalizacja systemu powiadomień');

    // Sprawdź, czy mamy wszystkie wymagane dane konfiguracyjne
    if (!config || !config.client_email || !config.private_key) {
        console.error('BŁĄD: Brak wymaganych danych konfiguracyjnych dla Google API!');
        console.error('Dodaj zmienne środowiskowe GOOGLE_SERVICE_ACCOUNT_EMAIL i GOOGLE_PRIVATE_KEY');
        console.error('lub stwórz plik config/service-account.json');
        return;
    }

    // Co 5 minut aktualizuj dane z arkuszy
    setInterval(() => synchronizeDyzury(), 5 * 60 * 10000);

    // Co minutę sprawdzaj powiadomienia w bazie danych
    // setInterval(() => checkNotificationsFromDatabase(client), 60000);
    function checkOnFullMinute() {
        // Pobierz bieżący czas w strefie czasowej Warsaw
        const now = new Date();
        const warsawTime = getWarsawTime(now);
        const msToNextMinute = (60 - warsawTime.getSeconds()) * 1000 - warsawTime.getMilliseconds();

        setTimeout(() => {
            checkNotificationsFromDatabase(client); // uruchom funkcję
            checkOnFullMinute(); // zaplanuj kolejne wywołanie
        }, msToNextMinute);
    }

    checkOnFullMinute(); // uruchom pierwsze sprawdzenie

    // Wykonaj pierwszą synchronizację od razu
    console.log('DEBUG: Uruchamiam pierwszą synchronizację dyżurów');
    setTimeout(() => synchronizeDyzury(), 5000); // Uruchamiam po 5 sekundach, aby dać botowi czas na pełne załadowanie

    console.log('DEBUG: System powiadomień został uruchomiony');
}

/**
 * Synchronizuje dane z arkusza Google Sheets z bazą danych
 */
async function synchronizeDyzury() {
    try {
        console.log('DEBUG: Rozpoczynam synchronizację dyżurów z arkuszy');

        // Pobierz aktywne konwenty
        const aktywneKonwenty = await Konwent.findAll({
            where: {
                powiadomieniaAktywne: true,
                dataStart: { [Sequelize.Op.lte]: new Date() },
                dataKoniec: { [Sequelize.Op.gte]: new Date() },
            },
        });

        console.log(`DEBUG: Znaleziono ${aktywneKonwenty.length} aktywnych konwentów do synchronizacji`);

        if (!aktywneKonwenty.length) {
            console.log('DEBUG: Brak aktywnych konwentów, kończę synchronizację');
            return;
        }

        // Najpierw usuń wszystkie dyżury dla aktywnych konwentów
        const usunieteRekordy = await Dyzur.destroy({
            where: {
                konwentId: aktywneKonwenty.map(k => k.id)
            }
        });
        console.log(`DEBUG: Usunięto ${usunieteRekordy} starych dyżurów dla aktywnych konwentów`);

        // Pobierz mapowanie użytkowników
        const pomocliski = await Pomocliski.findAll();
        const userMapping = {};

        for (const pomoclik of pomocliski) {
            if (pomoclik.nazwaPrzyjazna && pomoclik.nazwaPrzyjazna.trim() !== '') {
                userMapping[pomoclik.nazwaPrzyjazna.trim()] = pomoclik.discordID;
            }
            if (pomoclik.nazwaUnikalna && pomoclik.nazwaUnikalna.trim() !== '') {
                userMapping[pomoclik.nazwaUnikalna.trim()] = pomoclik.discordID;
            }
        }

        console.log(`DEBUG: Pobrano ${Object.keys(userMapping).length} mapowań użytkowników`);
        console.log(`DEBUG: Przykładowe mapowania: ${JSON.stringify(Object.entries(userMapping).slice(0, 3))}`);

        // Dla każdego konwentu, pobierz dane z arkusza i zapisz do bazy
        for (const konwent of aktywneKonwenty) {
            await synchronizeKonwent(konwent, userMapping);
        }

        // Sprawdź, ile dyżurów zostało zapisanych
        const iloscDyzurow = await Dyzur.count({
            where: {
                konwentId: aktywneKonwenty.map(k => k.id)
            }
        });
        console.log(`DEBUG: Po synchronizacji w bazie znajduje się ${iloscDyzurow} dyżurów dla aktywnych konwentów`);

        console.log('DEBUG: Synchronizacja dyżurów zakończona pomyślnie');
    } catch (error) {
        console.error('DEBUG ERROR: Błąd podczas synchronizacji dyżurów:', error);
    }
}

/**
 * Synchronizuje dane dla jednego konwentu
 */
async function synchronizeKonwent(konwent, userMapping) {
    try {
        console.log(`DEBUG: Synchronizuję dane dla konwentu: ${konwent.nazwa} (ID: ${konwent.id})`);

        const serviceAccountAuth = new JWT({
            email: config.client_email,
            key: config.private_key,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/drive.file',
                'https://spreadsheets.google.com/feeds',
                'https://www.googleapis.com/auth/drive.readonly',
            ],
        });

        const doc = new GoogleSpreadsheet(konwent.linkArkusz, serviceAccountAuth);
        await doc.loadInfo();

        console.log(`DEBUG: Pomyślnie załadowano arkusz: ${doc.title}`);

        const harmonogramSheets = doc.sheetsByIndex.filter(
            (sheet) => !['Ustawienia', 'Ekipa', 'WSZYSTKO'].includes(sheet.title)
        );

        console.log(`DEBUG: Znaleziono ${harmonogramSheets.length} arkuszy z harmonogramem`);

        // Definicje dni tygodnia - używamy tylko pełnych nazw dla uniknięcia błędnych dopasowań
        const dniTygodnia = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
        // Mapa do znajdowania poprzedniego/następnego dnia tygodnia
        const nastepnyDzien = {
            'niedziela': 'poniedziałek',
            'poniedziałek': 'wtorek',
            'wtorek': 'środa',
            'środa': 'czwartek',
            'czwartek': 'piątek',
            'piątek': 'sobota',
            'sobota': 'niedziela'
        };
        const poprzedniDzien = {
            'niedziela': 'sobota',
            'poniedziałek': 'niedziela',
            'wtorek': 'poniedziałek',
            'środa': 'wtorek',
            'czwartek': 'środa',
            'piątek': 'czwartek',
            'sobota': 'piątek'
        };

        // Tymczasowa struktura do grupowania dyżurów - wszystkie dyżury osoby w danym dniu
        const wszystkieDyzuryOsobyDzien = {};

        for (const harmonogramSheet of harmonogramSheets) {
            console.log(`DEBUG: Przetwarzanie arkusza ${harmonogramSheet.title}`);

            const rows = await harmonogramSheet.getRows();
            console.log(`DEBUG: Pobrano ${rows.length} wierszy z arkusza ${harmonogramSheet.title}`);

            // Przechodzi przez wszystkie wiersze w arkuszu i oznacza dni tygodnia
            const wierszeDni = [];

            // Najpierw znajdź wszystkie wiersze zawierające nazwy dni tygodnia
            for (let index = 0; index < rows.length; index++) {
                const row = rows[index];
                const kolumnaA = (row._rawData[0] || '').toString().trim().toLowerCase();

                let dzien = null;

                // Sprawdz dla konkretnych fraz dni tygodnia (aby uniknąć niejednoznaczności)
                if (kolumnaA.includes('niedziel')) {
                    dzien = 'niedziela';
                } else if (kolumnaA.includes('poniedzia')) {
                    dzien = 'poniedziałek';
                } else if (kolumnaA.includes('wtor')) {
                    dzien = 'wtorek';
                } else if (kolumnaA.includes('środ') || kolumnaA.includes('srod')) {
                    dzien = 'środa';
                } else if (kolumnaA.includes('czwart')) {
                    dzien = 'czwartek';
                } else if (kolumnaA.includes('piąt') || kolumnaA.includes('piat')) {
                    dzien = 'piątek';
                } else if (kolumnaA.includes('sobot')) {
                    dzien = 'sobota';
                }

                if (dzien) {
                    console.log(`DEBUG: Znaleziono dzień tygodnia: ${dzien} w wierszu ${index + 1}`);
                    wierszeDni.push({ index, dzien });
                }
            }

            console.log(`DEBUG: Zidentyfikowano ${wierszeDni.length} wierszy z dniami tygodnia`);

            // Dla każdego wiersza ustal jego dzień tygodnia na podstawie znalezionych wcześniej znaczników
            let currentDzien = null;

            for (let index = 0; index < rows.length; index++) {
                const row = rows[index];

                // Sprawdź czy obecny wiersz zawiera dzień tygodnia
                const dzienWiersza = wierszeDni.find(d => d.index === index);
                if (dzienWiersza) {
                    currentDzien = dzienWiersza.dzien;
                    console.log(`DEBUG: Ustawianie aktualnego dnia tygodnia na ${currentDzien} od wiersza ${index + 1}`);

                    // Jeśli ten wiersz nie zawiera godziny, przejdź do następnego
                    if (!row._rawData[1]) {
                        console.log(`DEBUG: Wiersz ${index + 1} zawiera tylko dzień tygodnia, przechodzę dalej`);
                        continue;
                    }
                }

                // Jeśli nie mamy aktualnego dnia, pomijamy wiersz
                if (!currentDzien) {
                    console.log(`DEBUG: Pomijam wiersz ${index + 1} - brak przypisanego dnia tygodnia`);
                    continue;
                }

                // Sprawdź, czy wiersz zawiera godzinę
                const godzina = row._rawData[1];
                if (!godzina) {
                    console.log(`DEBUG: Pomijam wiersz ${index + 1} - brak godziny`);
                    continue;
                }

                // Normalizuj godzinę do formatu "HH:00"
                let normalizedGodzina = String(godzina).trim();
                if (/^\d{1,2}$/.test(normalizedGodzina)) {
                    normalizedGodzina = `${normalizedGodzina.padStart(2, '0')}:00`;
                } else if (/^\d{1,2}:\d{2}$/.test(normalizedGodzina)) {
                    normalizedGodzina = `${normalizedGodzina.split(':')[0].padStart(2, '0')}:00`;
                }

                const godzinaNum = parseInt(normalizedGodzina.split(':')[0]);

                console.log(`DEBUG: Przetwarzanie wiersza ${index + 1} dla dnia ${currentDzien}, godzina: ${normalizedGodzina}`);

                // Dla każdej osoby dyżurującej
                for (let i = 0; i < konwent.osobyDyzurujace; i++) {
                    const kolumnaIndex = i + 2; // Kolumny zaczynają się od C (indeks 2)

                    // Upewnij się, że indeks kolumny jest w granicach tablicy
                    if (kolumnaIndex >= row._rawData.length) continue;

                    const osoba = row._rawData[kolumnaIndex];
                    // Sprawdź, czy komórka zawiera prawidłową osobę
                    if (!osoba || String(osoba).trim() === '-' ||
                        String(osoba).trim() === 'NIE RUSZAĆ!' ||
                        String(osoba).trim() === 'Ilość godzin') {
                        continue;
                    }

                    const osobaStr = String(osoba).trim();
                    const discordId = userMapping[osobaStr];

                    if (!discordId) {
                        console.log(`DEBUG: Nie znaleziono mapowania Discord ID dla osoby: '${osobaStr}'`);
                        continue;
                    }

                    console.log(`DEBUG: Znaleziono osobę '${osobaStr}' (Discord ID: ${discordId}) na dyżurze w dniu ${currentDzien} o godzinie ${normalizedGodzina}`);

                    // Dodajemy każdą godzinę dyżuru do struktury przechowującej wszystkie dyżury danej osoby w danym dniu
                    const dyżurKey = `${konwent.id}-${currentDzien}-${osobaStr}-${discordId}`;

                    if (!wszystkieDyzuryOsobyDzien[dyżurKey]) {
                        wszystkieDyzuryOsobyDzien[dyżurKey] = {
                            konwentId: konwent.id,
                            dzienTygodnia: currentDzien,
                            osoba: osobaStr,
                            discordId: discordId,
                            godziny: new Set(), // Używamy Set aby uniknąć duplikatów
                            kolumny: new Set(),
                            arkusze: new Set()
                        };
                    }

                    // Dodajemy godzinę do zbioru
                    wszystkieDyzuryOsobyDzien[dyżurKey].godziny.add(godzinaNum);

                    // Dodajemy kolumnę do zbioru
                    wszystkieDyzuryOsobyDzien[dyżurKey].kolumny.add(String.fromCharCode(65 + kolumnaIndex));

                    // Dodajemy arkusz do zbioru
                    wszystkieDyzuryOsobyDzien[dyżurKey].arkusze.add(harmonogramSheet.title);
                }
            }
        }

        // Sprawdzamy specjalne przypadki dyżurów przechodzących przez północ (23:00 -> 0:00)
        console.log(`DEBUG: Sprawdzanie ciągłości dyżurów przez północ...`);
        for (const dyżurKey in wszystkieDyzuryOsobyDzien) {
            const dyżur = wszystkieDyzuryOsobyDzien[dyżurKey];
            const posortowaneGodziny = Array.from(dyżur.godziny).sort((a, b) => a - b);

            // Jeśli dyżur kończy się o 23:00
            if (posortowaneGodziny.includes(23)) {
                const następnyDzieńKey = `${konwent.id}-${nastepnyDzien[dyżur.dzienTygodnia]}-${dyżur.osoba}-${dyżur.discordId}`;

                // Sprawdzamy, czy ta sama osoba ma dyżur w następnym dniu
                if (wszystkieDyzuryOsobyDzien[następnyDzieńKey]) {
                    const następnyDzieńGodziny = Array.from(wszystkieDyzuryOsobyDzien[następnyDzieńKey].godziny).sort((a, b) => a - b);

                    // Sprawdź, czy dyżur w następnym dniu zaczyna się od wczesnych godzin (0, 1, 2, itd.)
                    let ciągłyDyżur = false;
                    let godzinyDoDodania = [];

                    // Zbieramy wszystkie ciągłe godziny od początku następnego dnia
                    for (let i = 0; i < 24; i++) {
                        if (następnyDzieńGodziny.includes(i)) {
                            godzinyDoDodania.push(i);
                        } else {
                            break; // Przerwa w ciągłości godzin
                        }
                    }

                    if (godzinyDoDodania.length > 0) {
                        ciągłyDyżur = true;
                        console.log(`DEBUG: Znaleziono dyżur przechodzący przez północ: ${dyżur.osoba} z ${dyżur.dzienTygodnia} 23:00 kontynuowany w ${nastepnyDzien[dyżur.dzienTygodnia]} przez ${godzinyDoDodania.length}h`);
                    }

                    if (ciągłyDyżur) {
                        // Oznaczamy ten dyżur jako przechodzący przez północ
                        dyżur.przezPolnoc = true;
                        dyżur.nastepnyDzienKey = następnyDzieńKey;
                        dyżur.godzinyDoDodania = godzinyDoDodania;

                        // Oznaczamy godziny w następnym dniu jako kontynuowane
                        wszystkieDyzuryOsobyDzien[następnyDzieńKey].kontynuacja = true;
                        wszystkieDyzuryOsobyDzien[następnyDzieńKey].poprzedniDzienKey = dyżurKey;
                        wszystkieDyzuryOsobyDzien[następnyDzieńKey].godzinyKontynuowane = godzinyDoDodania;

                        // Usuwamy te godziny z następnego dnia, będą dołączone do dyżuru poprzedniego dnia
                        for (const g of godzinyDoDodania) {
                            wszystkieDyzuryOsobyDzien[następnyDzieńKey].godziny.delete(g);
                        }

                        console.log(`DEBUG: Usunięto ${godzinyDoDodania.length} początkowych godzin z dyżuru w dniu ${wszystkieDyzuryOsobyDzien[następnyDzieńKey].dzienTygodnia}`);
                    }
                }
            }
        }

        // Konwertuj zgrupowane dyżury na listę do zapisu
        const dyzuryDoZapisu = [];

        for (const dyżurKey in wszystkieDyzuryOsobyDzien) {
            const dyżur = wszystkieDyzuryOsobyDzien[dyżurKey];

            // Konwertujemy Set na tablicę i sortujemy godziny
            let posortowaneGodziny = Array.from(dyżur.godziny).sort((a, b) => a - b);

            if (posortowaneGodziny.length === 0) {
                console.log(`DEBUG: Pomijam pusty dyżur dla ${dyżur.osoba} w dniu ${dyżur.dzienTygodnia}`);
                continue; // Pomijamy, jeśli nie ma żadnych godzin
            }

            // Identyfikujemy ciągłe bloki godzin
            const blokiGodzin = [];
            let aktualnyBlok = [posortowaneGodziny[0]];

            for (let i = 1; i < posortowaneGodziny.length; i++) {
                const poprzedniaGodzina = posortowaneGodziny[i - 1];
                const obecnaGodzina = posortowaneGodziny[i];

                if (obecnaGodzina === poprzedniaGodzina + 1) {
                    // Godziny są ciągłe, dodaj do aktualnego bloku
                    aktualnyBlok.push(obecnaGodzina);
                } else {
                    // Znaleziono przerwę, zakończ aktualny blok i rozpocznij nowy
                    blokiGodzin.push(aktualnyBlok);
                    aktualnyBlok = [obecnaGodzina];
                }
            }

            // Dodaj ostatni blok
            blokiGodzin.push(aktualnyBlok);

            // Konwertujemy Set na łańcuch znaków oddzielony przecinkami
            const kolumnyStr = Array.from(dyżur.kolumny).join(',');
            const arkuszeStr = Array.from(dyżur.arkusze).join(',');

            console.log(`DEBUG: Dyżury ${dyżur.osoba} w dniu ${dyżur.dzienTygodnia} podzielone na ${blokiGodzin.length} bloków:`);

            // Dla każdego ciągłego bloku godzin tworzymy osobny wpis
            for (let idx = 0; idx < blokiGodzin.length; idx++) {
                const blok = blokiGodzin[idx];
                let godzinaStart = `${String(blok[0]).padStart(2, '0')}:00`;
                let trwanieDyzuru = blok.length;

                // Jeśli to ostatni blok w dniu i kończy się o 23:00 i jest oznaczony jako przechodzący przez północ
                if (idx === blokiGodzin.length - 1 && blok[blok.length - 1] === 23 && dyżur.przezPolnoc) {
                    // Zwiększamy czas trwania o godziny z następnego dnia
                    trwanieDyzuru += dyżur.godzinyDoDodania ? dyżur.godzinyDoDodania.length : 0;
                    console.log(`DEBUG: Blok dyżuru przechodzący przez północ, zwiększam czas trwania o ${dyżur.godzinyDoDodania ? dyżur.godzinyDoDodania.length : 0} godzin`);
                }

                console.log(`DEBUG: Blok od ${godzinaStart}, trwa ${trwanieDyzuru}h, godziny: [${blok.join(', ')}]`);

                dyzuryDoZapisu.push({
                    konwentId: dyżur.konwentId,
                    dzienTygodnia: dyżur.dzienTygodnia,
                    godzina: godzinaStart,
                    osoba: dyżur.osoba,
                    discordId: dyżur.discordId,
                    trwanieDyzuru: trwanieDyzuru,
                    arkusz: arkuszeStr,
                    kolumna: kolumnyStr
                });
            }
        }

        console.log(`DEBUG: Przygotowano ${dyzuryDoZapisu.length} dyżurów do zapisu dla konwentu ${konwent.nazwa}`);

        // Zapisz dyżury do bazy danych
        if (dyzuryDoZapisu.length > 0) {
            try {
                await Dyzur.bulkCreate(dyzuryDoZapisu);
                console.log(`DEBUG: Zapisano ${dyzuryDoZapisu.length} dyżurów dla konwentu ${konwent.nazwa}`);
            } catch (error) {
                console.error(`DEBUG ERROR: Błąd podczas masowego zapisu dyżurów:`, error);

                // Spróbuj zapisać pojedynczo, aby zlokalizować problematyczny rekord
                for (const dyzur of dyzuryDoZapisu) {
                    try {
                        await Dyzur.create(dyzur);
                        console.log(`DEBUG: Zapisano dyżur: ${JSON.stringify(dyzur)}`);
                    } catch (err) {
                        console.error(`DEBUG ERROR: Nie można zapisać dyżuru: ${JSON.stringify(dyzur)}, błąd:`, err);
                    }
                }
            }
        } else {
            console.log(`DEBUG: Nie znaleziono dyżurów do zapisu dla konwentu ${konwent.nazwa}`);
        }
    } catch (error) {
        console.error(`DEBUG ERROR: Błąd przetwarzania konwentu ${konwent.nazwa}:`, error);
    }
}

/**
 * Sprawdza czy są powiadomienia do wysłania na podstawie danych w bazie
 * @param {Client} client Discord Client
 */
async function checkNotificationsFromDatabase(client) {
    try {
        // Pobierz aktualny czas i przekształć go na czas warszawski
        const teraz = new Date();
        const warsawTime = getWarsawTime(teraz);
        const obecnaMinuta = warsawTime.getMinutes();

        // Sprawdzamy powiadomienia tylko gdy minut jest równa 45 (15 minut przed pełną godziną)
        // lub gdy minuta jest równa 0 (początek godziny)
        if (obecnaMinuta !== 45 && obecnaMinuta !== 0) {
            return; // Cicho wyjdź, nie loguj nic aby uniknąć spamowania logów
        }

        console.log(`DEBUG: Rozpoczęto sprawdzanie powiadomień z bazy danych (${(warsawTime.getHours()).toString().padStart(2, '0')}:${warsawTime.getMinutes().toString().padStart(2, '0')})`);

        // Pobierz dzień tygodnia zgodny z czasem warszawskim
        const dzienTygodnia = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'][warsawTime.getDay()];
        console.log(`DEBUG: Aktualny dzień tygodnia (wg czasu warszawskiego): ${dzienTygodnia}`);

        // Oblicz godzinę dla powiadomień:
        let docelowaGodzina;
        let czyPowiadomienie15min;

        if (obecnaMinuta === 45) {
            // Jeśli jest 45 minut po godzinie, to wysyłamy powiadomienie 15 minut przed następną pełną godziną
            const za15minut = new Date(teraz.getTime() + 15 * 60000);
            const za15minutWarsaw = getWarsawTime(za15minut);
            docelowaGodzina = `${za15minutWarsaw.getHours().toString().padStart(2, '0')}:00`;
            czyPowiadomienie15min = true;
            console.log(`DEBUG: Sprawdzam dyżury zaczynające się o ${docelowaGodzina} (powiadomienie "za 15 minut")`);
        } else if (obecnaMinuta === 0) {
            // Jeśli jest początek godziny, to wysyłamy powiadomienie o rozpoczęciu dyżuru
            docelowaGodzina = `${warsawTime.getHours().toString().padStart(2, '0')}:00`;
            czyPowiadomienie15min = false;
            console.log(`DEBUG: Sprawdzam dyżury zaczynające się o ${docelowaGodzina} (powiadomienie "start")`);
        } else {
            return; // Ten przypadek nie powinien wystąpić ze względu na wcześniejszy warunek, ale dla pewności
        }

        // Pobierz dyżury, które wymagają powiadomień w odpowiedniej godzinie
        const dyzury = await Dyzur.findAll({
            where: {
                dzienTygodnia: dzienTygodnia,
                godzina: docelowaGodzina
            },
            include: [
                { model: Konwent, where: { powiadomieniaAktywne: true } }
            ]
        });

        console.log(`DEBUG: Znaleziono ${dyzury.length} dyżurów do powiadomienia`);

        // Wyślij powiadomienia
        for (const dyzur of dyzury) {
            try {
                // Pobierz użytkownika Discord
                const user = await client.users.fetch(dyzur.discordId);
                if (!user) {
                    console.log(`DEBUG: Nie znaleziono użytkownika Discord o ID: ${dyzur.discordId}`);
                    continue;
                }

                const konwentNazwa = dyzur.Konwent.nazwa;
                const strefaNazwa = dyzur.arkusz; // Zmiana z dyzur.Konwent.arkusz na dyzur.arkusz

                if (czyPowiadomienie15min) {
                    console.log(`DEBUG: Wysyłanie powiadomienia "za 15 minut" do ${dyzur.osoba} (${dyzur.discordId}) dla dyżuru o ${docelowaGodzina}`);
                    const trwanieText = dyzur.trwanieDyzuru === 1
                        ? "1 godzinę"
                        : (dyzur.trwanieDyzuru >= 5 ? `${dyzur.trwanieDyzuru} godzin` : `${dyzur.trwanieDyzuru} godziny`);

                    // Oblicz czas zakończenia dyżuru
                    const godzinaStart = parseInt(docelowaGodzina.split(':')[0]);
                    const godzinaKoniec = (godzinaStart + dyzur.trwanieDyzuru) % 24;
                    const koniecDyzuru = `${godzinaKoniec.toString().padStart(2, '0')}:00`;

                    await user.send(`Twój dyżur na **${konwentNazwa}** na strefie **${strefaNazwa}** zaczyna się za 15 minut! Będzie trwał od **${docelowaGodzina}** do **${koniecDyzuru}** (${trwanieText}).`);
                } else {
                    const trwanieText = dyzur.trwanieDyzuru === 1
                        ? "1 godzinę"
                        : (dyzur.trwanieDyzuru >= 5 ? `${dyzur.trwanieDyzuru} godzin` : `${dyzur.trwanieDyzuru} godziny`);

                    // Oblicz czas zakończenia dyżuru
                    const godzinaStart = parseInt(docelowaGodzina.split(':')[0]);
                    const godzinaKoniec = (godzinaStart + dyzur.trwanieDyzuru) % 24;
                    const koniecDyzuru = `${godzinaKoniec.toString().padStart(2, '0')}:00`;

                    console.log(`DEBUG: Wysyłanie powiadomienia "start" do ${dyzur.osoba} (${dyzur.discordId}) dla dyżuru o ${docelowaGodzina}, czas trwania: ${trwanieText}`);
                    await user.send(`Twój dyżur na **${konwentNazwa}** na strefie **${strefaNazwa}** właśnie się zaczął! Będzie trwał od **${docelowaGodzina}** do **${koniecDyzuru}** (${trwanieText}).`);
                }
            } catch (error) {
                console.error(`DEBUG ERROR: Nie udało się wysłać powiadomienia do ${dyzur.osoba}:`, error);
            }
        }

        console.log('DEBUG: Zakończono sprawdzanie powiadomień');
    } catch (error) {
        console.error('DEBUG ERROR: Błąd podczas sprawdzania powiadomień z bazy danych:', error);
    }
}

module.exports = {
    initializeNotificationSystem,
};