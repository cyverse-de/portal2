/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'api_accessrequestquestion',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
            },
            type: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            question: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            is_required: {
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
            service_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'api_service',
                    key: 'id',
                },
            },
        },
        {
            tableName: 'api_accessrequestquestion',
        }
    )
}
