/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'api_formfield',
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
            type: {
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
            form_section_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'api_formsection',
                    key: 'id',
                },
            },
            index: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            is_required: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
            },
            conversion_key: {
                type: DataTypes.STRING,
                allowNull: true,
            },
        },
        {
            tableName: 'api_formfield',
        }
    )
}
