/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'api_workshopenrollmentrequestlog',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
            },
            status: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            message: {
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
            workshop_enrollment_request_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'api_workshopenrollmentrequest',
                    key: 'id',
                },
            },
        },
        {
            tableName: 'api_workshopenrollmentrequestlog',
        }
    )
}
