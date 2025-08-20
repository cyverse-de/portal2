/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'api_mailinglist',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            list_name: {
                type: DataTypes.STRING,
                allowNull: false,
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
            service_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'api_cyverseservice',
                    key: 'service_ptr_id',
                },
            },
        },
        {
            tableName: 'api_mailinglist',
        }
    )
}
