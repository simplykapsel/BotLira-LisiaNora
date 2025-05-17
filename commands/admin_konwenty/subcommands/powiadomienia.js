const { Konwent } = require('../../../models');

module.exports = async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    try {
        const nazwa = interaction.options.getString('nazwa');
        const status = interaction.options.getBoolean('status');

        // Pobierz konwent z bazy danych
        const konwent = await Konwent.findOne({
            where: {
                nazwa
            }
        });

        if (!konwent) {
            return interaction.editReply(`Konwent o nazwie "${nazwa}" nie istnieje w bazie danych!`);
        }

        // Aktualizuj status powiadomień
        konwent.powiadomieniaAktywne = status;
        await konwent.save();

        await interaction.editReply(`Powiadomienia dla konwentu "${nazwa}" zostały ${status ? 'włączone' : 'wyłączone'}.`);

    } catch (error) {
        console.error('Błąd wykonania subkomendy powiadomienia:', error);
        await interaction.editReply('Wystąpił błąd podczas zmiany statusu powiadomień.');
    }
};