import SibApiV3Sdk from "sib-api-v3-sdk";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

console.log("🔍 Email Diagnostics");
console.log("=====================");

// Initialize Brevo API client
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKeyAuth = defaultClient.authentications["api-key"];
apiKeyAuth.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

async function diagnoseEmailIssues() {
  const testEmail = "syedshahjee543@gmail.com";
  const testName = "Syed Shahjee";
  
  console.log("\n📋 DIAGNOSTIC CHECKS:");
  console.log(`✅ API Key configured: ${!!process.env.BREVO_API_KEY}`);
  console.log(`📧 Sender email: ${process.env.BREVO_SENDER_EMAIL || "noreply@iiecs.edu"}`);
  console.log(`👥 Sender name: ${process.env.BREVO_SENDER_NAME || "IIECS Admin"}`);
  console.log(`🎯 Target email: ${testEmail}`);
  console.log(`👤 Target name: ${testName}`);
  
  // Check Brevo account status
  try {
    console.log("\n🔍 Checking Brevo account status...");
    const accountInfo = await apiInstance.getAccount();
    console.log(`✅ Brevo account: ${accountInfo.email || "Unknown"}`);
    console.log(`✅ Account status: Active (no errors reported)`);
  } catch (error) {
    console.error("❌ Brevo account check failed:", error instanceof Error ? error.message : String(error));
  }
  
  // Test with different approaches
  const testMethods = [
    {
      name: "Simple Test",
      email: testEmail,
      subject: "🔍 Simple Test Email",
      content: "<p>This is a simple test to check basic email delivery.</p>"
    },
    {
      name: "HTML Test", 
      email: testEmail,
      subject: "🔍 HTML Test Email",
      content: `
        <div style="font-family:Arial,sans-serif;padding:20px;background:#f0f8ff;border-radius:8px;">
          <h2>🔍 Email Delivery Test</h2>
          <p>If you receive this email, your inbox is working correctly.</p>
          <p>Test time: ${new Date().toLocaleString()}</p>
          <p><strong>Technical Details:</strong></p>
          <ul>
            <li>Service: Brevo/Sendinblue</li>
            <li>Method: Transactional Email API</li>
            <li>IP: 202.63.202.253</li>
          </ul>
        </div>
      `
    }
  ];
  
  for (const method of testMethods) {
    console.log(`\n🧪 Testing: ${method.name}`);
    
    try {
      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
      sendSmtpEmail.subject = method.subject;
      sendSmtpEmail.htmlContent = method.content;
      sendSmtpEmail.sender = { 
        email: process.env.BREVO_SENDER_EMAIL || "noreply@iiecs.edu", 
        name: "IIECS Test System" 
      };
      sendSmtpEmail.to = [{ email: method.email, name: testName }];
      
      console.log(`📤 Sending to: ${method.email}...`);
      const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
      
      console.log(`✅ ${method.name}: SUCCESS`);
      console.log(`   Message ID: ${result.messageId}`);
      console.log(`   Status: Sent`);
      
    } catch (error: any) {
      console.error(`❌ ${method.name}: FAILED`);
      if (error.response && error.response.body) {
        console.error(`   Error: ${JSON.stringify(error.response.body, null, 2)}`);
      } else {
        console.error(`   Error: ${error.message}`);
      }
    }
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log("\n📋 TROUBLESHOOTING STEPS:");
  console.log("1. 📧 Check spam/junk folder in Gmail");
  console.log("2. 🔍 Verify email address is correct: syedshahjee543@gmail.com");
  console.log("3. ⏳ Wait 5-10 minutes for email delivery");
  console.log("4. 🌐 Test with different email provider if possible");
  console.log("5. 📧 Contact Brevo support if issues persist");
  
  console.log("\n🔧 MANUAL VERIFICATION:");
  console.log("You can also send a test manually via Brevo dashboard:");
  console.log("1. Go to https://app.brevo.com/");
  console.log("2. Navigate to 'Transactional Emails' > 'Send a test email'");
  console.log("3. Use the same email: syedshahjee543@gmail.com");
}

// Run diagnosis
if (!process.env.BREVO_API_KEY) {
  console.error("❌ ERROR: BREVO_API_KEY is not set");
  process.exit(1);
}

diagnoseEmailIssues()
  .then(() => {
    console.log("\n🎯 DIAGNOSTIC COMPLETE");
    console.log("Check the results above for any issues.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 DIAGNOSTIC FAILED");
    console.error("Error:", error.message);
    process.exit(1);
  });
