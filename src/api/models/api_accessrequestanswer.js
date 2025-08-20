/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'api_accessrequestanswer',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
            },
            value_char: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            value_text: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            value_bool: {
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
            access_request_question_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'api_accessrequestquestion',
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
            tableName: 'api_accessrequestanswer',
        }
    )
}
