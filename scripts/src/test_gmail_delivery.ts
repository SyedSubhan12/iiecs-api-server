import SibApiV3Sdk from "sib-api-v3-sdk";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

console.log("🔍 Gmail Delivery Test");
console.log("=======================");

// Initialize Brevo API client
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKeyAuth = defaultClient.authentications["api-key"];
apiKeyAuth.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

async function testGmailDelivery() {
  const testEmail = "syedshahjee543@gmail.com";
  
  console.log(`📧 Target: ${testEmail}`);
  console.log(`🔑 API Key: ${process.env.BREVO_API_KEY ? 'SET' : 'MISSING'}`);
  console.log(`📤 From: ${process.env.BREVO_SENDER_EMAIL || 'noreply@iiecs.edu'}`);
  
  // Test with very basic content first
  console.log("\n🧪 Test 1: Minimal HTML Email");
  try {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = "🔍 Gmail Test 1 - Simple";
    sendSmtpEmail.htmlContent = `
      <div style="font-family:Arial,sans-serif;padding:20px;">
        <h2>Gmail Delivery Test</h2>
        <p>If you receive this, Gmail is accepting emails from Brevo.</p>
        <p>Test time: ${new Date().toLocaleString()}</p>
        <p><strong>Check your spam folder!</strong></p>
      </div>
    `;
    sendSmtpEmail.sender = { 
      email: process.env.BREVO_SENDER_EMAIL || "noreply@iiecs.edu", 
      name: "Test System" 
    };
    sendSmtpEmail.to = [{ email: testEmail, name: "Test User" }];
    
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ Test 1 SUCCESS: ${result.messageId}`);
    
  } catch (error: any) {
    console.error(`❌ Test 1 FAILED: ${error.message}`);
    console.error("Full error:", JSON.stringify(error.response?.body, null, 2));
  }
  
  // Wait 30 seconds
  console.log("\n⏳ Waiting 30 seconds...");
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  // Test with different approach - using a known working template
  console.log("\n🧪 Test 2: Alternative Template");
  try {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = "🔍 Gmail Test 2 - Alternative";
    sendSmtpEmail.htmlContent = `
      <div style="background:#f8f9fa;padding:20px;border:1px solid #dee2e6;">
        <h3 style="color:#495057;">Email Delivery Test</h3>
        <p style="margin:10px 0;">This email tests delivery to Gmail.</p>
        <p style="margin:10px 0; color:#6c757d;">If you're seeing this, the email got through!</p>
        <p style="margin:10px 0; font-size:12px; color:#6c757d;">Sent: ${new Date().toISOString()}</p>
      </div>
    `;
    sendSmtpEmail.sender = { 
      email: process.env.BREVO_SENDER_EMAIL || "noreply@iiecs.edu", 
      name: "Email Test" 
    };
    sendSmtpEmail.to = [{ email: testEmail, name: "Test User" }];
    
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ Test 2 SUCCESS: ${result.messageId}`);
    
  } catch (error: any) {
    console.error(`❌ Test 2 FAILED: ${error.message}`);
  }
  
  console.log("\n📋 WHAT TO DO NEXT:");
  console.log("1. 📧 Check Gmail spam/junk folder immediately");
  console.log("2. 🔍 Search for emails from 'noreply@iiecs.edu'");
  console.log("3. ⏳ Wait up to 10 minutes for delivery");
  console.log("4. 🛠️ If still not received, try these solutions:");
  console.log("   - Add noreply@iiecs.edu to Gmail contacts");
  console.log("   - Check Gmail settings for blocked senders");
  console.log("   - Try a different email address");
  
  console.log("\n🔧 BREVO TROUBLESHOOTING:");
  console.log("1. Verify sender email is verified in Brevo dashboard");
  console.log("2. Check Brevo's IP reputation: https://www.senderbase.org/");
  console.log("3. Review Brevo's delivery analytics");
  console.log("4. Contact Brevo support if delivery fails");
}

testGmailDelivery()
  .then(() => {
    console.log("\n🎯 TEST COMPLETE");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 TEST FAILED");
    console.error("Error:", error.message);
    process.exit(1);
  });