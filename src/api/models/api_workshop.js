/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'api_workshop',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
            },
            title: {
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
            creator_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'account_user',
                    key: 'id',
                },
            },
            about: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            enrollment_begins: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            enrollment_ends: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            contact_email: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            contact_name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            end_date: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            start_date: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            is_public: {
                type: DataTypes.BOOLEAN,
                allowNull: true,
                defaultValue: false,
            },
        },
        {
            tableName: 'api_workshop',
        }
    )
}
