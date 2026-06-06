import { writeFileSync } from "fs";
import { buildInvoicePdfBuffer } from "../../artifacts/api-server/src/routes/invoices";

async function main() {
  const pdfBuffer = await buildInvoicePdfBuffer({
    invoiceNumber: "INV-TEST-0001",
    issuedDate: new Date(),
    dueDate: null,
    status: "unpaid",
    amountPkr: 2000,
    student: {
      fullName: "John Doe",
      idNumber: "123456",
      batch: "2024-2025",
      email: "john.doe@example.com",
    },
  });

  writeFileSync("/home/zaro/app_manager/artifacts/test_invoice.pdf", pdfBuffer);
  console.log("Test PDF generated at /home/zaro/app_manager/artifacts/test_invoice.pdf");
}

main().catch((err) => {
  console.error("Error generating test PDF:", err);
  process.exit(1);
});
