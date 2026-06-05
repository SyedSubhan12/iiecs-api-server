import * as fs from "fs";
import * as path from "path";

function readPdf() {
  const filePath = "/home/zaro/app_manager/id_Cards/IIECS_ID_IIECS-001_Meerab_faisal_Faisal (7).pdf";
  const content = fs.readFileSync(filePath, "utf8");
  console.log("PDF length:", content.length);
  // print first 2000 chars and last 2000 chars
  console.log("--- First 2000 chars ---");
  console.log(content.slice(0, 2000));
  console.log("--- Last 2000 chars ---");
  console.log(content.slice(-2000));
}

readPdf();
