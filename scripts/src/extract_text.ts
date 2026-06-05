import * as fs from "fs";
import { PDFParse } from "pdf-parse";

async function run() {
  const filePath = "/home/zaro/app_manager/id_Cards/IIECS_ID_IIECS-001_Meerab_faisal_Faisal (7).pdf";
  const dataBuffer = fs.readFileSync(filePath);
  const uint8Array = new Uint8Array(dataBuffer);
  
  try {
    const parser = new PDFParse(uint8Array);
    console.log("Loading PDF...");
    await parser.load();
    
    console.log("Getting Info...");
    const info = await parser.getInfo();
    console.log("--- Info ---");
    console.dir(info, { depth: null });
    
    console.log("Getting Images...");
    const images = await parser.getImage();
    console.log("--- Images ---");
    console.log(`Found ${images.pages.length} pages. Total images:`, images.pages.map(p => p.images.length));
    if (images.pages[0] && images.pages[0].images.length > 0) {
      const img = images.pages[0].images[0];
      console.log("First image metadata:", {
        name: img.name,
        width: img.width,
        height: img.height,
        kind: img.kind,
        dataLength: img.data.length,
        hasDataUrl: !!img.dataUrl,
      });
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
