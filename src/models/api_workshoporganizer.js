/* jshint indent: 2 */

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('api_workshoporganizer', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.fn('NOW')
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.fn('NOW')
    },
    organizer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'account_user',
        key: 'id'
      }
    },
    workshop_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'api_workshop',
        key: 'id'
      },
      unique: true
    }
  }, {
    tableName: 'api_workshoporganizer'
  });
};
