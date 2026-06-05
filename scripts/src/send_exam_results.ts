import SibApiV3Sdk from "sib-api-v3-sdk";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

const students = [
  { name: "Muha mmad Rizwan", email: "shahnawaz001256@gmail.com" },
  { name: "Syeda Hilba Shamshad", email: "a3228294841@gmail.com" },
  { name: "Hania Khan", email: "bk0924444@gmail.com" },
  { name: "Muha Mmad Irfan", email: "farhandaudpota123@gmail.com" },
  { name: "Muhammad Aman Hussain", email: "faizaamir656565@gmail.com" },
  { name: "Jacob Haroon Francis", email: "jacobharoon0300@gmail.com" },
  { name: "Meerab faisal Faisal", email: "meerufaisal@icloud.com" },
  { name: "Waniya tusif Waniya", email: "faiza.tusif@gmail.com" },
  { name: "Raja M.Faisal Sajjad", email: "phussi07@gmail.com" },
  { name: "Rubab Ali Rubab ali", email: "rubabali009944@gmail.com" },
  { name: "Abdul Hannan Kamran", email: "nazk95534@gmail.com" },
  { name: "syed hassam shah syed hassam shah", email: "a3228294841@gmail.com" },
  { name: "Ahmed Bin Khalid", email: "ahmedbinkhalid209@gmail.com" },
  { name: "Mustafa Bin Khalid", email: "mustafabinkhalid4@gmail.com" },
  { name: "Abdul Hadi", email: "ranaasadsadiq1983@gmail.com" },
  { name: "Muhammad Mustafa Sohail", email: "m.mustafasohail679@gmail.com" },
  { name: "Syed Muhammad Raza", email: "qaiser.raza2020@gmail.com" },
  { name: "Zunaira Adeel Ahmed", email: "adeelzunaira95@gmail.com" },
  { name: "Safi ullah Abbasi Asif", email: "safiabbasi2009@gmail.com" },
  { name: "Shanzay Sharique", email: "jeanpk06@gmail.com" },
  { name: "Muhammad Mohtasham Zeeshan", email: "uroosazeeshan0809@gmail.com" },
  { name: "Moazzam Zeeshan Ali", email: "moazzammughal2009@gmail.com" },
  { name: "Abdul Wajid", email: "abdulwajid1304@gmail.com" },
  { name: "M.SUFYAN Sufyan Jamshed", email: "sufyannoman551@gmail.com" }
];

async function sendEmails() {
  const logoUrl = process.env.BREVO_EMAIL_LOGO_URL || "https://lrrzzcvaufvodwsjxuph.supabase.co/storage/v1/object/public/id-cards/logo-bot.jpeg";
  for (const student of students) {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = "Congratulations on Your Exam Success! 🎓";
    sendSmtpEmail.htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <img src="${logoUrl}" alt="Program Logo" style="width: 150px; height: auto;" />
            </div>
            <h2 style="color: #2c3e50; text-align: center;">Exam Results Appreciation</h2>
            <p>Dear <strong>${student.name}</strong>,</p>
            <p>We are thrilled to inform you that you have successfully passed your exams! 🌟</p>
            <p>Your hard work, dedication, and commitment to excellence have truly paid off. This is a significant milestone in your learning journey, and we couldn't be more proud of your achievement.</p>
            <div style="background-color: #f9f9f9; padding: 15px; border-left: 5px solid #27ae60; margin: 20px 0;">
              <strong>Result Status:</strong> PASSED ✅
            </div>
            <p>Keep up the fantastic work! We look forward to seeing you continue to excel in the upcoming modules.</p>
            <p>Best regards,<br/><strong>The Program Team</strong></p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999; text-align: center;">
              This is an automated message. Please do not reply directly to this email.
            </p>
          </div>
        </body>
      </html>
    `;
    sendSmtpEmail.sender = { name: "IIECS Program", email: "syedsubhans132@gmail.com" };
    sendSmtpEmail.to = [{ email: student.email, name: student.name }];

    try {
      const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log(`Email sent successfully to ${student.name} (${student.email}). Message ID: ${data.messageId}`);
    } catch (error: any) {
      console.error(`Error sending email to ${student.name}:`, error.response?.body || error.message);
    }
  }
}

if (!process.env.BREVO_API_KEY) {
  console.error("BREVO_API_KEY is not set in environment variables.");
} else {
  sendEmails().catch(console.error);
}
