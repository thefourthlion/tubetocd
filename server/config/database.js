const path = require("path");
const { Sequelize } = require("sequelize");

const dbPath =
  process.env.DATABASE_PATH || path.join(__dirname, "../data/database.sqlite");

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: dbPath,
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

/**
 * Older Playlist models marked `user` and `youtubePlaylistId` UNIQUE individually.
 * SQLite keeps those constraints after Sequelize model changes, and
 * `sync({ alter: true })` rebuilds via playlists_backup using the stale UNIQUE —
 * which fails when multiple users save the same YouTube playlist.
 *
 * Rebuild so only (user, youtubePlaylistId) is unique. Runs before sync.
 */
async function repairPlaylistsSchema() {
  const [tables] = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='playlists'",
  );
  if (!tables.length) return;

  const [createRows] = await sequelize.query(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='playlists'",
  );
  const createSql = createRows[0]?.sql || "";

  const [indexRows] = await sequelize.query(
    "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='playlists'",
  );
  const hasBadColumnUnique =
    /`user`[^,]*\bUNIQUE\b/i.test(createSql) ||
    /`youtubePlaylistId`[^,]*\bUNIQUE\b/i.test(createSql) ||
    indexRows.some((idx) => {
      const sql = idx.sql || "";
      const name = idx.name || "";
      if (!sql && /youtubePlaylistId|playlists_youtube/i.test(name)) return true;
      // Single-column unique on youtubePlaylistId or user only
      return (
        /\bUNIQUE\b/i.test(sql) &&
        !/\(.*user.*youtubePlaylistId.*\)/i.test(sql) &&
        !/\(.*youtubePlaylistId.*user.*\)/i.test(sql) &&
        (/youtubePlaylistId/i.test(sql) ||
          /\(.*\buser\b.*\)/i.test(sql) ||
          /playlists_youtube_playlist_id/i.test(name) ||
          /playlists_user$/i.test(name))
      );
    });

  const [composite] = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='index' AND name='playlists_user_youtube_playlist_id'",
  );
  const needsComposite = composite.length === 0;

  if (!hasBadColumnUnique && !needsComposite) return;

  if (hasBadColumnUnique) {
    console.log("⚠️  Repairing playlists unique constraints…");
    await sequelize.query("PRAGMA foreign_keys=OFF");
    await sequelize.transaction(async (t) => {
      await sequelize.query(`DROP TABLE IF EXISTS playlists_repair`, {
        transaction: t,
      });
      await sequelize.query(
        `CREATE TABLE playlists_repair (
          id INTEGER PRIMARY KEY,
          user VARCHAR(255) NOT NULL,
          youtubePlaylistId VARCHAR(255) NOT NULL,
          kind VARCHAR(32) NOT NULL DEFAULT 'playlist',
          youtubeChannelId VARCHAR(255),
          handle VARCHAR(255),
          title VARCHAR(255) NOT NULL,
          uploader VARCHAR(255),
          sourceUrl TEXT NOT NULL,
          trackCount INTEGER NOT NULL DEFAULT 0,
          createdAt DATETIME NOT NULL,
          updatedAt DATETIME NOT NULL
        )`,
        { transaction: t },
      );
      // Keep one row per (user, youtubePlaylistId) if duplicates exist.
      await sequelize.query(
        `INSERT INTO playlists_repair
          (id, user, youtubePlaylistId, kind, youtubeChannelId, handle, title, uploader, sourceUrl, trackCount, createdAt, updatedAt)
         SELECT id, user, youtubePlaylistId,
           COALESCE(kind, 'playlist'), youtubeChannelId, handle,
           title, uploader, sourceUrl, trackCount, createdAt, updatedAt
         FROM playlists
         WHERE id IN (
           SELECT MAX(id) FROM playlists GROUP BY user, youtubePlaylistId
         )`,
        { transaction: t },
      );
      await sequelize.query("DROP TABLE playlists", { transaction: t });
      await sequelize.query(
        "ALTER TABLE playlists_repair RENAME TO playlists",
        { transaction: t },
      );
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS playlists_user_youtube_playlist_id
         ON playlists (user, youtubePlaylistId)`,
        { transaction: t },
      );
    });
    await sequelize.query("PRAGMA foreign_keys=ON");
    console.log("✅ Playlists schema repaired");
    return;
  }

  if (needsComposite) {
    await sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS playlists_user_youtube_playlist_id
       ON playlists (user, youtubePlaylistId)`,
    );
    console.log("✅ Playlists composite unique index ensured");
  }
}

/** Add channel columns on existing SQLite DBs (sync() does not alter). */
async function ensurePlaylistColumns() {
  const [tables] = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='playlists'",
  );
  if (!tables.length) return;

  const [cols] = await sequelize.query("PRAGMA table_info(playlists)");
  const names = new Set(cols.map((c) => c.name));

  if (!names.has("kind")) {
    await sequelize.query(
      "ALTER TABLE playlists ADD COLUMN kind VARCHAR(32) NOT NULL DEFAULT 'playlist'",
    );
    console.log("✅ playlists.kind column added");
  }
  if (!names.has("youtubeChannelId")) {
    await sequelize.query(
      "ALTER TABLE playlists ADD COLUMN youtubeChannelId VARCHAR(255)",
    );
    console.log("✅ playlists.youtubeChannelId column added");
  }
  if (!names.has("handle")) {
    await sequelize.query(
      "ALTER TABLE playlists ADD COLUMN handle VARCHAR(255)",
    );
    console.log("✅ playlists.handle column added");
  }
}

/** Add track columns on existing SQLite DBs (sync() does not alter). */
async function ensurePlaylistTrackColumns() {
  const [tables] = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='playlist_tracks'",
  );
  if (!tables.length) return;

  const [cols] = await sequelize.query("PRAGMA table_info(playlist_tracks)");
  const names = new Set(cols.map((c) => c.name));

  if (!names.has("viewCount")) {
    await sequelize.query(
      "ALTER TABLE playlist_tracks ADD COLUMN viewCount BIGINT",
    );
    console.log("✅ playlist_tracks.viewCount column added");
  }
}

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");
    // Columns first so repair SELECT/INSERT can reference them.
    await ensurePlaylistColumns();
    await ensurePlaylistTrackColumns();
    // Repair BEFORE sync — alter:true on SQLite reintroduces stale column UNIQUEs.
    await repairPlaylistsSchema();
    // Avoid alter:true; it rebuilds via playlists_backup and breaks multi-user playlist saves.
    await sequelize.sync();
    await repairPlaylistsSchema();
    await ensurePlaylistColumns();
    await ensurePlaylistTrackColumns();
    console.log("✅ Database synchronized");
  } catch (error) {
    console.error("❌ Unable to connect to the database:", error);
  }
};

module.exports = { sequelize, connectDB };
