const { DataTypes } = require('sequelize'); // Dodaj import DataTypes

module.exports = (sequelize) => {
    return sequelize.define('Dyzur', {
        // ID dyżuru (automatycznie generowane)
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        // ID konwentu (klucz obcy do tabeli Konwent)
        konwentId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        // Dzień tygodnia (niedziela, poniedziałek, wtorek, ...)
        dzienTygodnia: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        // Godzina w formacie "HH:00"
        godzina: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        // Nazwa osoby z arkusza
        osoba: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        // ID użytkownika Discord
        discordId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        // Czas trwania dyżuru w godzinach
        trwanieDyzuru: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
        },
        // Nazwa arkusza, z którego pochodzi dyżur
        arkusz: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        // Litera kolumny, z której pochodzi dyżur (C, D, E, ...)
        kolumna: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    }, {
        // Dodatkowe opcje
        tableName: 'Dyzur',
        timestamps: true
    });
};