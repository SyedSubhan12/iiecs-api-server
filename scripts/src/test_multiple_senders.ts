import SibApiV3Sdk from "sib-api-v3-sdk";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

console.log("🔄 Multiple Sender Test");
console.log("=====================");

// Initialize Brevo API client
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKeyAuth = defaultClient.authentications["api-key"];
apiKeyAuth.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

const testEmail = "syedshahjee543@gmail.com";

// Multiple sender configurations to test
const senderConfigs = [
  {
    name: "Current Configuration",
    email: process.env.BREVO_SENDER_EMAIL || "noreply@iiecs.edu",
    senderName: "IIECS Admin"
  },
  {
    name: "Gmail Alternative",
    email: "syedsubhans132@gmail.com", // From the test script
    senderName: "IIECS Program"
  },
  {
    name: "Domain Email",
    email: "admin@iiecs.edu",
    senderName: "IIECS Administrator"
  }
];

async function testMultipleSenders() {
  console.log(`📧 Target: ${testEmail}`);
  console.log(`🔑 API Key: ${process.env.BREVO_API_KEY ? 'SET' : 'MISSING'}`);
  
  for (let i = 0; i < senderConfigs.length; i++) {
    const config = senderConfigs[i];
    console.log(`\n🧪 Test ${i + 1}: ${config.name}`);
    console.log(`   From: ${config.email}`);
    console.log(`   Name: ${config.name}`);
    
    try {
      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
      sendSmtpEmail.subject = `🧪 Test ${i + 1}: ${config.name}`;
      sendSmtpEmail.htmlContent = `
        <div style="font-family:Arial,sans-serif;padding:20px;">
          <h2>Email Test ${i + 1}</h2>
          <p><strong>Sender:</strong> ${config.name}</p>
          <p><strong>Email:</strong> ${config.email}</p>
          <p><strong>Test Time:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Test Purpose:</strong> To find which sender configuration works with Gmail</p>
          
          <div style="background:#f0f8ff;padding:15px;border-radius:4px;margin:15px 0;">
            <strong>📋 Instructions:</strong><br/>
            1. Check your Gmail inbox<br/>
            2. Look for emails with subject starting with "🧪 Test"<br/>
            3. Reply to the one that works!<br/>
            4. Check spam folder if not found
          </div>
          
          <p style="font-size:12px;color:#666;">
            Test ID: TEST-${Date.now()}-${i + 1}
          </p>
        </div>
      `;
      sendSmtpEmail.sender = { email: config.email, name: config.name };
      sendSmtpEmail.to = [{ email: testEmail, name: "Syed Shahjee" }];
      
      const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log(`✅ Test ${i + 1} SUCCESS: ${result.messageId}`);
      
      // Wait between tests
      if (i < senderConfigs.length - 1) {
        console.log("⏳ Waiting 45 seconds before next test...");
        await new Promise(resolve => setTimeout(resolve, 45000));
      }
      
    } catch (error: any) {
      console.error(`❌ Test ${i + 1} FAILED: ${error.message}`);
      if (error.response && error.response.body) {
        console.error("Brevo Error:", JSON.stringify(error.response.body, null, 2));
      }
    }
  }
  
  console.log("\n🎯 IMMEDIATE ACTIONS:");
  console.log("1. 📧 CHECK GMAIL IMMEDIATELY");
  console.log("2. 🔍 Look for emails with subject '🧪 Test'");
  console.log("3. 🗑️ Check spam/junk folder");
  console.log("4. ✅ Reply to any email you receive!");
  
  console.log("\n🔧 GMAIL WHITELIST INSTRUCTIONS:");
  console.log("1. Open Gmail");
  console.log("2. Go to Settings > Filters and Blocked Addresses");
  console.log("3. Click 'Create a new filter'");
  console.log("4. In 'From', enter: noreply@iiecs.edu OR syedsubhans132@gmail.com");
  console.log("5. Click 'Create filter'");
  console.log("6. Check 'Never mark as spam'");
  console.log("7. Click 'Create filter'");
  
  console.log("\n⚠️ BREVO VERIFICATION:");
  console.log("1. Go to https://app.brevo.com/");
  console.log("2. Check if sender emails are verified");
  console.log("3. Verify 'admin@iiecs.edu' is verified in Brevo");
}

testMultipleSenders()
  .then(() => {
    console.log("\n🎯 ALL TESTS SENT");
    console.log("Please check Gmail and let me know which (if any) emails arrive!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 TESTS FAILED");
    console.error("Error:", error.message);
    process.exit(1);
  });