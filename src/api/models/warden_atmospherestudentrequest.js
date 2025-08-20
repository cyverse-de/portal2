/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'warden_atmospherestudentrequest',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
            },
            sponsor: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            sponsor_email: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            use_case: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            project_name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            project_description: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            project_resources: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            other: {
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
            project_duration: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
        },
        {
            tableName: 'warden_atmospherestudentrequest',
        }
    )
}
