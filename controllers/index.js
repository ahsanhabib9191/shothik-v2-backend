const { admin, Configuration } = require("../lib/lib");

// use local cache for open api api
var openApiCache = null;
const getOpenAIAPIConfiguration = async () => {
  if (openApiCache !== null) {
    return openApiCache;
  }

  const docRef = admin.firestore().collection("settings").doc("credentials");
  const doc = await docRef.get();

  const configuration = new Configuration({
    apiKey: doc.data().openai,
  });

  openApiCache = configuration;
  return configuration;
};

const getAi21APIConfiguration = async () => {
  const docRef = admin.firestore().collection("settings").doc("credentials");
  const doc = await docRef.get();

  return doc.data().ai21;
};
const getParaphraseAppConfiguration = async () => {
  const docRef = admin.firestore().collection("settings").doc("credentials");
  const doc = await docRef.get();

  return doc.data().paraphraseApp;
};

// Middleware for Firebase Authentication
const authenticateUser = async (req, res, next) => {
  try {
    const { token } = req.headers;
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Invalid or missing authentication token",
    });
  }
};

const resolveReferences = async (data) => {
  if (typeof data === "object" && data !== null) {
    if (data instanceof admin.firestore.DocumentReference) {
      const collectionName = data.parent.id;
      const docId = data.id;
      return `${collectionName}/${docId}`;
    }
    if (Array.isArray(data)) {
      return Promise.all(data.map(resolveReferences));
    }
    const keys = Object.keys(data);
    await Promise.all(
      keys.map(async (key) => {
        const value = data[key];
        data[key] = await resolveReferences(value);
      })
    );
    return data;
  }
  return data;
};

module.exports = {
  resolveReferences,
  getOpenAIAPIConfiguration,
  getAi21APIConfiguration,
  getParaphraseAppConfiguration,
  authenticateUser,
};
