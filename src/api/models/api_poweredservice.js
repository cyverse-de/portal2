/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'api_poweredservice',
        {
            service_ptr_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                references: {
                    model: 'api_service',
                    key: 'id',
                },
            },
        },
        {
            tableName: 'api_poweredservice',
        }
    )
}
