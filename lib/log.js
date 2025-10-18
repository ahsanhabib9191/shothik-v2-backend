// Log Message to console
function log(message) {
  if(process.env.NODE_ENV ==='development') {
    console.log(message);
  }

  console.log(message);

}

function Log(message) {
  if(process.env.NODE_ENV ==='development') {
    console.log(message);
  }

  console.log(message);
}

module.exports = { log , Log}