const os = require("os");
const {CHROME_PATH} = require("../config/constant");

function getLaunchOptions() {
  const isLinux = os.platform() === "linux";

  const options = {
    headless: "new",
    args: [
      "--use-fake-ui-for-media-stream",
      "--disable-notifications",
      "--mute-audio",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-setuid-sandbox",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
    ],
  };

  if (isLinux && CHROME_PATH) {
    options.executablePath = CHROME_PATH;
  }

  return options;
}

module.exports = {
  getLaunchOptions,
};
