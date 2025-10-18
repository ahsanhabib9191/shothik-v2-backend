const API_TOKEN = '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';
const axios  = require('axios');

async function huggingFace(data) {
    try {
        const response = await axios.post(
            "https://api-inference.huggingface.co/models/unikei/t5-base-split-and-rephrase",
            data,
            {
                headers: { Authorization: `Bearer ${API_TOKEN}` }
            }
        );
        return response.data;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

module.exports = {
    huggingFace
}