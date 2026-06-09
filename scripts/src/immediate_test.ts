import SibApiV3Sdk from "sib-api-v3-sdk";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

console.log("🚨 IMMEDIATE EMAIL TEST");
console.log("======================");

// Initialize Brevo API client
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKeyAuth = defaultClient.authentications["api-key"];
apiKeyAuth.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

async function immediateTest() {
  const testEmail = "syedshahjee543@gmail.com";
  
  console.log("\n🎯 SENDING TEST EMAIL NOW:");
  console.log(`To: ${testEmail}`);
  console.log(`From: noreply@iiecs.edu`);
  console.log(`Subject: 🚨 URGENT: Email Delivery Test - CHECK NOW`);
  console.log(`Time: ${new Date().toLocaleString()}`);
  
  try {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = "🚨 URGENT: Email Delivery Test - CHECK NOW";
    sendSmtpEmail.htmlContent = `
      <div style="font-family:Arial,sans-serif;padding:20px;background:#fff3cd;border:2px solid #ffc107;border-radius:8px;">
        <h2 style="color:#856404;">🚨 URGENT: Email Delivery Test</h2>
        <p style="color:#856404;font-weight:bold;">CHECK YOUR INBOX NOW!</p>
        <p>This is a test email to verify that emails are being delivered to your Gmail account.</p>
        
        <div style="background:#d1ecf1;padding:15px;border-radius:4px;margin:15px 0;">
          <strong>📋 IMMEDIATE ACTIONS:</strong><br/>
          1. Check your main Gmail inbox<br/>
          2. Check your spam/junk folder<br/>
          3. Search for emails from "noreply@iiecs.edu"<br/>
          4. If you see this, reply to confirm receipt!
        </div>
        
        <p style="font-size:12px;color:#6c757d;margin-top:20px;">
          Sent: ${new Date().toISOString()}<br/>
          Test ID: ${Date.now()}<br/>
          Please check your Gmail immediately!
        </p>
      </div>
    `;
    sendSmtpEmail.sender = { 
      email: process.env.BREVO_SENDER_EMAIL || "noreply@iiecs.edu", 
      name: "URGENT Email Test" 
    };
    sendSmtpEmail.to = [{ email: testEmail, name: "Syed Shahjee" }];
    
    console.log("\n📤 Sending email...");
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    
    console.log("\n✅ EMAIL SENT SUCCESSFULLY!");
    console.log(`Message ID: ${result.messageId}`);
    console.log(`Status: Delivered to Brevo`);
    
    console.log("\n🔍 WHAT TO DO RIGHT NOW:");
    console.log("1. 📧 OPEN YOUR GMAIL ACCOUNT IMMEDIATELY");
    console.log("2. 🔍 CHECK INBOX FOR SUBJECT: '🚨 URGENT: Email Delivery Test - CHECK NOW'");
    console.log("3. 🗑️ IF IN SPAM: Mark as 'Not Spam' and move to inbox");
    console.log("4. ✅ IF RECEIVED: Email system is working correctly!");
    
    console.log("\n⏰ TIMELINE:");
    console.log("- Sent: Just now");
    console.log("- Should arrive: Within 1-5 minutes");
    console.log("- If not in 10 minutes: Check Brevo dashboard for delivery status");
    
    return result;
    
  } catch (error: any) {
    console.error("\n❌ FAILED TO SEND EMAIL:");
    console.error("Error:", error.message);
    if (error.response && error.response.body) {
      console.error("Brevo Error:", JSON.stringify(error.response.body, null, 2));
    }
    throw error;
  }
}

// Run immediate test
immediateTest()
  .then(() => {
    console.log("\n🎯 TEST COMPLETE - PLEASE CHECK YOUR GMAIL NOW!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 TEST FAILED");
    console.error("There may be a configuration issue with Brevo or the email address.");
    process.exit(1);
  });