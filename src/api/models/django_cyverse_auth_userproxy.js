/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'django_cyverse_auth_userproxy',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
            },
            username: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            proxyIOU: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            proxyTicket: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            expiresOn: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'django_cyverse_auth_userproxy',
        }
    )
}
