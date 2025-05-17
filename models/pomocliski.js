const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Pomocliski', {
        discordID: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false
        },
        nazwaUnikalna: {
            type: DataTypes.STRING,
            allowNull: false
        },
        nazwaPrzyjazna: {
            type: DataTypes.STRING,
            defaultValue: ''
        },
    }, {
        tableName: 'Pomocliski', // Wymusza dokładną nazwę tabeli
        freezeTableName: true     // Zapobiega dodawaniu 's' na końcu
    });
};