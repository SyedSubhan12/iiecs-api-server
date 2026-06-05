import * as fs from "fs";
import * as path from "path";
import { PDFParse } from "pdf-parse";
import { loadImage, createCanvas } from "@napi-rs/canvas";
import jsQR from "jsqr";

async function run() {
  const dirPath = "/home/zaro/app_manager/id_Cards";
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith(".pdf"));
  console.log(`Decoding QR codes for ${files.length} files...`);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const dataBuffer = fs.readFileSync(filePath);
    const uint8Array = new Uint8Array(dataBuffer);
    
    try {
      const parser = new PDFParse(uint8Array);
      await parser.load();
      const screenshot = await parser.getScreenshot({ imageBuffer: true, scale: 2 });
      const page = screenshot.pages[0];
      
      const img = await loadImage(Buffer.from(page.data));
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      
      if (code) {
        console.log(`File: ${file}`);
        console.log(`  QR Data: ${code.data}`);
      } else {
        console.log(`File: ${file} -> QR Code NOT DECODED`);
      }
    } catch (err: any) {
      console.log(`File: ${file} -> ERROR: ${err.message}`);
    }
  }
}

run();
