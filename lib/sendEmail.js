const { SENDGRIDAPI } = require("../config/constant");

const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(SENDGRIDAPI);

const sendEmail = async (options) => {
  //  console.log(options, "email options");
  return new Promise(async (resolve, reject) => {
    try {
      // HTML email template
      // const htmlTemplate = `
      //   <!DOCTYPE html>
      //   <html lang="en">
      //   <head>
      //     <meta charset="UTF-8">
      //     <meta name="viewport" content="width=device-width, initial-scale=1.0">
      //     <title>${options.subject}</title>
      //     <style>
      //       body {
      //         font-family: Arial, sans-serif;
      //         background-color: #f4f4f4;
      //         padding: 20px;
      //       }
      //       .container {
      //         max-width: 600px;
      //         margin: 0 auto;
      //         padding: 20px;
      //         background-color: #fff;
      //         border-radius: 10px;
      //         box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      //       }
      //       .title{
      //         text-transform: capitalize;
      //         font-weight: 600;
      //       }
      //       h1 {
      //         color: #333;
      //       }
      //       p {
      //         color: #666;
      //       }
      //       a{
      //         text-decoration: none;
      //       }
      //     </style>
      //   </head>
      //   <body>
      //     <div class="container">
      //       <h1 class="title">${options.subject}</h1>
      //       <h3 class="title">Hello, ${options.name}</h3>
      //       ${options.message}
      //     </div>
      //   </body>
      //   </html>
      // `;

      const msg = {
        to: options.email, // Recipient's email address
        // from: "verify@shothik.ai", // Sender's email address
        from: "info@shothik.live", // Sender's email address
        subject:
          options.type === "password"
            ? "Forgot Password"
            : "Email Varification",
        html: eamilTemplete(options.name, options.link, options.type), // Your HTML template here
        trackingSettings: {
          clickTracking: {
            enable: false, // disable click tracking
            enableText: false,
          },
        },
      };

      // Send the email
      sgMail
        .send(msg)
        .then(() => {
          console.log("Email sent successfully");
        })
        .catch((error) => {
          console.error("Error sending email:", error.response.body);
        });

      resolve({ message: "Varification mail sent" });
    } catch (error) {
      console.log("Error varification mail not sent : ", error);
      // reject(error);
    }
  });
};

const eamilTemplete = (name, link, type) => {
  return `<html>
  <body
    style="
      margin: 0;
      padding: 0;
      background-color: #f6f9fc;
      font-family: sans-serif;
    "
  >
    <table
      cellpadding="0"
      cellspacing="0"
      style="width: 100%; max-width: 600px; margin: 0 auto; padding: 45px 20px"
    >
      <tr>
        <td
          style="
            background-color: #ffffff;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          "
        >
          <table cellpadding="0" cellspacing="0" style="width: 100%">
            <!-- Logo -->
            <tr>
              <td style="padding-bottom: 32px">
                <div style="display: flex; justify-content: center">
                  <img
                    src="https://storage.googleapis.com/shothik-public-assets/public-datasets/shothik_light_logo.png"
                    alt="Shothik Ai"
                    style="width: 150px"
                  />
                </div>
              </td>
            </tr>

            <!-- Main Content -->
            <tr>
              <td style="padding-bottom: 24px">
                <h3>${
                  type === "password" ? "Forgot Password" : "Email Varification"
                }</h3>
                <p>Hi, ${name}</p>
                <p
                  style="
                    margin: 0;
                    font-size: 16px;
                    line-height: 24px;
                    color: #525f7f;
                  "
                >
                  You are almost there! Please verify your email address with
                  the flowing link
                  <a style="color: #00ab55" href="${link}" target="_blank"
                    >${type === "password" ? "Reset password" : "Verify Now"}</a
                  >
                  or by clicking the button below.
                </p>
              </td>
            </tr>

            <!-- Button -->
            <tr>
              <td style="padding-bottom: 24px">
                <a
                  href="${link}"
                  style="
                    display: inline-block;
                    background-color: #00ab55;
                    color: #ffffff;
                    text-decoration: none;
                    padding: 12px 24px;
                    border-radius: 4px;
                    font-weight: 500;
                    font-size: 14px;
                  "
                >
                 ${type === "password" ? "Reset password" : "Verify email"}
                </a>
              </td>
            </tr>

            <!-- Help Text -->
            <tr>
              <td style="padding-bottom: 32px">
                <p
                  style="
                    margin: 0;
                    font-size: 14px;
                    line-height: 20px;
                    color: #525f7f;
                  "
                >
                  If you did not request this, please ignore this email.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="border-top: 1px solid #e6ebf1; padding-top: 24px">
                <p
                  style="
                    margin: 0 0 8px;
                    font-size: 12px;
                    line-height: 16px;
                    color: #8898aa;
                  "
                >
                  Best regards, <br />
                  Shothik AI Team
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

module.exports = sendEmail;
