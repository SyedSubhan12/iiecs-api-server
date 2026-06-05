import * as fs from "fs";
const pdf = require('pdf-parse');


async function runTestQrDecode() {
  const filePath = "/home/zaro/app_manager/id_Cards/IIECS_ID_IIECS-001_Meerab_faisal_Faisal (7).pdf";
  const dataBuffer = fs.readFileSync(filePath);
  const uint8Array = new Uint8Array(dataBuffer);
    try {
        const pdfData = await pdf(uint8Array);
        console.log(`Parsed PDF text length: ${pdfData.text?.length ?? 'N/A'}`);
        if (pdfData.info) {
            console.log('--- Info ---');
            console.dir(pdfData.info, { depth: null });
        }
        console.log('PDF processing completed.');
    } catch (err) {
        console.error('Error:', err);
    }
}

runTestQrDecode();
