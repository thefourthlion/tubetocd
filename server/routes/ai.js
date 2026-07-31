const express = require("express");
const router = express.Router();
const { nameTracks } = require("../controllers/ai");

router.post("/name-tracks", nameTracks);

module.exports = router;
