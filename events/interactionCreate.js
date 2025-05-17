const { Events, MessageFlags, InteractionType } = require('discord.js');
const { PiuScore, Konwent } = require('../models');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Obsługa autouzupełniania dla subkomendy powiadomienia
        if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
            const focusedOption = interaction.options.getFocused(true);

            if (interaction.commandName === 'konwenty' &&
                interaction.options.getSubcommand() === 'powiadomienia' &&
                focusedOption.name === 'nazwa') {

                try {
                    const konwenty = await Konwent.findAll({
                        attributes: ['nazwa']
                    });

                    const filtered = konwenty
                        .map(k => k.nazwa)
                        .filter(nazwa => nazwa.toLowerCase().includes(focusedOption.value.toLowerCase()))
                        .slice(0, 25);

                    await interaction.respond(
                        filtered.map(nazwa => ({ name: nazwa, value: nazwa }))
                    );
                } catch (error) {
                    console.error('Błąd podczas autouzupełniania:', error);
                    await interaction.respond([]);
                }
                return;
            }
        }

        // Istniejąca obsługa przycisków
        if (interaction.isButton()) {
            const [action, mode, userId] = interaction.customId.split('_');
            if (action === 'profile') {
                const user = await interaction.client.users.fetch(userId);
                const scores = await PiuScore.findAll({ where: { userId } });

                const filtered = scores
                    .filter(s => s.mode === mode)
                    .sort((a, b) => b.level - a.level);

                const embed = new EmbedBuilder()
                    .setTitle(`Profil gracza ${user.username} – ${mode === 'single' ? 'Single' : 'Double'}`)
                    .setColor(mode === 'single' ? 0xe74c3c : 0x2ecc71)
                    .addFields({
                        name: mode === 'single' ? '🎯 Single' : '🎯 Double',
                        value: filtered.map(s => `[${mode === 'single' ? 'S' : 'D'}${s.level}]`).join(', ') || 'Brak'
                    })
                    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: 'Użyj /addscore aby dodać wynik!' });

                const proof = filtered.find(s => s.proofUrl);
                if (proof?.proofUrl) embed.setImage(proof.proofUrl);

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`profile_single_${userId}`)
                        .setLabel('Single')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(mode === 'single'),
                    new ButtonBuilder()
                        .setCustomId(`profile_double_${userId}`)
                        .setLabel('Double')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(mode === 'double')
                );

                return interaction.update({ embeds: [embed], components: [buttons] });
            }
            return;
        }

        // Istniejąca obsługa komend
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            const errorMessage = { content: 'Wystąpił błąd podczas wykonywania komendy!', flags: MessageFlags.Ephemeral };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    },
};