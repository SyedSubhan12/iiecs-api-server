const fs = require("fs");
const path = require("path");
const pdf: any = require('pdf-parse');

/**
 * Simple script to parse all PDF files in the id_Cards directory and log their text length.
 * Uses the functional pdf-parse API.
 */
async function runDecodeAllQrs() {
  const dirPath = "/home/zaro/app_manager/id_Cards";
  const files = fs.readdirSync(dirPath).filter((f: string) => f.endsWith('.pdf'));
  console.log(`Parsing ${files.length} PDF files...`);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const dataBuffer = fs.readFileSync(filePath);
    const uint8Array = new Uint8Array(dataBuffer);
    try {
      const pdfData = await pdf(uint8Array);
      console.log(`File: ${file} – text length: ${pdfData.text?.length ?? 0}`);
      if (pdfData.info) {
        console.log('--- PDF Info ---');
        console.dir(pdfData.info, { depth: null });
      }
    } catch (err) {
      console.error(`Error processing ${file}:`, err);
    }
  }
}

runDecodeAllQrs();
