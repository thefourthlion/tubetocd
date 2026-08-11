const express = require("express");
const router = express.Router();
const optionalAuth = require("../middleware/optionalAuth");
const {
  downloadMp3,
  downloadBatch,
  startBatchJob,
  getBatchJob,
  downloadBatchJobFile,
  deleteBatchJob,
  resolveInfo,
  streamMp3,
  searchYoutube,
} = require("../controllers/download");

router.post("/info", resolveInfo);
router.post("/search", searchYoutube);
router.get("/search", searchYoutube);
router.post("/", optionalAuth, downloadMp3);

// Async batch jobs (preferred for large playlists — survives proxies/timeouts)
router.post("/batch/jobs", optionalAuth, startBatchJob);
router.get("/batch/jobs/:id", optionalAuth, getBatchJob);
router.get("/batch/jobs/:id/file", optionalAuth, downloadBatchJobFile);
router.delete("/batch/jobs/:id", optionalAuth, deleteBatchJob);

// Legacy sync batch (small selections only)
router.post("/batch", optionalAuth, downloadBatch);

router.post("/stream", streamMp3);
router.get("/stream", streamMp3);

module.exports = router;
