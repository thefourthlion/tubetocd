const express = require("express");
const router = express.Router();
const optionalAuth = require("../middleware/optionalAuth");
const {
  downloadMp3,
  downloadBatch,
  resolveInfo,
  streamMp3,
  searchYoutube,
} = require("../controllers/download");

router.post("/info", resolveInfo);
router.post("/search", searchYoutube);
router.get("/search", searchYoutube);
router.post("/", optionalAuth, downloadMp3);
router.post("/batch", optionalAuth, downloadBatch);
router.post("/stream", streamMp3);
router.get("/stream", streamMp3);

module.exports = router;
