#!/usr/bin/env node

import { db, studentsTable } from '../lib/db/index.js';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

// Add the two new students to the database
async function addNewStudents() {
  try {
    console.log('Adding new students to database...');
    
    // Student 023: Jacob Haroon Francis
    const student023 = {
      email: 'jacob.haroon@example.com',
      fullName: 'Jacob Haroon Francis',
      idNumber: 'IIECS-023',
      batch: '2026',
      phone: '',
      address: '',
      cnic: ''
    };
    
    // Student 024: Muhaammad Irfan
    const student024 = {
      email: 'muhammad.irfan@example.com',
      fullName: 'Muhaammad Irfan',
      idNumber: 'IIECS-024',
      batch: '2026',
      phone: '',
      address: '',
      cnic: ''
    };
    
    // Insert student 023
    const [newStudent023] = await db
      .insert(studentsTable)
      .values({
        ...student023,
        email: student023.email.toLowerCase().trim(),
        qrCodeData: ''
      })
      .returning();
    
    console.log('Student 023 added:', newStudent023.fullName);
    
    // Update QR code with real ID
    const qrData023 = {
      id: newStudent023.id,
      name: newStudent023.fullName,
      email: newStudent023.email,
      idNumber: newStudent023.idNumber,
      batch: newStudent023.batch,
      enrollmentDate: newStudent023.enrollmentDate.toISOString().split('T')[0],
    };
    
    await db
      .update(studentsTable)
      .set({ qrCodeData: JSON.stringify(qrData023) })
      .where(eq(studentsTable.id, newStudent023.id));
    
    // Insert student 024
    const [newStudent024] = await db
      .insert(studentsTable)
      .values({
        ...student024,
        email: student024.email.toLowerCase().trim(),
        qrCodeData: ''
      })
      .returning();
    
    console.log('Student 024 added:', newStudent024.fullName);
    
    // Update QR code with real ID
    const qrData024 = {
      id: newStudent024.id,
      name: newStudent024.fullName,
      email: newStudent024.email,
      idNumber: newStudent024.idNumber,
      batch: newStudent024.batch,
      enrollmentDate: newStudent024.enrollmentDate.toISOString().split('T')[0],
    };
    
    await db
      .update(studentsTable)
      .set({ qrCodeData: JSON.stringify(qrData024) })
      .where(eq(studentsTable.id, newStudent024.id));
    
    console.log('Both students added successfully!');
    
    // Return student IDs for further processing
    return {
      student023: { id: newStudent023.id, ...student023 },
      student024: { id: newStudent024.id, ...student024 }
    };
    
  } catch (error) {
    console.error('Error adding students:', error);
    throw error;
  }
}

// Upload ID cards for new students
async function uploadIdCards(studentIds) {
  try {
    const idCardsDir = '/home/zaro/app_manager/id_Cards';
    
    // Read ID card files
    const files = await fs.readdir(idCardsDir);
    const idCardFiles = files.filter(f => f.startsWith('IIECS_ID_IIECS-023') || f.startsWith('IIECS_ID_IIECS-024'));
    
    for (const file of idCardFiles) {
      const filePath = path.join(idCardsDir, file);
      const pdfBuffer = await fs.readFile(filePath);
      
      // Extract student ID from filename
      const studentId = file.includes('IIECS-023') ? studentIds.student023.id : studentIds.student024.id;
      
      // Upload PDF to database
      await db
        .update(studentsTable)
        .set({ 
          idCardPdf: pdfBuffer,
          idCardPdfFileName: file,
          idCardUrl: null
        })
        .where(eq(studentsTable.id, studentId));
      
      console.log(`ID card uploaded for ${file}`);
    }
    
    console.log('ID cards uploaded successfully!');
  } catch (error) {
    console.error('Error uploading ID cards:', error);
    throw error;
  }
}

// Generate invoices for new students
async function generateInvoices(studentIds) {
  try {
    // Note: This would need to be implemented based on the invoice generation logic
    // For now, we'll just log the action
    console.log('Invoices to be generated for:', [
      studentIds.student023.fullName,
      studentIds.student024.fullName
    ]);
    
    // TODO: Implement invoice generation using the existing invoice logic
    // This would involve:
    // 1. Getting the invoice template
    // 2. Creating invoice records in the database
    // 3. Generating PDF invoices
    // 4. Emailing invoices to students
    
  } catch (error) {
    console.error('Error generating invoices:', error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    const studentIds = await addNewStudents();
    await uploadIdCards(studentIds);
    await generateInvoices(studentIds);
    console.log('All operations completed successfully!');
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

main();