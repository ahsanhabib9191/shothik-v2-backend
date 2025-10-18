const AgentModel = require("../mongo/models/Agent");

async function getSession(req, res) {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      throw { message: "Invalid argument" };
    }

    const session = await AgentModel.find({ user_id: user_id }).sort({
      createdAt: -1,
    });
    res.send({ data: session, success: true });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: error.message, success: false });
  }
}
async function getSessionById(req, res) {
  try {
    const { session_id } = req.params;
    if (!session_id) {
      throw { message: "Invalid argument" };
    }

    const session = await AgentModel.findById(session_id);
    res.send({ data: session, success: true });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: error.message, success: false });
  }
}

module.exports = { getSession, getSessionById };
