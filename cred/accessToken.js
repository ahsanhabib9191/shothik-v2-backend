const axios = require('axios');
const fs = require('fs');


const refreshTokenParams = {
    client_id: "764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com",
    client_secret: "d-FL95Q19q7MQmFpd7hHD0Ty",
    refresh_token: "1//0gAL30v7m4RlWCgYIARAAGBASNwF-L9Irl8A8zh-G9pGToXXuDnfH9xWDq8FTPGvVyJWYgz3Uq-IugnQJCoREMaEPyusTL3b_1T4",
    grant_type: "refresh_token",
    type: "authorized_user"
};

// i want to store the token in local
let activeToken = { token:null, expireTime: null }

async function getAccessToken() {
    return new Promise(async (resolve, reject) => {

        if (activeToken.token && activeToken?.expireTime > Date.now()) {
            // If there's an active token and it's still valid, return it
            resolve(activeToken.token);
        } else {
            try {
                const response = await axios.post('https://oauth2.googleapis.com/token', refreshTokenParams);
                const accessToken = response.data.access_token;
                const expiresIn = response.data.expires_in; // Expiry time in seconds

                // Set the active token and its expiration time
                activeToken.token = accessToken;
                activeToken.expireTime = Date.now() + expiresIn * 1000; // Convert seconds to milliseconds
                resolve(accessToken);
            } catch (error) {
                reject(error);
            }
        }
    });
}

// ===================================================================
// ===================================================================
// ===================================================================
// ===================================================================

//Now Version 2 accessToken Generation 
const serviceAccount = require('./service_account.json');
const { GoogleAuth } = require('google-auth-library');

async function getAccessTokenV2(){
    try {
        
        const auth = new GoogleAuth({
            credentials:{
                client_email: serviceAccount.client_email,
                private_key: serviceAccount.private_key
            },
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });

        const authClient = await auth.getClient();
        const accesToken = await authClient.getAccessToken();
        return accesToken.token;

    } catch (error) {
        return null;
    }
}


module.exports = {
    getAccessToken: getAccessTokenV2
}