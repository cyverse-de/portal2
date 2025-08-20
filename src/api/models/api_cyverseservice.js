/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'api_cyverseservice',
        {
            service_ptr_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                references: {
                    model: 'api_service',
                    key: 'id',
                },
            },
            approval_request_url: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            grant_request_url: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            auto_add_new_users: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
            },
            grant_dag_id: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            review_dag_id: {
                type: DataTypes.STRING,
                allowNull: false,
            },
        },
        {
            tableName: 'api_cyverseservice',
        }
    )
}
