/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'api_formsubmissionconversation',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
            },
            intercom_message_id: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            intercom_conversation_id: {
                type: DataTypes.STRING,
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
            form_submission_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'api_formsubmission',
                    key: 'id',
                },
            },
        },
        {
            tableName: 'api_formsubmissionconversation',
        }
    )
}
