const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { getLibrary } = require("../controllers/library");

router.use(auth);
router.get("/", getLibrary);

module.exports = router;
