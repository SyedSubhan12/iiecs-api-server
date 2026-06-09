import { Pool } from 'pg';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';

// Directory containing the PDF ID cards
const idCardsDir = '/home/zaro/app_manager/id_Cards';
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'iiecs'
};

async function uploadIdCards() {
  try {
    const pool = new Pool(dbConfig);
    
    // Read all PDF files from the id_Cards directory
    const files = readdirSync(idCardsDir);
    const pdfFiles = files.filter(file => file.endsWith('.pdf'));
    
    console.log(`Found ${pdfFiles.length} PDF files in ${idCardsDir}`);
    
    for (const file of pdfFiles) {
      const filePath = path.join(idCardsDir, file);
      const pdfBuffer = readFileSync(filePath);
      
      // Extract student ID from filename (format: IIECS_ID_IIECS-XXX_Name.pdf)
      const match = file.match(/IIECS_ID_IIECS-(\d+)_/);
      if (!match) {
        console.log(`⚠️  Could not extract student ID from filename: ${file}`);
        continue;
      }
      
      const studentId = `IIECS-${match[1].padStart(3, '0')}`;
      
      console.log(`📄 Processing: ${file} (Student ID: ${studentId})`);
      
      // Upload to database
      const query = `
        UPDATE students 
        SET id_card_pdf = $1, 
            id_card_pdf_file_name = $2,
            updated_at = NOW()
        WHERE id_number = $3
      `;
      
      await pool.query(query, [pdfBuffer, file, studentId]);
      
      console.log(`✅ Uploaded ID card for student ${studentId}`);
    }
    
    await pool.end();
    console.log('✅ All ID cards uploaded successfully!');
    
  } catch (error) {
    console.error('❌ Error uploading ID cards:', error);
    throw error;
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  uploadIdCards()
    .then(() => {
      console.log('Upload completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Upload failed:', error);
      process.exit(1);
    });
}