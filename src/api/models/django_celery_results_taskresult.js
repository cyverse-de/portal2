/* jshint indent: 2 */

module.exports = function (sequelize, DataTypes) {
    return sequelize.define(
        'django_celery_results_taskresult',
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
            },
            task_id: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            status: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            content_type: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            content_encoding: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            result: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            date_done: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            traceback: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            hidden: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
            },
            meta: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
        },
        {
            tableName: 'django_celery_results_taskresult',
        }
    )
}
