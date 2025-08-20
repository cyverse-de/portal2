/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'api_userservice',
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
            access_request_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'api_accessrequest',
                    key: 'id',
                },
            },
            service_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'api_service',
                    key: 'id',
                },
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
        },
        {
            tableName: 'api_userservice',
        }
    )
}
