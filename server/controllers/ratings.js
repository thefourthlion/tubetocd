const Rating = require("../models/Rating");

const SUBJECT_MAX_LENGTH = 255;

function readSubject(body) {
  const subject = String(body?.subject || "").trim();
  if (!subject || subject.length > SUBJECT_MAX_LENGTH) return null;
  return subject;
}

/** 1-5 sets a rating, 0 clears it. */
function readStars(body) {
  const stars = Number(body?.stars);
  if (!Number.isInteger(stars) || stars < 0 || stars > 5) return null;
  return stars;
}

exports.listRatings = async (req, res) => {
  try {
    const rows = await Rating.findAll({
      where: { user: String(req.user.id) },
      attributes: ["subject", "stars"],
    });

    const data = {};
    for (const row of rows) {
      data[row.subject] = row.stars;
    }

    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.setRating = async (req, res) => {
  try {
    const subject = readSubject(req.body);
    if (!subject) {
      return res.status(400).json({ error: "A rating subject is required" });
    }

    const stars = readStars(req.body);
    if (stars === null) {
      return res
        .status(400)
        .json({ error: "stars must be a whole number from 0 to 5" });
    }

    const user = String(req.user.id);

    if (stars === 0) {
      await Rating.destroy({ where: { user, subject } });
      return res.json({ subject, stars: null });
    }

    const existing = await Rating.findOne({ where: { user, subject } });
    if (existing) {
      await existing.update({ stars });
      return res.json({ subject, stars });
    }

    try {
      await Rating.create({ user, subject, stars });
    } catch (createErr) {
      // Two rapid clicks on the same row can both miss the lookup above.
      if (createErr?.name !== "SequelizeUniqueConstraintError") throw createErr;
      await Rating.update({ stars }, { where: { user, subject } });
      return res.json({ subject, stars });
    }

    res.status(201).json({ subject, stars });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
