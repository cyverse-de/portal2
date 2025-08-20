/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'account_user_user_permissions',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'account_user',
                    key: 'id',
                },
                unique: true,
            },
            permission_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'auth_permission',
                    key: 'id',
                },
            },
        },
        {
            tableName: 'account_user_user_permissions',
        }
    )
}
