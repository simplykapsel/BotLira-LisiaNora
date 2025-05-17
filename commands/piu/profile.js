const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { PiuScore } = require('../../models');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Wyświetla Twój profil lub innego gracza')
        .addUserOption(opt => opt.setName('user').setDescription('Gracz (opcjonalnie)')),

    async execute(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;

        const scores = await PiuScore.findAll({ where: { userId: user.id } });

        const single = scores.filter(s => s.mode === 'single').sort((a, b) => b.level - a.level);
        const double = scores.filter(s => s.mode === 'double').sort((a, b) => b.level - a.level);

        const embed = new EmbedBuilder()
            .setTitle(`Profil gracza ${user.username} – Single`)
            .setColor(0xe74c3c)
            .addFields(
                { name: '🎯 Single', value: single.map(s => `[S${s.level}]`).join(', ') || 'Brak' }
            )
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'Użyj /addscore aby dodać wynik!' });

        const proof = single.find(s => s.proofUrl);
        if (proof?.proofUrl) embed.setImage(proof.proofUrl);

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`profile_single_${user.id}`)
                .setLabel('Single')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`profile_double_${user.id}`)
                .setLabel('Double')
                .setStyle(ButtonStyle.Success)
        );

        await interaction.reply({ embeds: [embed], components: [buttons] });
    },
};
