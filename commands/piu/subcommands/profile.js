const { EmbedBuilder } = require('discord.js');
const { PiuScore } = require('../../../models');
const {
    GAME_MODES,
    createModeToggleButtons
} = require('../../../utils/piuUtils');

async function sendProfileScores(interaction, targetUser, mode) {
    // Pobierz wszystkie wyniki użytkownika dla wybranego trybu
    const scores = await PiuScore.findAll({
        where: {
            userId: targetUser.id,
            mode
        },
        order: [
            ['level', 'ASC']
        ]
    });

    // Pobierz najwyższy wynik (najwyższy poziom)
    const topScore = await PiuScore.findOne({
        where: {
            userId: targetUser.id,
            mode
        },
        order: [
            ['level', 'DESC']
        ]
    });

    // Przygotuj embed
    const embed = new EmbedBuilder()
        .setTitle(`Profil gracza: ${targetUser.username}`)
        .setDescription(`Wyniki dla trybu ${mode === GAME_MODES.SINGLE ? 'Single' : 'Double'}`)
        .setColor(mode === GAME_MODES.SINGLE ? '#c80104' : '#179213')
        .setTimestamp();

    if (targetUser.avatarURL()) {
        embed.setThumbnail(targetUser.avatarURL());
    }

    // Utwórz pola dla wyników
    if (scores.length > 0) {
        // Grupuj poziomy po 3 w jednym polu
        const chunkSize = 3;
        for (let i = 0; i < scores.length; i += chunkSize) {
            const chunk = scores.slice(i, i + chunkSize);
            const fieldValue = chunk.map(score =>
                `[${mode === GAME_MODES.SINGLE ? 'S' : 'D'}${score.level}]`
            ).join('\n');

            // embed.addFields({
            //     name: i === 0 ? 'Zaliczone poziomy' : '\u200B', // Tylko pierwsze pole ma nazwę
            //     value: fieldValue,
            //     inline: true
            // });
        }

        // Dodaj tylko jedną informację o najwyższym poziomie
        if (topScore) {
            embed.addFields({
                name: 'Najwyższy passnięty poziom',
                value: `[${mode === GAME_MODES.SINGLE ? 'S' : 'D'}${topScore.level}]`,
                inline: false
            });
        }
    } else {
        embed.setDescription(`Brak wyników dla trybu ${mode === GAME_MODES.SINGLE ? 'Single' : 'Double'}.`);
    }

    // Dodaj zdjęcie najlepszego wyniku, jeśli istnieje
    if (topScore && topScore.proofUrl) {
        embed.setImage(topScore.proofUrl);
    }

    // Stwórz przyciski do przełączania między trybami
    const buttons = createModeToggleButtons(mode, `profile_${targetUser.id}`);

    // Wyślij odpowiedź
    await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

module.exports = async function(interaction) {
    await interaction.deferReply();

    // Pobierz opcje z interakcji
    const targetUser = interaction.options.getUser('uzytkownik') || interaction.user;

    try {
        // Sprawdź czy użytkownik ma jakiekolwiek wyniki
        const count = await PiuScore.count({
            where: {
                userId: targetUser.id
            }
        });

        if (count === 0) {
            return interaction.editReply(
                `${targetUser.id === interaction.user.id ? 'Nie masz' : `Użytkownik ${targetUser.username} nie ma`} jeszcze żadnych zapisanych wyników.`
            );
        }

        // Sprawdź czy użytkownik ma wyniki dla single
        const singleCount = await PiuScore.count({
            where: {
                userId: targetUser.id,
                mode: GAME_MODES.SINGLE
            }
        });

        // Sprawdź czy użytkownik ma wyniki dla double
        const doubleCount = await PiuScore.count({
            where: {
                userId: targetUser.id,
                mode: GAME_MODES.DOUBLE
            }
        });

        // Wybierz domyślny tryb
        let defaultMode = GAME_MODES.SINGLE;
        if (singleCount === 0 && doubleCount > 0) {
            defaultMode = GAME_MODES.DOUBLE;
        }

        await sendProfileScores(interaction, targetUser, defaultMode);
    } catch (error) {
        console.error('Błąd w komendzie profile:', error);
        return interaction.editReply('Wystąpił błąd podczas pobierania profilu.');
    }
};

// Eksportuj funkcję dla obsługi przycisków
module.exports.sendProfileScores = sendProfileScores;