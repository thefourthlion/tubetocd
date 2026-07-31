const youtubeLinks = require("../models/youtubeLinks");

exports.createyoutubeLinks = async (req, res) => {
  try {
    const link = req.body.link;
    if (!link) {
      return res.status(400).json({ error: "link is required" });
    }

    const userId = String(req.user.id);
    const title = req.body.title || null;
    const videoId = req.body.videoId || null;

    // Heart / save should be idempotent: re-saving the same video updates
    // the row instead of creating duplicates.
    if (videoId) {
      const existing = await youtubeLinks.findOne({
        where: { user: userId, videoId },
      });
      if (existing) {
        await existing.update({ link, title: title ?? existing.title });
        return res.status(200).json(existing);
      }
    }

    const record = await youtubeLinks.create({
      link,
      user: userId,
      title,
      videoId,
    });
    res.status(201).json(record);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};

exports.readyoutubeLinks = async (req, res) => {
  const page = parseInt(req.query.page, 10) || 0;
  const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
  const offset = page * limit;

  try {
    const result = await youtubeLinks.findAndCountAll({
      where: { user: String(req.user.id) },
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });
    res.json({ data: result.rows, total: result.count, page, limit });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};

exports.readyoutubeLinksFromID = async (req, res) => {
  try {
    const result = await youtubeLinks.findOne({
      where: { id: req.params.id, user: String(req.user.id) },
    });
    if (!result) {
      return res.status(404).json({ error: "Record not found" });
    }
    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateyoutubeLinks = async (req, res) => {
  try {
    const record = await youtubeLinks.findOne({
      where: { id: req.params.id, user: String(req.user.id) },
    });
    if (!record) {
      return res.status(404).json({ error: "Record not found" });
    }

    await record.update({
      link: req.body.link ?? record.link,
      title: req.body.title ?? record.title,
      videoId: req.body.videoId ?? record.videoId,
    });
    res.json(record);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteyoutubeLinks = async (req, res) => {
  try {
    const deleted = await youtubeLinks.destroy({
      where: { id: req.params.id, user: String(req.user.id) },
    });
    if (deleted === 0) {
      return res.status(404).json({ error: "Record not found" });
    }
    res.json({ message: "Record deleted successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};
