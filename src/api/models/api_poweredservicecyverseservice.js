/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'api_poweredservicecyverseservice',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
            },
            cyverse_service_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'api_cyverseservice',
                    key: 'service_ptr_id',
                },
            },
            powered_service_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'api_poweredservice',
                    key: 'service_ptr_id',
                },
                unique: true,
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
        },
        {
            tableName: 'api_poweredservicecyverseservice',
        }
    )
}
