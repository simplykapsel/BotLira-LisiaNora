const { EmbedBuilder } = require('discord.js');
const { PiuScore } = require('../../../models');
const {
    GAME_MODES,
    MAX_LEVELS,
    isValidImageUrl
} = require('../../../utils/piuUtils');

module.exports = async function(interaction) {
    await interaction.deferReply();

    // Pobierz opcje z interakcji
    const mode = interaction.options.getString('tryb');
    const level = interaction.options.getInteger('poziom');
    const imageUrl = interaction.options.getString('link');
    const userId = interaction.user.id;
    const username = interaction.user.username;

    // Sprawdź czy poziom jest prawidłowy dla wybranego trybu
    const maxLevel = MAX_LEVELS[mode];
    if (level > maxLevel) {
        return interaction.editReply(
            `Nieprawidłowy poziom dla trybu ${mode}. Maksymalny poziom to ${maxLevel}.`
        );
    }

    // Walidacja URL obrazu
    if (!imageUrl || !isValidImageUrl(imageUrl)) {
        return interaction.editReply({
            content: 'Podany link jest nieprawidłowy. Link musi:\n' +
                '1. Pochodzić z jednego z tych serwisów: Imgur, Discord CDN, ibb.co, postimg.cc, prnt.sc lub gyazo.com\n' +
                '2. Kończyć się rozszerzeniem obrazu (.jpg, .jpeg, .png, .gif, .webp)\n\n' +
                'Przykład poprawnego linku: https://i.imgur.com/example.jpg'
        });
    }

    try {
        // Znajdź najwyższy poziom użytkownika dla tego trybu
        const highestScore = await PiuScore.findOne({
            where: {
                userId,
                mode
            },
            order: [
                ['level', 'DESC']
            ]
        });

        // Jeśli użytkownik już ma wyższy poziom, przerwij komendę
        if (highestScore && highestScore.level > level) {
            return interaction.editReply({
                content: `Masz już zaliczony wyższy poziom ([${mode === GAME_MODES.SINGLE ? 'S' : 'D'}${highestScore.level}]) w tym trybie! Nie możesz dodać niższego poziomu.`
            });
        }

        // Sprawdź czy użytkownik ma już wynik dla tego poziomu i trybu
        const existingScore = await PiuScore.findOne({
            where: {
                userId,
                mode,
                level
            }
        });

        if (existingScore) {
            // Aktualizuj rekord
            await existingScore.update({ proofUrl: imageUrl });

            const embed = new EmbedBuilder()
                .setTitle(`Wynik zaktualizowany!`)
                .setDescription(`Zaktualizowano wynik dla [${mode === GAME_MODES.SINGLE ? 'S' : 'D'}${level}]!`)
                .setColor('#00FF00')
                .setTimestamp()
                .setImage(imageUrl); // Dodaj obraz bezpośrednio z linku

            if (interaction.user.avatarURL()) {
                embed.setThumbnail(interaction.user.avatarURL());
            }

            return interaction.editReply({
                embeds: [embed]
            });
        } else {
            // Dodaj nowy rekord
            await PiuScore.create({
                userId,
                username,
                mode,
                level,
                proofUrl: imageUrl
            });

            const embed = new EmbedBuilder()
                .setTitle(`Nowy wynik dodany!`)
                .setDescription(`Dodano nowy wynik dla [${mode === GAME_MODES.SINGLE ? 'S' : 'D'}${level}]!`)
                .setColor('#0099FF')
                .setTimestamp()
                .setImage(imageUrl); // Dodaj obraz bezpośrednio z linku

            if (interaction.user.avatarURL()) {
                embed.setThumbnail(interaction.user.avatarURL());
            }

            return interaction.editReply({
                embeds: [embed]
            });
        }
    } catch (error) {
        console.error('Błąd w komendzie addscore:', error);
        return interaction.editReply('Wystąpił błąd podczas dodawania wyniku.');
    }
};