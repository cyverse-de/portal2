/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'api_form',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
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
            description: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            explanation: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            intercom_team_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            is_public: {
                type: DataTypes.BOOLEAN,
                allowNull: true,
                defaultValue: false,
            },
        },
        {
            tableName: 'api_form',
        }
    )
}
