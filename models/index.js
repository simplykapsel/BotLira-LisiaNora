const { Sequelize } = require('sequelize');
const PiuScoreModel = require('./piuscore');
const PomocliskiModel = require('./pomocliski');
const KonwentModel = require('./konwent');
const DyzurModel = require('./dyzur');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false
});

const PiuScore = PiuScoreModel(sequelize);
const Pomocliski = PomocliskiModel(sequelize);
const Konwent = KonwentModel(sequelize);
const Dyzur = DyzurModel(sequelize);

// Ustaw asocjacje
Dyzur.belongsTo(Konwent, {
    foreignKey: 'konwentId',
    onDelete: 'CASCADE',
});
Konwent.hasMany(Dyzur, {
    foreignKey: 'konwentId'
});

module.exports = {
    sequelize,
    PiuScore,
    Pomocliski,
    Konwent,
    Dyzur
};