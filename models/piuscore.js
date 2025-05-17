const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('PiuScore', {
        userId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        level: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        mode: {
            type: DataTypes.ENUM('single', 'double'),
            allowNull: false,
        },
        proofUrl: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    });
};
