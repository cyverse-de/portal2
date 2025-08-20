/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'api_poweredservicepoweredbyoption',
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
            powered_by_option_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'api_poweredbyoption',
                    key: 'id',
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
        },
        {
            tableName: 'api_poweredservicepoweredbyoption',
        }
    )
}
