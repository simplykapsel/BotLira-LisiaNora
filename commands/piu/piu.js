const { SlashCommandBuilder } = require('discord.js');
const path = require('node:path');
const { GAME_MODES } = require('../../utils/piuUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('piu')
        .setDescription('Komendy związane z wynikami Pump It Up')
        .addSubcommand(sub =>
            sub
                .setName('addscore')
                .setDescription('Dodaj nowy wynik')
                .addStringOption(option =>
                    option.setName('tryb')
                        .setDescription('Tryb gry')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Single', value: 'single' },
                            { name: 'Double', value: 'double' }
                        )
                )
                .addIntegerOption(option =>
                    option.setName('poziom')
                        .setDescription('Poziom trudności')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(29)
                )
                .addStringOption(option =>  // Zmiana z attachment na string
                    option.setName('link')
                        .setDescription('Link do zdjęcia wyniku (Imgur, Discord CDN, itp.)')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('top')
                .setDescription('Wyświetl topkę graczy')
                .addStringOption(option =>
                    option.setName('tryb')
                        .setDescription('Tryb gry')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Single', value: 'single' },
                            { name: 'Double', value: 'double' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('profile')
                .setDescription('Wyświetl profil gracza')
                .addUserOption(option =>
                    option.setName('uzytkownik')
                        .setDescription('Użytkownik którego profil chcesz zobaczyć (domyślnie: ty)')
                        .setRequired(false)
                )
        ),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        try {
            // Dynamiczne ładowanie subkomend
            const subcommandFile = path.join(__dirname, 'subcommands', `${subcommand}.js`);
            const subcommandHandler = require(subcommandFile);
            return subcommandHandler(interaction);
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'Wystąpił błąd podczas wykonywania subkomendy.', ephemeral: true });
        }
    }
};