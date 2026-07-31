const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Playlist = sequelize.define(
  "Playlist",
  {
    user: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    youtubePlaylistId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    /** Discriminator: "playlist" (default) or "channel". */
    kind: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "playlist",
    },
    /** YouTube channel id (UC…) when kind is channel. */
    youtubeChannelId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    /** @handle when known. */
    handle: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    uploader: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sourceUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    trackCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "playlists",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["user", "youtubePlaylistId"],
      },
    ],
  },
);

module.exports = Playlist;
