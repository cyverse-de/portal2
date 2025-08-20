/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'django_cyverse_auth_token',
        {
            key: {
                type: DataTypes.STRING,
                allowNull: false,
                primaryKey: true,
            },
            api_server_url: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            remote_ip: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            issuer: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            issuedTime: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            expireTime: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'account_user',
                    key: 'id',
                },
            },
        },
        {
            tableName: 'django_cyverse_auth_token',
        }
    )
}
