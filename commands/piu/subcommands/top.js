const { EmbedBuilder } = require('discord.js');
const { PiuScore } = require('../../../models');
const {
    GAME_MODES,
    createModeToggleButtons
} = require('../../../utils/piuUtils');

async function sendTopScores(interaction, mode) {
    // Pobierz wyniki dla trybu
    const scores = await PiuScore.findAll({
        where: {
            mode
        },
        order: [
            ['level', 'DESC'],
        ]
    });

    // Grupuj wyniki według poziomów
    const scoresByLevel = {};
    for (const score of scores) {
        if (!scoresByLevel[score.level]) {
            scoresByLevel[score.level] = [];
        }

        // Dodaj użytkownika jeśli jeszcze go nie ma w tym poziomie
        if (!scoresByLevel[score.level].find(s => s.userId === score.userId)) {
            scoresByLevel[score.level].push(score);
        }
    }

    // Przygotuj embed
    const embed = new EmbedBuilder()
        .setTitle(` Pump It Up Pass List Lisia Nora - ${mode === GAME_MODES.SINGLE ? 'Single' : 'Double'}`)
        .setDescription(`Lista obrazująca aktualna topkę graczy na danym trybie gry.`)
        .setColor(mode === GAME_MODES.SINGLE ? '#c80104' : '#179213') // Niebieski dla Single, czerwony dla Double
        .setTimestamp();

    // Dodaj pola dla każdego poziomu
    Object.keys(scoresByLevel).sort((a, b) => Number(b) - Number(a)).forEach(level => {
        const levelScores = scoresByLevel[level];
        if (levelScores.length > 0) {
            const formattedScores = levelScores
                .map(score => `<@${score.userId}>`)
                .join(' ');

            embed.addFields({
                name: `[${mode === GAME_MODES.SINGLE ? 'S' : 'D'}${level}]`,
                value: formattedScores || 'Brak graczy',
                inline: false
            });
        }
    });

    // Jeśli nie ma wyników
    if (Object.keys(scoresByLevel).length === 0) {
        embed.setDescription(`Nie znaleziono żadnych wyników dla trybu ${mode === GAME_MODES.SINGLE ? 'Single' : 'Double'}.`);
    }

    // Stwórz przyciski do przełączania między trybami
    const buttons = createModeToggleButtons(mode, 'top');

    // Wyślij odpowiedź
    await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

module.exports = async function(interaction) {
    await interaction.deferReply();

    // Pobierz opcje z interakcji
    const requestedMode = interaction.options.getString('tryb') || GAME_MODES.SINGLE;

    try {
        await sendTopScores(interaction, requestedMode);
    } catch (error) {
        console.error('Błąd w komendzie top:', error);
        return interaction.editReply('Wystąpił błąd podczas pobierania wyników.');
    }
};

// Eksportuj funkcję dla obsługi przycisków
module.exports.sendTopScores = sendTopScores;