// // mongoose connection and return the connection
// const mongoose = require("mongoose");
// const { MONGO_URI } = require("../config/constant");
// const { Schema } = mongoose;

// const connectDB = async () => {
//   mongoose.set("strictPopulate", false);

//   try {
//     const url =
//       process.env.NODE_ENV == "development" ? process.env.MONGO_URI : MONGO_URI;
//     const connection = await mongoose.connect(url, {});
//     console.log(`MongoDB connected: ${url}`);
//     return connection;
//   } catch (error) {
//     console.error(error);
//     process.exit(1);
//   }
// };

// module.exports = {
//   connectDB,
// };


// mongoose connection and return the connection
const mongoose = require("mongoose");
const { MONGO_URI } = require("../config/constant");

console.log(process.env)

console.log("=============================================================")
console.log("MONGO_URI", MONGO_URI, process.env.MONGO_URI);
console.log("=============================================================")

const connectDB = async () => {
  mongoose.set("strictPopulate", false);

  const url = process.env.MONGO_URI;

  console.log(url, "mongo URL");

  // Check existing connection
  if (mongoose.connection.readyState === 1) {
    console.log("MongoDB already connected");
    return mongoose.connection;
  }

  try {
    const connection = await mongoose.connect(url, {});
    console.log(`MongoDB connected: ${url}`);
    return connection;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

module.exports = {
  connectDB,
};
