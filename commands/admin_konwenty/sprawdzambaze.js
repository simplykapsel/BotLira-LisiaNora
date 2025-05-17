const { SlashCommandBuilder } = require('discord.js');
const { Dyzur, Konwent } = require('../../models');
const { Sequelize } = require('sequelize'); // Dodajemy ten import!

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sprawdzbaze')
        .setDescription('Sprawdza zawartość bazy danych dyżurów')
        .setDefaultMemberPermissions(0), // Tylko dla administratorów

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Pobierz liczbę dyżurów w bazie
            const iloscDyzurow = await Dyzur.count();

            // Pobierz liczbę aktywnych konwentów
            const aktywneKonwenty = await Konwent.findAll({
                where: {
                    powiadomieniaAktywne: true,
                    dataStart: { [Sequelize.Op.lte]: new Date() },
                    dataKoniec: { [Sequelize.Op.gte]: new Date() },
                },
            });

            // Pobierz przykładowe dyżury
            const przykladoweDyzury = await Dyzur.findAll({
                limit: 5,
                include: [{ model: Konwent }]
            });

            let response = `**Informacje o bazie danych:**\n`;
            response += `Liczba wszystkich dyżurów w bazie: ${iloscDyzurow}\n`;
            response += `Liczba aktywnych konwentów: ${aktywneKonwenty.length}\n`;

            if (aktywneKonwenty.length > 0) {
                response += `\n**Aktywne konwenty:**\n`;
                for (const konwent of aktywneKonwenty) {
                    const konwentDyzury = await Dyzur.count({ where: { konwentId: konwent.id } });
                    response += `- ${konwent.nazwa}: ${konwentDyzury} dyżurów\n`;
                }
            }

            if (przykladoweDyzury.length > 0) {
                response += `\n**Przykładowe dyżury:**\n`;
                for (const dyzur of przykladoweDyzury) {
                    response += `- ${dyzur.Konwent.nazwa}, ${dyzur.dzienTygodnia}, ${dyzur.godzina}, ${dyzur.osoba}, ${dyzur.trwanieDyzuru}h\n`;
                }
            } else {
                response += `\n**Brak przykładowych dyżurów w bazie**\n`;
            }

            await interaction.editReply(response);
        } catch (error) {
            console.error('Błąd podczas sprawdzania bazy:', error);
            await interaction.editReply('Wystąpił błąd podczas sprawdzania bazy danych.');
        }
    },
};