const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const Playlist = require("./Playlist");

const PlaylistTrack = sequelize.define(
  "PlaylistTrack",
  {
    playlistId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    user: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    videoId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    link: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    uploader: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    filename: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    filesize: {
      // BIGINT: estimated playlist filesizes can exceed 32-bit INT
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    viewCount: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    thumbnail: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    trackIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    downloaded: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "playlist_tracks",
    timestamps: true,
  },
);

Playlist.hasMany(PlaylistTrack, {
  foreignKey: "playlistId",
  as: "tracks",
  onDelete: "CASCADE",
});
PlaylistTrack.belongsTo(Playlist, {
  foreignKey: "playlistId",
  as: "playlist",
});

module.exports = PlaylistTrack;
