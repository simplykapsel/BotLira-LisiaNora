const { Events, MessageFlags, InteractionType } = require('discord.js');
const { PiuScore, Konwent } = require('../models');
const path = require('node:path');

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

        // Obsługa przycisków
        if (interaction.isButton()) {
            const [command, ...args] = interaction.customId.split('_');

            // Obsługa przycisków dla komendy pump
            if (command === 'top') {
                const mode = args[0]; // single lub double
                const topModule = require('../commands/piu/subcommands/top');
                await interaction.deferUpdate();
                await topModule.sendTopScores(interaction, mode);
                return;
            }
            else if (command === 'profile') {
                const userId = args[0];
                const mode = args[1]; // single lub double

                if (mode) {
                    try {
                        const profileModule = require('../commands/piu/subcommands/profile');
                        const targetUser = await interaction.client.users.fetch(userId);
                        await interaction.deferUpdate();
                        await profileModule.sendProfileScores(interaction, targetUser, mode);
                    } catch (error) {
                        console.error('Błąd podczas obsługi przycisku profilu:', error);
                        await interaction.followUp({
                            content: 'Wystąpił błąd podczas aktualizacji profilu.',
                            ephemeral: true
                        });
                    }
                    return;
                }
            }
        }

        // Obsługa komend
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