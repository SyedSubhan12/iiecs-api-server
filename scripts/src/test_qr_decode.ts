import * as fs from "fs";
import { PDFParse } from "pdf-parse";
import { loadImage, createCanvas } from "@napi-rs/canvas";
import jsQR from "jsqr";

async function run() {
  const filePath = "/home/zaro/app_manager/id_Cards/IIECS_ID_IIECS-001_Meerab_faisal_Faisal (7).pdf";
  const dataBuffer = fs.readFileSync(filePath);
  const uint8Array = new Uint8Array(dataBuffer);
  
  try {
    const parser = new PDFParse(uint8Array);
    await parser.load();
    
    console.log("Taking screenshot...");
    const screenshot = await parser.getScreenshot({ imageBuffer: true, scale: 3 });
    const page = screenshot.pages[0];
    console.log("Screenshot info:", {
      width: page.width,
      height: page.height,
      dataLength: page.data.length,
    });
    
    // Load PNG using @napi-rs/canvas
    const img = await loadImage(Buffer.from(page.data));
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    console.log("Extracted RGBA data. Decoding QR...");
    
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code) {
      console.log("QR decoded successfully!");
      console.log("QR Data:", code.data);
    } else {
      console.log("Failed to decode QR code.");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
