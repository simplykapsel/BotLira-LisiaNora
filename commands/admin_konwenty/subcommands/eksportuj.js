const { Pomocliski } = require('../../../models');
const SheetsService = require('../../../utils/sheetsService');

module.exports = async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    try {
        // Pobierz link do arkusza
        const sheetUrl = interaction.options.getString('arkusz');

        // Inicjalizacja usługi Sheets
        const sheetsService = new SheetsService();
        try {
            await sheetsService.init();
        } catch (authError) {
            console.error('Błąd autoryzacji:', authError);
            return interaction.editReply({ content: 'Błąd autoryzacji Google Sheets. Sprawdź, czy plik service-account.json jest poprawny i czy konto serwisowe ma dostęp do arkusza.' });
        }

        // Wyciągnij ID arkusza z linka
        const spreadsheetId = sheetsService.extractSpreadsheetId(sheetUrl);
        if (!spreadsheetId) {
            return interaction.editReply({ content: 'Nieprawidłowy link do arkusza Google Sheets.' });
        }

        // Pobierz dane pomocliskich z bazy
        const pomocliski = await Pomocliski.findAll({
            order: [['nazwaUnikalna', 'ASC']]
        });

        if (pomocliski.length === 0) {
            return interaction.editReply({ content: 'Nie znaleziono pomocliskich w bazie danych.' });
        }

        // Utwórz arkusz "Ekipa" (lub zresetuj istniejący)
        try {
            const sheetCreated = await sheetsService.createEkipaSheet(spreadsheetId);
            if (!sheetCreated) {
                return interaction.editReply({ content: 'Wystąpił błąd podczas tworzenia arkusza "Ekipa".' });
            }

            // Zapisz dane do arkusza
            const dataWritten = await sheetsService.writeDataToEkipaSheet(spreadsheetId, pomocliski);
            if (!dataWritten) {
                return interaction.editReply({ content: 'Wystąpił błąd podczas zapisywania danych do arkusza.' });
            }

            return interaction.editReply({
                content: `Pomyślnie wyeksportowano ${pomocliski.length} pomocliskich do arkusza.`
            });
        } catch (error) {
            if (error.message && error.message.includes('permissions')) {
                return interaction.editReply({
                    content: 'Brak uprawnień do arkusza. Upewnij się, że konto serwisowe ma dostęp do arkusza i spróbuj ponownie.'
                });
            }
            throw error;
        }
    } catch (error) {
        console.error('Błąd podczas eksportu danych:', error);
        return interaction.editReply({
            content: `Wystąpił błąd podczas eksportu danych: ${error.message}`
        });
    }
};