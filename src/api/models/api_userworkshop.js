/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'api_userworkshop',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
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
            workshop_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'api_workshop',
                    key: 'id',
                },
            },
            workshop_enrollment_request_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'api_workshopenrollmentrequest',
                    key: 'id',
                },
            },
        },
        {
            tableName: 'api_userworkshop',
        }
    )
}
