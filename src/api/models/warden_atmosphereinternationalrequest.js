/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'warden_atmosphereinternationalrequest',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
            },
            project_title: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            project_description: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            scientific_description: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            technical_description: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            project_duration: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            project_resources: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            impact: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            collaborators: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            previous_interaction: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            other_funding_option: {
                type: DataTypes.TEXT,
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
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'account_user',
                    key: 'id',
                },
                unique: true,
            },
            funding_source_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'account_fundingagency',
                    key: 'id',
                },
            },
        },
        {
            tableName: 'warden_atmosphereinternationalrequest',
        }
    )
}
