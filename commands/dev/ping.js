const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    category: 'test',
    cooldown: 3,
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Odpowiada Pong!')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.reply('Pong!');
    },
};