const sendEmail = require("./sendEmail");

const sendMultipleMultipleEmail = async ({emails, title, transcribeData}) => {
    try {
        if (emails && emails.length > 0) {
            await Promise.all(emails.map(async (email) => {
                await sendEmail({
                    name: email,
                    email: email,
                    subject: `${title} by Shothik AI`,
                    message: `${transcribeData}`,
                });
            }));
        }
    } catch (error) {
        console.error("Error sending emails: ", error);
    }
};

module.exports = {
    sendMultipleMultipleEmail
};
