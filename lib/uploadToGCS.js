const { CLOUD_BUCKET } = require('../config/constant')
const path = require('path')
const { Storage } = require('@google-cloud/storage')
const storage = new Storage({
  keyFilename: path.join(__dirname, '..', 'cred', 'service_account.json'),
})
const bucket = storage.bucket(CLOUD_BUCKET)

const uploadToGCS = async (filePath, destFileName) => {
  await bucket.upload(filePath, {
    destination: destFileName,
  })

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destFileName}`
  return publicUrl
}

module.exports = { uploadToGCS }
