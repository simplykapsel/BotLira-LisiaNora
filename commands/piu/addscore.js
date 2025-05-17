const { SlashCommandBuilder } = require('discord.js');
const { PiuScore } = require('../../models');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addscore')
        .setDescription('Dodaj swój wynik (dowód w formie zdjęcia obowiązkowy)')
        .addIntegerOption(opt =>
            opt.setName('level')
                .setDescription('Poziom zagranego utworu (np. 23)')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('mode')
                .setDescription('Tryb gry')
                .setRequired(true)
                .addChoices(
                    { name: 'Single', value: 'single' },
                    { name: 'Double', value: 'double' },
                ))
        .addAttachmentOption(opt =>
            opt.setName('proof')
                .setDescription('Dowód w formie zdjęcia ekranu')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.user.id;
        const username = interaction.user.username;
        const level = interaction.options.getInteger('level');
        const mode = interaction.options.getString('mode');
        const proof = interaction.options.getAttachment('proof');

        if (!proof.contentType?.startsWith('image/')) {
            return interaction.editReply({ content: 'Plik musi być obrazem (jpg, png itp.)!' });
        }

        // Sprawdź czy istnieje wynik tego gracza dla tego trybu
        const existing = await PiuScore.findOne({ where: { userId, mode } });

        if (existing) {
            if (level > existing.level) {
                // Usuń poprzedni wynik
                await existing.destroy();
            } else {
                return interaction.editReply({ content: `Masz już wynik w trybie **${mode}**, który jest równy lub wyższy.` });
            }
        }

        // Dodaj nowy wynik
        await PiuScore.create({
            userId,
            username,
            level,
            mode,
            proofUrl: proof.url,
        });

        return interaction.editReply({ content: `Dodano wynik **[${mode === 'single' ? 'S' : 'D'}${level}]**.` });
    },
};
