/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'api_formintercomteam',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
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
            form_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'api_form',
                    key: 'id',
                },
            },
            intercom_team_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'api_intercomteam',
                    key: 'id',
                },
            },
        },
        {
            tableName: 'api_formintercomteam',
        }
    )
}
