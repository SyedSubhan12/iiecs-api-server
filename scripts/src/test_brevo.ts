import SibApiV3Sdk from "sib-api-v3-sdk";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
console.log("BREVO_API_KEY from process.env:", process.env.BREVO_API_KEY ? "SET" : "NOT SET");

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendTestEmail() {
  const logoUrl = process.env.BREVO_EMAIL_LOGO_URL || "https://lrrzzcvaufvodwsjxuph.supabase.co/storage/v1/object/public/id-cards/logo-bot.jpeg";
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.subject = "Test: Congratulations on Your Exam Success! 🎓";
  sendSmtpEmail.htmlContent = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="${logoUrl}" alt="Program Logo" style="width: 150px; height: auto;" />
          </div>
          <h2 style="color: #2c3e50; text-align: center;">Exam Results Appreciation (TEST)</h2>
          <p>Dear <strong>Test User</strong>,</p>
          <p>We are thrilled to inform you that you have successfully passed your exams! 🌟</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-left: 5px solid #27ae60; margin: 20px 0;">
            <strong>Result Status:</strong> PASSED ✅
          </div>
          <p>Best regards,<br/><strong>The Program Team</strong></p>
        </div>
      </body>
    </html>
  `;
  // NOTE: In Brevo, the 'sender' email must be a verified domain or email in your Brevo account.
  sendSmtpEmail.sender = { name: "IIECS Program", email: "syedsubhans132@gmail.com" };
  sendSmtpEmail.to = [{ email: "syedshahjee563@gmail.com", name: "Syed Shahjee" }];

  try {
    console.log("Attempting to send test email...");
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`Test email sent successfully! Message ID: ${data.messageId}`);
  } catch (error: any) {
    console.error("Error sending test email:");
    if (error.response && error.response.body) {
      console.error(JSON.stringify(error.response.body, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

if (!process.env.BREVO_API_KEY) {
  console.error("ERROR: BREVO_API_KEY is not set.");
} else {
  sendTestEmail();
}
