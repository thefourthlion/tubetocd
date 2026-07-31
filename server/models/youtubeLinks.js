const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const youtubeLinks = sequelize.define(
  "youtubeLinks",
  {
    link: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: { msg: "Please provide link" },
      },
    },
    user: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: { msg: "Please provide user" },
      },
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    videoId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "youtubelinkss",
    timestamps: true,
  },
);

module.exports = youtubeLinks;
