const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  createyoutubeLinks,
  readyoutubeLinks,
  readyoutubeLinksFromID,
  updateyoutubeLinks,
  deleteyoutubeLinks,
} = require("../controllers/youtubeLinks");

router.use(auth);

router.route("/create").post(createyoutubeLinks);
router.route("/read").get(readyoutubeLinks);
router.route("/read/:id").get(readyoutubeLinksFromID);
router.route("/update/:id").put(updateyoutubeLinks);
router.route("/delete/:id").delete(deleteyoutubeLinks);

module.exports = router;
