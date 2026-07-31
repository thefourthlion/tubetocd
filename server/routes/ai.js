const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { nameTracks } = require("../controllers/ai");

router.post("/name-tracks", auth, nameTracks);

module.exports = router;
