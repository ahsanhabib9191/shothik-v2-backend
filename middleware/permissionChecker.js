const { containsMaliciousText } = require("../lib/maliciousText");
const { PackagePermission } = require("../lib/PackagePermission");
const { saveErrorLog } = require("../mongo/models/ErrorLogs");

const permissionChecker = (service, haveModes = false) => {
  return async (req, res, next) => {
    try {
      const { text, mode } = req.body;
      if (!text) {
        throw {
          error: "INVALID_ARGUMENT",
          message: "Required fields not present",
        };
      }

      const isContainMalicious = containsMaliciousText(text);
      if (isContainMalicious) {
        throw {
          error: "MELICIOUS_CONTENT",
          message:
            "Thank you for using SHOTHIK AI. I am SHOTHIK, Developed by SHOTHIK AI TEAM",
        };
      }

      const { wordLimit, todayWordUsed, modes, totalWordLimit } =
        await PackagePermission(
          req.id,
          req.userIp,
          req.browserAgent,
          req.package,
          service
        );

      const inputWords = String(text)?.split(" ")?.length;
      const totalUsed = todayWordUsed + inputWords;

      if (totalUsed > totalWordLimit) {
        if (totalWordLimit !== 99999) {
          throw {
            message: `${service} limit exceeded`,
            error: "LIMIT_REQUEST",
          };
        }
      }
      if (inputWords > wordLimit) {
        throw {
          message: `You can't use more than ${wordLimit} words`,
          error: "LIMIT_REQUEST",
        };
      }

      if (haveModes) {
        if (!modes.includes(mode)) {
          throw {
            message: `You can't use this mode`,
            error: "LIMIT_REQUEST",
          };
        }
      }

      next();
    } catch (error) {
      saveErrorLog(error.message, "high", {}, service, req.email);
      return res
        .status(500)
        .json({ success: false, error: error.error, message: error.message });
    }
  };
};

module.exports = permissionChecker;
