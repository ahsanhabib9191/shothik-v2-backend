const humanizedScore = (req, res) => {
  try {
    const { text } = req.body;
    if (!text) throw { message: "Text is required" };
    const number = Math.floor(Math.random() * (97 - 80 + 1)) + 80;
    res.send({ success: true, data: number });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  humanizedScore,
};
