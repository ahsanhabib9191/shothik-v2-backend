const AWS = require("aws-sdk");
const { AWS_ACCESS_KEY, AWS_SECRET_KEY, AWS_REGION } = require("../config/constant");

AWS.config.update({
  accessKeyId: AWS_ACCESS_KEY,
  secretAccessKey: AWS_SECRET_KEY,
  region: AWS_REGION,
});

// const s3 = new AWS.S3();
// const transcribe = new AWS.TranscribeService();
const rekognition = new AWS.Rekognition();

async function compareMultipleFaces(image1, image2, image3) {
  try {
    const results = [];
    let totalMatchConfidence = 0;
    let totalMatches = 0;

    // Compare image1 with image2
    let params = {
      SourceImage: {
        Bytes: image1,
      },
      TargetImage: {
        Bytes: image2,
      },
    };
    const result1 = await rekognition.compareFaces(params).promise();
    results.push(result1);

    // Accumulate confidence scores
    if (result1.FaceMatches.length > 0) {
      totalMatchConfidence += result1.FaceMatches[0].Similarity;
      totalMatches++;
    }

    // Compare image1 with image3
    params = {
      SourceImage: {
        Bytes: image1,
      },
      TargetImage: {
        Bytes: image3,
      },
    };
    const result2 = await rekognition.compareFaces(params).promise();
    results.push(result2);

    // Accumulate confidence scores
    if (result2.FaceMatches.length > 0) {
      totalMatchConfidence += result2.FaceMatches[0].Similarity;
      totalMatches++;
    }

    // Compare image2 with image3
    params = {
      SourceImage: {
        Bytes: image2,
      },
      TargetImage: {
        Bytes: image3,
      },
    };
    const result3 = await rekognition.compareFaces(params).promise();
    results.push(result3);

    // Accumulate confidence scores
    if (result3.FaceMatches.length > 0) {
      totalMatchConfidence += result3.FaceMatches[0].Similarity;
      totalMatches++;
    }

    // Calculate the average match confidence
    const averageMatch = totalMatches > 0 ? totalMatchConfidence / totalMatches : 0;

    return { results, averageMatch };
  } catch (error) {
    console.log("compare face error ======>", error.message);
    return error;
  }
}


module.exports ={
    compareMultipleFaces
}