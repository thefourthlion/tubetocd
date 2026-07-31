const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const User = sequelize.define("User", {
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: { msg: "Please provide a valid email" },
      notEmpty: { msg: "Please provide email" },
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Please provide password" },
      len: { args: [6, 255], msg: "Password must be at least 6 characters" },
    },
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: "users",
  timestamps: true,
});

module.exports = User;
