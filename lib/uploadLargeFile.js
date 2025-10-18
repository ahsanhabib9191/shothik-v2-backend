const path = require('path');
const fs = require('fs');
const { Storage } = require("@google-cloud/storage");
const { sendMessage } = require("./pusher");
const { CLOUD_BUCKET } = require('../config/constant');
const { saveErrorLog } = require('../mongo/models/ErrorLogs');

const storage = new Storage({
    keyFilename: path.join(__dirname, '..', 'cred', 'service_account.json'),
});

const bucket = storage.bucket(CLOUD_BUCKET);

async function uploadLargeFile(filePath, newName) {
    try {
        // Determine the file size
        const fileSize = fs.statSync(filePath).size;

        // Define chunk size (e.g., 1MB)
        const CHUNK_SIZE = 1 * 1024 * 1024;

        // Calculate the number of chunks
        const numberOfChunks = Math.ceil(fileSize / CHUNK_SIZE);

        // Create a writable stream to upload each chunk
        const remoteFile = bucket.file(newName);
        const uploadStream = remoteFile.createWriteStream({
            resumable: false,
            metadata: { contentType: 'application/octet-stream' },
        });

        // Upload each chunk
        let uploadedSize = 0; // Track uploaded size
        for (let i = 0; i < numberOfChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, fileSize);

            // Read the chunk from the file
            const chunk = fs.createReadStream(filePath, { start, end });

            // Pipe the chunk to the upload stream
            await new Promise((resolve, reject) => {
                chunk.pipe(uploadStream, { end: false });
                chunk.on('end', () => {
                    // Update uploaded size and log percentage
                    uploadedSize += end - start;
                    const percentCompleted = (uploadedSize / fileSize) * 100;
                    console.log(`Uploaded ${Math.ceil(percentCompleted)}%`);
                    sendMessage('file-upload', 'progress', Math.ceil(percentCompleted));
                    resolve();
                });
                chunk.on('error', reject);
            });
        }

        // Finalize the upload
        return await new Promise((resolve, reject) => {
            uploadStream.on('finish', async () => {
                const publicUrl = `https://storage.googleapis.com/${bucket.name}/${newName}`;
                console.log('File uploaded successfully. Public URL:', publicUrl);
                resolve(publicUrl);
            });
            uploadStream.on('error', reject);
            uploadStream.end();
        });

    } catch (error) {
        console.error('Error uploading file:', error);
        saveErrorLog(error.message, 'high', {}, 'chunk_upload');
        throw error;
    }
}

module.exports = uploadLargeFile;
