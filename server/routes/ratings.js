const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { listRatings, setRating } = require("../controllers/ratings");

router.use(auth);

router.get("/", listRatings);
router.put("/", setRating);

module.exports = router;
