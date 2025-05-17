const { google } = require('googleapis');
const path = require('path');

// Ścieżka do pliku z kluczem Service Account
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../config/service-account.json');

/**
 * Uwierzytelnianie przy użyciu konta serwisowego (Service Account)
 */
async function authorize() {
    try {
        // Wczytaj poświadczenia Service Account
        const auth = new google.auth.GoogleAuth({
            keyFile: SERVICE_ACCOUNT_PATH,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        // Stwórz klienta autoryzacyjnego
        return auth.getClient();
    } catch (err) {
        console.error('Błąd podczas uwierzytelniania:', err);
        throw new Error('Nie można uwierzytelnić przy użyciu konta serwisowego. ' +
            'Sprawdź, czy plik service-account.json znajduje się w katalogu config/.');
    }
}

module.exports = { authorize };