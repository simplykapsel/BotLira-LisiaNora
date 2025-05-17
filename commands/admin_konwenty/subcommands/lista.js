const { Op } = require('sequelize');
const { Pomocliski } = require('../../../models');

module.exports = async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    // Pobierz string z rolami
    const rolesString = interaction.options.getString('rangi');
    if (!rolesString) {
        return interaction.editReply({ content: 'Podaj przynajmniej jedną rolę.' });
    }

    // Wyciągnij ID ról poprzez regex
    const roleIDs = [...rolesString.matchAll(/<@&(\d+)>/g)].map(match => match[1]);
    if (roleIDs.length === 0) {
        return interaction.editReply({ content: 'Nie znaleziono poprawnych oznaczeń ról.' });
    }

    console.log(`[${new Date().toISOString()}] Znalezione ID ról: ${roleIDs.join(', ')}`);

    // Upewnij się, że wszyscy członkowie są załadowani
    console.log(`[${new Date().toISOString()}] Pobieram wszystkich członków serwera...`);
    await interaction.guild.members.fetch();
    console.log(`[${new Date().toISOString()}] Pobrano członków serwera.`);

    // Zbierz unikalnych członków z tych ról
    const members = new Map();
    for (const roleID of roleIDs) {
        const role = interaction.guild.roles.cache.get(roleID);
        if (role) {
            console.log(`[${new Date().toISOString()}] Rola ${role.name} (ID: ${roleID}) ma ${role.members.size} członków`);

            // Wypisz każdego członka roli
            role.members.forEach(member => {
                const memberInfo = {
                    id: member.id,
                    tag: member.user.tag,
                    username: member.user.username
                };
                console.log(`[${new Date().toISOString()}] Członek roli ${role.name}: ${JSON.stringify(memberInfo)}`);
                members.set(member.id, member);
            });
        } else {
            console.log(`[${new Date().toISOString()}] Nie znaleziono roli o ID: ${roleID}`);
        }
    }

    console.log(`[${new Date().toISOString()}] Łącznie znaleziono ${members.size} unikalnych członków`);

    if (members.size === 0) {
        return interaction.editReply({ content: 'Brak użytkowników z tych rang.' });
    }

    const usersToAdd = [];
    for (const member of members.values()) {
        const userData = {
            discordID: member.id,
            nazwaUnikalna: member.user.username,
            nazwaPrzyjazna: '',
        };
        usersToAdd.push(userData);
        console.log(`[${new Date().toISOString()}] Przygotowano do dodania: ${JSON.stringify(userData)}`);
    }

    // Sprawdź już istniejących
    const existing = await Pomocliski.findAll({
        where: { discordID: { [Op.in]: usersToAdd.map(u => u.discordID) } },
        attributes: ['discordID'],
    });

    console.log(`[${new Date().toISOString()}] Znaleziono już w bazie: ${existing.length} osób`);
    if (existing.length > 0) {
        for (const user of existing) {
            console.log(`[${new Date().toISOString()}] Już w bazie: ${user.discordID}`);
        }
    }

    const existingIDs = new Set(existing.map(e => e.discordID));
    const newUsers = usersToAdd.filter(u => !existingIDs.has(u.discordID));

    console.log(`[${new Date().toISOString()}] Do dodania: ${newUsers.length} użytkowników z ${usersToAdd.length} ogółem`);

    if (newUsers.length === 0) {
        return interaction.editReply({ content: 'Wszyscy użytkownicy już istnieją w bazie.' });
    }

    try {
        const result = await Pomocliski.bulkCreate(newUsers);
        console.log(`[${new Date().toISOString()}] Zapisano do bazy ${result.length} nowych użytkowników`);

        // Wypisz szczegóły nowo dodanych użytkowników
        for (const user of result) {
            console.log(`[${new Date().toISOString()}] Dodano do bazy: ${JSON.stringify({
                id: user.id,
                discordID: user.discordID,
                nazwaUnikalna: user.nazwaUnikalna
            })}`);
        }

        return interaction.editReply({
            content: `Dodano ${result.length} użytkowników do bazy danych.`,
        });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] BŁĄD: ${error.message}`, error);
        return interaction.editReply({
            content: `Wystąpił błąd podczas dodawania użytkowników: ${error.message}`,
        });
    }
};