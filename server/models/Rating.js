const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Rating = sequelize.define(
  "Rating",
  {
    user: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Source-independent id like "video:dQw4w9WgXcQ" or "playlist:PL123" so a
    // rating follows the song whether it shows up in search, a playlist or the
    // library.
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    stars: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 5 },
    },
  },
  {
    tableName: "ratings",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["user", "subject"],
      },
    ],
  },
);

module.exports = Rating;
