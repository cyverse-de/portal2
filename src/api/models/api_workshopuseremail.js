/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'api_workshopuseremail',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
            },
            email: {
                type: DataTypes.STRING,
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
        },
        {
            tableName: 'api_workshopuseremail',
        }
    )
}
