import SibApiV3Sdk from "sib-api-v3-sdk";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

console.log("Testing Invoice Email System");
console.log("============================");

// Initialize Brevo API client
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKeyAuth = defaultClient.authentications["api-key"];
apiKeyAuth.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendTestInvoiceEmail() {
  const targetEmail = "syedshahjee563@gmail.com";
  const targetName = "Syed Shahjee";
  
  console.log(`\n📧 Sending test invoice email to: ${targetEmail}`);
  console.log(`👤 Recipient name: ${targetName}`);
  console.log(`🔑 API Key configured: ${!!process.env.BREVO_API_KEY}`);
  console.log(`📧 Sender email: ${process.env.BREVO_SENDER_EMAIL || "noreply@iiecs.edu"}`);
  
  try {
    // Generate a test PDF first
    console.log("\n📄 Generating test PDF invoice...");
    const testPdfBuffer = fs.readFileSync(path.resolve(__dirname, "../../artifacts/test_invoice.pdf"));
    console.log("✅ PDF generated successfully");
    console.log(`📁 PDF size: ${testPdfBuffer.length} bytes`);
    
    // Create email content
    const htmlContent = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
        <div style="background:#1e3c72;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h2 style="color:#fff;margin:0;font-size:18px;">UPRISER: INSTITUTE OF TECHNOLOGY</h2>
          <p style="color:#a8bfe0;margin:4px 0 0;font-size:12px;">Education and Beyond...</p>
        </div>
        <div style="padding:24px;border:1px solid #dde3f0;border-top:none;border-radius:0 0 8px 8px;">
          <h3 style="color:#1e3c72;margin-top:0;">🧪 Test Invoice Email</h3>
          <p>Dear <strong>${targetName}</strong>,</p>
          <p>This is a <strong>test email</strong> to verify that our invoice email system is working correctly.</p>
          
          <div style="background-color:#f0f4ff;padding:15px;border-left:5px solid #1e3c72;border-radius:4px;margin:20px 0;">
            <strong>📋 Test Details:</strong><br/>
            Invoice Number: TEST-INV-202606-0001<br/>
            Test Date: ${new Date().toLocaleDateString()}<br/>
            Status: Successfully Generated
          </div>
          
          <p style="margin-top:20px;font-size:13px;color:#666;">
            If you receive this email, our invoice email system is working correctly!
          </p>
          <p style="margin-top:4px;font-size:13px;">Regards,<br/><strong>IIECS Test System</strong></p>
        </div>
        <p style="font-size:11px;color:#aaa;text-align:center;margin-top:12px;">
          UPRISER: INSTITUTE OF TECHNOLOGY &nbsp;|&nbsp; admin@iiecs.edu
        </p>
      </div>`;

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = "🧪 Test: Invoice Email System Verification";
    sendSmtpEmail.htmlContent = htmlContent;
    sendSmtpEmail.sender = { 
      email: process.env.BREVO_SENDER_EMAIL || "noreply@iiecs.edu", 
      name: "IIECS Test System" 
    };
    sendSmtpEmail.to = [{ email: targetEmail, name: targetName }];
    
    // Add the test PDF as attachment
    sendSmtpEmail.attachment = [
      {
        name: "TEST-INV-202606-0001.pdf",
        content: testPdfBuffer.toString("base64"),
      },
    ];

    console.log("\n🚀 Sending email via Brevo SDK...");
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    
    console.log("\n✅ SUCCESS!");
    console.log(`📧 Email sent successfully! Message ID: ${data.messageId}`);
    console.log(`🎉 Test completed - Invoice email system is working!`);
    
    return data;
    
  } catch (error: any) {
    console.error("\n❌ ERROR sending test email:");
    if (error.response && error.response.body) {
      console.error("Brevo API Error:", JSON.stringify(error.response.body, null, 2));
      
      // Check for specific error types
      if (error.response.body.message?.includes("IP")) {
        console.error("\n🔍 IP Address Issue Detected:");
        console.log(`Current IP: 202.63.202.253`);
        console.log("Solution: Go to https://app.brevo.com/security/authorised_ips");
        console.log("Add the IP address 202.63.202.253 to your authorized IPs list");
      }
    } else {
      console.error("Error details:", error.message);
    }
    throw error;
  }
}

// Run the test
if (!process.env.BREVO_API_KEY) {
  console.error("❌ ERROR: BREVO_API_KEY is not set in environment variables");
  console.log("Please check your .env file or environment configuration");
  process.exit(1);
}

sendTestInvoiceEmail()
  .then(() => {
    console.log("\n🎉 Test completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Test failed!");
    console.log("Check the error details above and fix any issues.");
    console.log("\n📖 For more help, see: /home/zaro/app_manager/EMAIL_SETUP.md");
    process.exit(1);
  });
