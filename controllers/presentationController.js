const FormData = require("form-data");
const PresentationService = require("../services/presentationService");
const axios = require("axios");
const fs = require("fs");

// =============== Initiate presentation process ===============
const initiatePresentation = async ({ message, file_urls, userId }) => {
  if (!message) throw { message: "Message is required" };

  // console.log(file_urls, "file urls on controller");

  const agentResponse = await PresentationService.initiatePresentation(
    message,
    file_urls,
    userId
  );

  return {
    success: true,
    message: "Presentation initialize successfully",
    presentationId: agentResponse.presentationId,
  };
};

// =============== Presentation LOGS ===============
const presentationLogs = async (id, userId) => {

    const {data, status} = await PresentationService.presentationLogs(id, userId);

    return{
        success: true,
        status: status || 'N/A',
        message: "Presentation logs retrieved successfully",
        data: data || [],
    };
};

// =============== Presentation slides ===============
const presentationSlides = async (id, userId) => {

    const {data, status, title, total_slides} = await PresentationService.presentationSlides(id, userId);

    return{
        success: true,
        status: status || 'N/A',
        message: "Presentation slides retrieved successfully",
        title: title || 'Generating...',
        data: data || [],
        total_slides: total_slides || 0,
    };
};

// =============== All Presentation slides ===============
const getAllPresentationSlides = async(id) => {
  const {data, status} = await PresentationService.getAllPresentationSlides(id);

  return {
    success: true,
    status: status || "N/A",
    message: "Presentation slides retrieved successfully",
    data: data
  }
}

const handleChatMessage = async ({ presentationId, userId, message }) => {
  if (!message) throw { message: "Message is required" };

  const result = await PresentationService.processChatMessage(
    presentationId,
    userId,
    message
  );

  return {
    success: true,
    message: "Message is being processed",
    ...result,
  };
};

const postMessage = async (id, user_query, userId) => {
  try {
    if(!id || !user_query) throw {message: "Presentation id & User query is required"};
  
    const result = await PresentationService.postMessage(id, user_query, userId)
  
    return {
      success: true,
      ...result,
    }
  } catch (error) {
    console.log("[postMessageController] error:", error);
    throw error;
  }
}

// =============== Upload files to Agents ===============
const uploadFileToAgents = async (files, userId) => {
  try {
    const formData = new FormData();

    console.log("Processing files for upload:", files.length);

    // Add each file to FormData with the field name 'files' (as expected by FastAPI)
    files.forEach((file, index) => {
      console.log(`Processing file ${index}:`, {
        name: file.name,
        size: file.size,
        mimetype: file.mimetype,
        dataType: typeof file.data,
        isBuffer: Buffer.isBuffer(file.data),
        bufferLength: file.data ? file.data.length : 0,
        tempFilePath: file.tempFilePath,
      });

      // Option 1: Use temp file if available (RECOMMENDED)
      if (file.tempFilePath && fs.existsSync(file.tempFilePath)) {
        console.log(`Using temp file stream for: ${file.name}`);
        formData.append("files", fs.createReadStream(file.tempFilePath), {
          filename: file.name,
          contentType: file.mimetype,
        });
      }
      // Option 2: Use buffer data
      else if (file.data && Buffer.isBuffer(file.data)) {
        console.log(`Using buffer for: ${file.name}`);
        formData.append("files", file.data, {
          filename: file.name,
          contentType: file.mimetype,
        });
      } else {
        throw new Error(`No valid file data found for: ${file.name}`);
      }
    });

    // Add metadata with correct field name
    formData.append("user_id", userId);

    // Log FormData info before sending
    console.log("FormData boundary:", formData.getBoundary());
    console.log("FormData headers:", formData.getHeaders());

    // Send to external AI agent API
    const response = await axios.post(
      `${process.env.PRESENTATION_AGENT_BASE_URL}/upload-file`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          // Don't set Authorization if not needed for testing
          // 'Authorization': `Bearer ${process.env.AI_AGENT_API_KEY}`,
        },
        timeout: 60000, // 60 seconds for large files
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onUploadProgress: (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          console.log(`Upload Progress: ${progress}%`);
        },
      }
    );

    console.log("Upload successful:", response.status);
    if(response.data) {
      const urls = response.data?.uploads?.map((item) => ({
        filename: item.filename,
        signed_url: item.signed_url,
      }));

      return urls;
    }
  } catch (error) {
    console.error("uploadFileToAgents error details:");
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);

    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
      console.error("Response headers:", error.response.headers);

      // Log the validation errors if available
      if (error.response.data && error.response.data.detail) {
        console.error(
          "Validation errors:",
          JSON.stringify(error.response.data.detail, null, 2)
        );
      }
    } else if (error.request) {
      console.error("No response received:", error.request);
    }

    throw error;
  }
};

module.exports = {
  initiatePresentation,
  presentationLogs,
  presentationSlides,
  handleChatMessage,
  postMessage,
  getAllPresentationSlides,
  uploadFileToAgents,
};