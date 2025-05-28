const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

// Stałe dla trybów gry
const GAME_MODES = {
    SINGLE: 'single',
    DOUBLE: 'double'
};

// Maksymalne poziomy dla trybów
const MAX_LEVELS = {
    [GAME_MODES.SINGLE]: 27,
    [GAME_MODES.DOUBLE]: 29
};

/**
 * Waliduje czy podany URL jest poprawnym adresem obrazu
 */
function isValidImageUrl(url) {
    try {
        const parsedUrl = new URL(url);
        // Sprawdza czy URL ma protokół http lub https
        if (!parsedUrl.protocol.match(/^https?:$/)) {
            return false;
        }

        // Sprawdza czy URL wskazuje na znane serwisy hostingowe
        const allowedHosts = [
            'imgur.com', 'i.imgur.com',
            'cdn.discordapp.com', 'media.discordapp.net',
            'ibb.co', 'i.ibb.co',
            'postimg.cc', 'i.postimg.cc',
            'prnt.sc', 'prntscr.com',
            'gyazo.com', 'i.gyazo.com'
            // Możesz dodać więcej dozwolonych hostów
        ];

        const isAllowedHost = allowedHosts.some(host =>
            parsedUrl.hostname === host || parsedUrl.hostname.endsWith('.' + host)
        );

        if (!isAllowedHost) {
            return false;
        }

        // Sprawdza czy URL kończy się rozszerzeniem obrazu
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const hasImageExtension = imageExtensions.some(ext =>
            parsedUrl.pathname.toLowerCase().endsWith(ext)
        );

        // Wymagamy, aby WSZYSTKIE linki kończyły się rozszerzeniem pliku graficznego
        if (!hasImageExtension) {
            return false;
        }

        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Tworzy przyciski do przełączania pomiędzy trybami (single/double)
 */
function createModeToggleButtons(currentMode, customId) {
    const singleButton = new ButtonBuilder()
        .setCustomId(`${customId}_single`)
        .setLabel('Single')
        .setStyle(currentMode === GAME_MODES.SINGLE ? ButtonStyle.Danger : ButtonStyle.Secondary);

    const doubleButton = new ButtonBuilder()
        .setCustomId(`${customId}_double`)
        .setLabel('Double')
        .setStyle(currentMode === GAME_MODES.DOUBLE ? ButtonStyle.Success : ButtonStyle.Secondary);

    return new ActionRowBuilder().addComponents(singleButton, doubleButton);
}

module.exports = {
    GAME_MODES,
    MAX_LEVELS,
    isValidImageUrl,
    createModeToggleButtons,

    // Dodaj te właściwości, aby uniknąć błędów wczytywania komendy
    data: { name: 'utils', description: 'Ten plik nie jest komendą' },
    execute: async function() { /* Ten plik nie jest faktyczną komendą */ }
};