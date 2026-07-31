const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  listPlaylists,
  getPlaylist,
  savePlaylist,
  markTracksDownloaded,
  updatePlaylistNames,
  deletePlaylist,
} = require("../controllers/playlists");

router.use(auth);

router.get("/", listPlaylists);
router.post("/", savePlaylist);
router.get("/:id", getPlaylist);
router.patch("/:id/names", updatePlaylistNames);
router.post("/:id/downloaded", markTracksDownloaded);
router.delete("/:id", deletePlaylist);

module.exports = router;
