/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'api_formfieldsubmission',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
            },
            value_string: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            value_text: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            value_boolean: {
                type: DataTypes.BOOLEAN,
                allowNull: true,
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
            form_field_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'api_formfield',
                    key: 'id',
                },
            },
            form_submission_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'api_formsubmission',
                    key: 'id',
                },
            },
            value_number: {
                type: DataTypes.BIGINT,
                allowNull: true,
            },
            value_select_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'api_formfieldoption',
                    key: 'id',
                },
            },
            value_email: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            value_date: {
                type: DataTypes.STRING,
                allowNull: true,
            },
        },
        {
            tableName: 'api_formfieldsubmission',
        }
    )
}
