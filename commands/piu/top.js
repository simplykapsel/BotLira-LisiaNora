// top.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { PiuScore } = require('../../models');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('top')
        .setDescription('Wyświetla top graczy PIU!'),

    async execute(interaction) {
        const scores = await PiuScore.findAll();

        const single = scores.filter(s => s.mode === 'single');
        const double = scores.filter(s => s.mode === 'double');

        const formatScores = (entries, prefix) => {
            const grouped = {};
            entries.forEach(s => {
                const key = s.level;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(`<@${s.userId}>`);
            });

            const sorted = Object.keys(grouped)
                .sort((a, b) => b - a)
                .map(level => `**[${prefix}${level}]** ${grouped[level].join(', ')}`);

            return sorted.join('\n') || 'Brak danych';
        };

        const singleEmbed = new EmbedBuilder()
            .setTitle('Top – Single')
            .setDescription(formatScores(single, 'S'))
            .setColor(0xed4245);

        const doubleEmbed = new EmbedBuilder()
            .setTitle('Top – Double')
            .setDescription(formatScores(double, 'D'))
            .setColor(0x57f287);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('top_single')
                .setLabel('Single')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('top_double')
                .setLabel('Double')
                .setStyle(ButtonStyle.Success)
        );

        await interaction.reply({ embeds: [singleEmbed], components: [row] });

        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.customId === 'top_single') {
                await i.update({ embeds: [singleEmbed] });
            } else if (i.customId === 'top_double') {
                await i.update({ embeds: [doubleEmbed] });
            }
        });
    },
};
