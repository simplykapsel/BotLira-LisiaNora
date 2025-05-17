const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Konwent', {
        nazwa: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false
        },
        dataStart: {
            type: DataTypes.DATE,
            allowNull: false
        },
        dataKoniec: {
            type: DataTypes.DATE,
            allowNull: false
        },
        linkArkusz: {
            type: DataTypes.STRING,
            allowNull: false
        },
        osobyDyzurujace: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        powiadomieniaAktywne: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'Konwenty',
        freezeTableName: true
    });
};