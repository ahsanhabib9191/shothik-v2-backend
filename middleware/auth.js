"use strict";

const jwt = require("jsonwebtoken");
const config = process.env;

exports.auth = (req, res, next) => {
  let token = req.headers["authorization"];
  const IP = (
    req.headers["cf-connecting-ip"] ||
    req.headers["x-real-ip"] ||
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    "unknown"
  ).split(",")[0];
  const browserAgent = req.headers["user-agent"];

  if (!token) {
    req.userIp = IP;
    req.browserAgent = String(browserAgent).toLowerCase();
    return res
      .status(401)
      .json({ message: "Authorization Bearer token is required!" });
  }

  try {
    token = token.replace("Bearer", "");
    token = token.replace(" ", "");
    const decoded = jwt.verify(token, config.JWT_SECRET ?? "secret");
    req.user = decoded;
    req.id = decoded._id;
    req.email = decoded.email;
    req.package = decoded.package;
    req.is_verified = decoded.is_verified;
    req.userIp = IP;
    req.browserAgent = String(browserAgent).toLowerCase();
  } catch (err) {
    return res.status(401).json({ message: "unauthorized" });
  }
  return next();
};

// optional auth
exports.authOptional = (req, res, next) => {
  try {
    let token = req.headers["authorization"];
    const fingerprint = req.headers["x-fingerprint"];
    const IP = (
      fingerprint ||
      req.headers["cf-connecting-ip"] ||
      req.headers["x-real-ip"] ||
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      "unknown"
    ).split(",")[0];
    const browserAgent = req.headers["user-agent"];

    if (!token) {
      req.userIp = IP;
      req.browserAgent = String(browserAgent).toLowerCase();
      return next();
    }

    token = token.replace("Bearer", "");
    token = token.replace(" ", "");
    const decoded = jwt.verify(token, config.JWT_SECRET ?? "secret");
    req.token = token;
    req.user = decoded;
    req.id = decoded._id;
    req.email = decoded.email;
    req.package = decoded.package;
    req.is_verified = decoded.is_verified;
    req.userIp = IP;
    req.browserAgent = String(browserAgent).toLowerCase();

    return next();
  } catch (error) {
    console.log("Error from authOptional Middlware iteselt ", error);
    next(error);
  }
};

exports.verifyAuth = (req, res, next) => {
  try {
    let token = req.headers["authorization"];
    const fingerprint = req.headers["x-fingerprint"];
    const browserAgent = req.headers["user-agent"];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
        error: "UNAUTHORIZED",
      });
    }

    token = token.replace("Bearer", "");
    token = token.replace(" ", "");
    const decoded = jwt.verify(token, config.JWT_SECRET ?? "secret");
    const IP = (
      fingerprint ||
      req.headers["cf-connecting-ip"] ||
      req.headers["x-real-ip"] ||
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      "unknown"
    ).split(",")[0];

    req.token = token;
    req.user = decoded;
    req.id = decoded._id;
    req.role = decoded.role;
    req.email = decoded.email;
    req.package = decoded.package;
    req.is_verified = decoded.is_verified;
    req.userIp = IP;
    req.browserAgent = String(browserAgent).toLowerCase();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: "UNAUTHORIZED",
      message: "unauthorized user",
    });
  }
  return next();
};

exports.authAdmin = (req, res, next) => {
  let token = req.headers["authorization"];
  if (!token) {
    return res
      .status(401)
      .json({ message: "Authorization Bearer token is required!" });
  }

  try {
    token = token.replace("Bearer", "");
    token = token.replace(" ", "");
    const decoded = jwt.verify(token, config.JWT_SECRET ?? "secret");

    if (!/super_admin|admin|editor/.test(decoded.role)) {
      return res.status(401).json({ message: "unauthorized user" });
    }

    req.id = decoded.id;
    req.role = decoded.role;
    req.name = decoded.name;
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: "unauthorized user" });
  }
  return next();
};
