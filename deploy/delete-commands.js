const { REST, Routes } = require('discord.js');
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Deleting all global commands...');

        // Pobierz wszystkie globalne komendy
        const commands = await rest.get(
            Routes.applicationCommands(process.env.CLIENT_ID)
        );

        // Usuń każdą komendę z osobna
        for (const command of commands) {
            await rest.delete(
                Routes.applicationCommand(process.env.CLIENT_ID, command.id)
            );
            console.log(`Removed command: ${command.name}`);
        }

        console.log('All global commands have been removed.');
    } catch (error) {
        console.error(error);
    }
})();