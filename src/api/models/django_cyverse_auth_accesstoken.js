/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'django_cyverse_auth_accesstoken',
        {
            key: {
                type: DataTypes.STRING,
                allowNull: false,
                primaryKey: true,
            },
            issuer: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            expireTime: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'django_cyverse_auth_accesstoken',
        }
    )
}
