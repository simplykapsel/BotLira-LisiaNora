const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const { sequelize } = require('./models');
sequelize.sync()
    .then(() => console.log('Modele zsynchronizowane z bazą danych'))
    .catch(err => console.error('Błąd synchronizacji bazy danych:', err));

// New client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // Pobierania członków
        GatewayIntentBits.GuildVoiceStates, // Ważne! Potrzebne do eventów związanych z kanałami głosowymi
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();
// Read path to command folder
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);
// Reads the command folders and loads commands into the client's command collection.
for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] Command ${filePath} is missing "data" or "execute" properties.`);
        }
    }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }

    console.log(`Załadowano event: ${event.name}`);
}

// Logs the client into Discord using the bot token from the environment variables.
// see https://discord.js.org/#/docs/discord.js/stable/class/Client|Discord.js Client Documentation

client.login(process.env.DISCORD_TOKEN);