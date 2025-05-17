const { ChannelType, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'voiceStateUpdate',
    once: false,
    async execute(oldState, newState) {
        // ID kanału, który będzie triggerował tworzenie prywatnego kanału
        const TRIGGER_CHANNEL_ID = '1373333341821997056'; // Zmień na właściwe ID kanału

        // Kategoria, w której ma być stworzony prywatny kanał
        const CATEGORY_ID = '713384936991883324'; // Opcjonalnie zmień na ID kategorii

        // Prefiks dla nazwy kanału
        const CHANNEL_PREFIX = '🔒 ';

        // Sprawdź czy użytkownik dołączył do kanału triggera
        if (newState.channelId === TRIGGER_CHANNEL_ID) {
            const { guild, member } = newState;

            try {
                // Tworzymy nazwę kanału
                const channelName = `${CHANNEL_PREFIX}${member.user.username}`;

                // Poczekaj chwilę aby być pewnym, że użytkownik jest na kanale triggera
                await new Promise(resolve => setTimeout(resolve, 500));

                // Upewnij się, że użytkownik nadal jest na kanale triggera
                // (może wyjść zanim zdążymy stworzyć kanał)
                if (member.voice.channelId !== TRIGGER_CHANNEL_ID) {
                    return;
                }

                // Sprawdź czy użytkownik już ma prywatny kanał
                const existingChannel = guild.channels.cache.find(
                    channel => channel.name === channelName &&
                        channel.type === ChannelType.GuildVoice
                );

                // Jeśli kanał już istnieje, przenieś użytkownika na ten kanał
                if (existingChannel) {
                    await member.voice.setChannel(existingChannel.id);
                    console.log(`Przeniesiono ${member.user.tag} do istniejącego kanału ${existingChannel.name}`);
                    return;
                }

                // Stwórz obiekt z uprawnieniami dla kanału
                const permissionOverwrites = [
                    // Domyślne uprawnienia dla wszystkich - brak dostępu
                    {
                        id: guild.roles.everyone.id,
                        deny: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.Connect
                        ]
                    },
                    // Uprawnienia dla twórcy kanału - pełne uprawnienia
                    {
                        id: member.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.Connect,
                            PermissionsBitField.Flags.Speak,
                            PermissionsBitField.Flags.Stream,
                            PermissionsBitField.Flags.UseVAD,
                            PermissionsBitField.Flags.PrioritySpeaker,
                            PermissionsBitField.Flags.MuteMembers,
                            PermissionsBitField.Flags.DeafenMembers,
                            PermissionsBitField.Flags.MoveMembers,
                            PermissionsBitField.Flags.ManageChannels
                        ]
                    }
                ];

                // Opcje dla nowego kanału
                const channelOptions = {
                    type: ChannelType.GuildVoice,
                    permissionOverwrites: permissionOverwrites,
                    parent: CATEGORY_ID || null // Jeśli podano ID kategorii, umieść kanał w tej kategorii
                };

                // Stwórz nowy kanał
                const channel = await guild.channels.create({
                    name: channelName,
                    ...channelOptions
                });

                console.log(`Stworzono nowy kanał prywatny ${channel.name} dla ${member.user.tag}`);

                // Przenieś użytkownika na nowo utworzony kanał
                await member.voice.setChannel(channel.id);
                console.log(`Przeniesiono ${member.user.tag} na kanał ${channel.name}`);

                // Dodatkowe info w konsoli
                console.log(`Kanał ${channel.name} (${channel.id}) utworzony dla ${member.user.tag} (${member.id})`);

            } catch (error) {
                console.error(`Błąd podczas tworzenia prywatnego kanału: ${error}`);
            }
        }

        // Opcjonalnie: usuń prywatny kanał, gdy ostatni użytkownik opuści kanał
        // Dodajemy sprawdzenie czy oldState.channel istnieje
        if (
            oldState.channel && // Sprawdzamy, czy kanał istnieje
            oldState.channel.name && // Sprawdzamy, czy nazwa kanału istnieje
            oldState.channel.name.startsWith(CHANNEL_PREFIX) &&
            oldState.channel.members.size === 0
        ) {
            try {
                const channelName = oldState.channel.name; // Zapisujemy nazwę przed usunięciem
                await oldState.channel.delete();
                console.log(`Usunięto pusty kanał prywatny ${channelName}`);
            } catch (error) {
                console.error(`Błąd podczas usuwania prywatnego kanału: ${error}`);
            }
        }
    },
};