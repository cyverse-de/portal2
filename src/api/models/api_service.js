/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'api_service',
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
            description: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            about: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            service_url: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            is_public: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
            },
            icon_url: {
                type: DataTypes.STRING,
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
            service_maintainer_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'api_servicemaintainer',
                    key: 'id',
                },
            },
            approval_key: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            subtitle: {
                type: DataTypes.STRING,
                allowNull: false,
            },
        },
        {
            tableName: 'api_service',
        }
    )
}
