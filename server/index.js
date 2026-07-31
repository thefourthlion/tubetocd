require("dotenv").config({ path: "./.env" });
const express = require("express");
const app = express();
const cors = require("cors");
const PORT = process.env.PORT || 3025;
const { connectDB } = require("./config/database");
const { corsOptions, allowedOrigins } = require("./config/cors");

// Register models before sync
require("./models/User");
require("./models/youtubeLinks");
require("./models/Playlist");
require("./models/PlaylistTrack");
require("./models/Rating");

// CORS must run before body parsers so oversized/error responses still include headers
// (otherwise the browser surfaces Axios "Network Error" instead of the real status).
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Large playlists (100+ tracks with metadata) exceed the default 100kb JSON limit.
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false, limit: "5mb" }));

// Connect to database
connectDB();

app.get("/", (req, res) => {
  res.json({
    app: "tubetocd-api",
    status: "running",
    port: PORT,
  });
});

// Auth routes
app.use("/api/auth", require("./routes/auth"));

// YouTube MP3 download
app.use("/api/download", require("./routes/download"));

// Saved links (auth required)
app.use("/api/youtubeLinks", require("./routes/youtubeLinks"));

// Saved playlists (auth required)
app.use("/api/playlists", require("./routes/playlists"));

// Combined library search (auth required)
app.use("/api/library", require("./routes/library"));

// Per-user star ratings (auth required)
app.use("/api/ratings", require("./routes/ratings"));

// AI helpers (OpenAI) — naming suggestions for convert/download UI
app.use("/api/ai", require("./routes/ai"));

app.listen(PORT, () => {
  console.log(`✅ TubeToCD API listening on port ${PORT}`);
  console.log(`   CORS origins: ${allowedOrigins().join(", ")}`);
}).setTimeout(15 * 60 * 1000); // long video converts need more than Node's default
