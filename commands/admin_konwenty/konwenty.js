const { SlashCommandBuilder } = require('discord.js');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('konwenty')
        .setDescription('Komendy związane z konwentami')
        .addSubcommand(sub =>
            sub
                .setName('lista')
                .setDescription('Dodaje członków z wybranych rang do bazy danych')
                .addStringOption(option =>
                    option.setName('rangi')
                        .setDescription('Podaj role w formie oznaczeń, oddzielone przecinkami, np. <@&123>, <@&456>')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('eksportuj')
                .setDescription('Eksportuje dane pomocliskich do arkusza Google')
                .addStringOption(option =>
                    option.setName('arkusz')
                        .setDescription('Link do arkusza Google Sheets')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('dodaj')
                .setDescription('Dodaje nowy konwent do bazy danych')
                .addStringOption(option =>
                    option.setName('nazwa')
                        .setDescription('Przyjazna nazwa konwentu')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('data_start')
                        .setDescription('Data rozpoczęcia konwentu w formacie dd.mm.rrrr')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('data_koniec')
                        .setDescription('Data zakończenia konwentu w formacie dd.mm.rrrr')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('link_doczek')
                        .setDescription('Link do dokumentacji konwentu (Google Docs/Sheets)')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('powiadomienia')
                .setDescription('Włącza lub wyłącza powiadomienia o dyżurach dla konwentu')
                .addStringOption(option =>
                    option.setName('nazwa')
                        .setDescription('Nazwa konwentu')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addBooleanOption(option =>
                    option.setName('status')
                        .setDescription('Status powiadomień (true = włączone, false = wyłączone)')
                        .setRequired(true)
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
    },
};