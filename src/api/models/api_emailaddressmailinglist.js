/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'api_emailaddressmailinglist',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
            },
            is_subscribed: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
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
            email_address_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'account_emailaddress',
                    key: 'id',
                },
                unique: true,
            },
            mailing_list_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'api_mailinglist',
                    key: 'id',
                },
            },
        },
        {
            tableName: 'api_emailaddressmailinglist',
        }
    )
}
