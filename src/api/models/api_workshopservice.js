/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'api_workshopservice',
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
            service_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'api_service',
                    key: 'id',
                },
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
        },
        {
            tableName: 'api_workshopservice',
        }
    )
}
