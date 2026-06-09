---
name: student-database-integration
description: Process new student ID cards, add them to database, and generate invoices
source: auto-skill
extracted_at: '2026-06-09T18:47:02.599Z'
---

# Student Database Integration Process

## Overview
This skill outlines the complete process for adding new students to the database, uploading their ID cards, and generating invoices, based on the workflow discovered while processing two new students (IIECS-023 and IIECS-024).

## Problem Context
When working with student management systems, a common task is to:
1. Extract student information from ID card filenames
2. Add students to the database with proper validation
3. Upload ID card files and link them to student records
4. Generate invoices for new students

## Solution Approach

### Step 1: Extract Student Information from Filenames
ID card files follow the naming convention: `IIECS_ID_IIECS-XXX_Name.pdf`

```javascript
function extractStudentInfo(filename) {
  // Extract student ID from filename
  const match = filename.match(/IIECS_ID_IIECS-(\d+)_/);
  if (!match) return null;
  
  const studentId = `IIECS-${match[1].padStart(3, '0')}`;
  
  // Extract name (everything after the ID and underscore)
  const namePart = filename.split('_').slice(2).join(' ').replace('.pdf', '');
  
  return {
    idNumber: studentId,
    fullName: namePart,
    email: `${namePart.toLowerCase().replace(/\s+/g, '.')}@example.com`,
    batch: '2026'
  };
}
```

### Step 2: Add Students to Database
Use the database schema to insert student records with proper validation:

```javascript
async function addNewStudents() {
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
  
  // Insert both students
  const [newStudent023] = await db
    .insert(studentsTable)
    .values({
      ...student023,
      email: student023.email.toLowerCase().trim(),
      qrCodeData: ''
    })
    .returning();
    
  const [newStudent024] = await db
    .insert(studentsTable)
    .values({
      ...student024,
      email: student024.email.toLowerCase().trim(),
      qrCodeData: ''
    })
    .returning();
}
```

### Step 3: Generate and Store QR Codes
Generate QR codes with student information:

```javascript
function generateQRCode(student) {
  const qrData = {
    id: student.id,
    name: student.fullName,
    email: student.email,
    idNumber: student.idNumber,
    batch: student.batch,
    enrollmentDate: student.enrollmentDate.toISOString().split('T')[0],
  };
  
  return JSON.stringify(qrData);
}

// Update student records with QR data
await db
  .update(studentsTable)
  .set({ qrCodeData: generateQRCode(newStudent023) })
  .where(eq(studentsTable.id, newStudent023.id));
```

### Step 4: Upload ID Cards
Upload PDF files to the database:

```javascript
async function uploadIdCards(studentIds) {
  const idCardsDir = '/home/zaro/app_manager/id_Cards';
  
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
  }
}
```

### Step 5: Generate Invoices
Create and send invoices for new students:

```javascript
async function generateInvoices(studentIds) {
  // For each student:
  for (const student of [studentIds.student023, studentIds.student024]) {
    // Create invoice record
    const invoiceData = {
      studentId: student.id,
      amount: 5000, // Default fee
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      status: 'pending',
      items: [
        { description: 'Tuition Fee', amount: 4000 },
        { description: 'Registration Fee', amount: 1000 }
      ]
    };
    
    // Insert invoice into database
    const [newInvoice] = await db
      .insert(invoicesTable)
      .values(invoiceData)
      .returning();
    
    // Generate PDF invoice
    const pdfBuffer = await buildInvoicePdfBuffer({
      student: student,
      invoice: newInvoice,
      items: invoiceData.items
    });
    
    // Upload PDF
    await db
      .update(invoicesTable)
      .set({ 
        pdf: pdfBuffer,
        pdfUrl: `/api/invoices/${newInvoice.id}/download`
      })
      .where(eq(invoicesTable.id, newInvoice.id));
    
    // Email invoice to student
    await sendInvoiceEmail(student.email, pdfBuffer);
  }
}
```

## Implementation Details

### Key Components
1. **File Processing**: Parse ID card filenames to extract student information
2. **Database Operations**: Insert students, generate QR codes, upload files
3. **Invoice Generation**: Create invoices, generate PDFs, and email notifications
4. **Error Handling**: Proper error handling for file operations and database queries

### Common Challenges and Solutions

**Challenge: Database Connection Issues**
```javascript
// Solution: Check database connection first
try {
  const pool = new Pool(dbConfig);
  await pool.query('SELECT 1');
  await pool.end();
} catch (error) {
  console.error('Database connection failed:', error);
  throw new Error('Database not available');
}
```

**Challenge: TypeScript Compilation Issues**
```typescript
// Solution: Create type declaration files
declare module 'sib-api-v3-sdk' {
  export class ApiClient {
    static instance: any;
  }
  // ... other type definitions
}
```

**Challenge: File Processing Errors**
```javascript
// Solution: Validate file names before processing
function validateFileName(filename) {
  if (!filename || !filename.endsWith('.pdf')) {
    throw new Error(`Invalid file name: ${filename}`);
  }
  
  const match = filename.match(/IIECS_ID_IIECS-(\d+)_/);
  if (!match) {
    throw new Error(`Could not extract student ID from: ${filename}`);
  }
  
  return true;
}
```

### Best Practices

1. **Batch Processing**: Process multiple students in a single transaction
2. **Error Logging**: Log all operations for debugging
3. **Validation**: Validate all input data before processing
4. **Backup**: Create backups before bulk operations
5. **Testing**: Test with sample data before production use

## Workflow Summary

1. **Extract Information**: Parse ID card filenames to identify new students
2. **Add to Database**: Insert student records with validation
3. **Generate QR Codes**: Create and store QR codes for each student
4. **Upload ID Cards**: Link PDF files to student records
5. **Create Invoices**: Generate and email invoices for new students
6. **Verify Results**: Check that all records were created successfully

This approach ensures that new students are properly integrated into the system with all required documentation and financial records.