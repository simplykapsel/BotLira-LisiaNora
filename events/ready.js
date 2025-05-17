const { Events } = require('discord.js');
const { initializeNotificationSystem } = require('../utils/notification-scheduler');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
        initializeNotificationSystem(client);
    },
};