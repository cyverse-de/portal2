/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'api_workshopcode',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
            },
            code: {
                type: DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true,
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize.fn('NOW'),
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize.fn('NOW'),
            },
            workshop_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'api_workshop',
                    key: 'id',
                },
                unique: true,
            },
            valid_ending_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            valid_starting_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
        },
        {
            tableName: 'api_workshopcode',
        }
    )
}
