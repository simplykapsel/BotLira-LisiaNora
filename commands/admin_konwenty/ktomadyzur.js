const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Dyzur, Konwent } = require('../../models');
const { Sequelize, Op } = require('sequelize');

// Funkcja do uzyskania czasu warszawskiego
function getWarsawTime(date = new Date()) {
    return new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ktomadyzur')
        .setDescription('Pokazuje kto aktualnie ma dyżur'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Pobierz aktualny czas w strefie czasowej Warsaw
            const teraz = getWarsawTime();
            const aktualnaGodzina = teraz.getHours();

            // Pobierz dzień tygodnia zgodny z czasem warszawskim
            const dniTygodnia = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
            const dzienTygodnia = dniTygodnia[teraz.getDay()];

            // Format godziny do wyświetlenia "HH:00"
            const godzinaFormat = `${String(aktualnaGodzina).padStart(2, '0')}:00`;

            console.log(`DEBUG: Sprawdzanie dyżurów na dzień ${dzienTygodnia} o godzinie ${godzinaFormat}`);

            // Pobierz aktywne konwenty
            const aktywneKonwenty = await Konwent.findAll({
                where: {
                    powiadomieniaAktywne: true,
                    dataStart: { [Op.lte]: new Date() },
                    dataKoniec: { [Op.gte]: new Date() },
                },
            });

            if (aktywneKonwenty.length === 0) {
                return interaction.editReply('Aktualnie nie ma żadnych aktywnych konwentów.');
            }

            const konwentyIds = aktywneKonwenty.map(k => k.id);

            // Przygotuj warunki zapytania
            const whereConditions = {
                konwentId: konwentyIds,
                dzienTygodnia: dzienTygodnia,
            };

            // Warunek na godzinę rozpoczęcia dyżuru
            // Sprawdź dyżury, które zaczynają się w aktualnej godzinie lub wcześniej
            whereConditions.godzina = Sequelize.where(
                Sequelize.fn('SUBSTR', Sequelize.col('godzina'), 1, 2),
                '<=',
                String(aktualnaGodzina).padStart(2, '0')
            );

            // Pobierz dyżury
            const dyzury = await Dyzur.findAll({
                where: whereConditions,
                include: [{ model: Konwent }],
                order: [
                    ['osoba', 'ASC']
                ]
            });

            // Filtruj dyżury, które są aktualnie w trakcie
            const aktualneDyzury = dyzury.filter(dyzur => {
                const godzinaStart = parseInt(dyzur.godzina.split(':')[0]);
                const godzinaKoniec = (godzinaStart + dyzur.trwanieDyzuru) % 24;

                // Sprawdź, czy aktualnaGodzina mieści się w przedziale czasowym dyżuru
                if (godzinaStart <= godzinaKoniec) {
                    return aktualnaGodzina >= godzinaStart && aktualnaGodzina < godzinaKoniec;
                } else {
                    // Dyżur przechodzi przez północ
                    return aktualnaGodzina >= godzinaStart || aktualnaGodzina < godzinaKoniec;
                }
            });

            if (aktualneDyzury.length === 0) {
                return interaction.editReply('Aktualnie nikt nie ma dyżuru.');
            }

            // Przygotuj embeda
            const embed = new EmbedBuilder()
                .setTitle(`Aktualne dyżury (${godzinaFormat})`)
                .setDescription(`Dzień tygodnia: ${dzienTygodnia}`)
                .setColor('#00AAFF')
                .setTimestamp();

            // Zbierz wszystkie unikalne strefy ze wszystkich dyżurów
            const wszystkieStrefy = new Set();

            for (const dyzur of aktualneDyzury) {
                // Rozdziel nazwy stref, jeśli zawierają przecinki
                const strefy = dyzur.arkusz.split(',').map(s => s.trim());
                strefy.forEach(strefa => wszystkieStrefy.add(strefa));
            }

            // Posortuj strefy alfabetycznie
            const posortowaneStrefy = [...wszystkieStrefy].sort();

            // Dla każdej unikalnej strefy, znajdź dyżury
            for (const strefa of posortowaneStrefy) {
                const dyzuryWStrefie = aktualneDyzury.filter(dyzur => {
                    // Sprawdź, czy dyżur jest przypisany do tej strefy
                    const strefyDyzuru = dyzur.arkusz.split(',').map(s => s.trim());
                    return strefyDyzuru.includes(strefa);
                });

                if (dyzuryWStrefie.length === 0) continue;

                // Przygotuj treść pola dla tej strefy
                let fieldContent = '';

                for (const dyzur of dyzuryWStrefie) {
                    const godzinaStart = parseInt(dyzur.godzina.split(':')[0]);
                    const godzinaKoniec = (godzinaStart + dyzur.trwanieDyzuru) % 24;
                    const koniecDyzuru = `${String(godzinaKoniec).padStart(2, '0')}:00`;

                    fieldContent += `<@${dyzur.discordId}> - ${dyzur.godzina} do ${koniecDyzuru}\n`;
                    fieldContent += `Konwent: **${dyzur.Konwent.nazwa}**\n\n`;
                }

                // Dodaj pole dla tej strefy
                embed.addFields({
                    name: `Strefa: ${strefa}`,
                    value: fieldContent || 'Brak dyżurów',
                });
            }

            // Dodaj informację o liczbie dyżurów
            embed.setFooter({
                text: `Znaleziono ${aktualneDyzury.length} aktualnych dyżurów`
            });

            return interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Błąd podczas sprawdzania aktualnych dyżurów:', error);
            return interaction.editReply('Wystąpił błąd podczas sprawdzania aktualnych dyżurów.');
        }
    },
};