import { useAuth } from "@/contexts/AuthContext";
import {
  useGetStudentByEmail,
  useListInvoices,
  getGetStudentByEmailQueryKey,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import { StudentLayout } from "@/components/StudentLayout";

function downloadPDF(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
      URL.revokeObjectURL(url);
    };
  }
}

export default function StudentDownloads() {
  const { user } = useAuth();

  const { data: student } = useGetStudentByEmail(encodeURIComponent(user?.email ?? ""), {
    query: {
      enabled: !!user?.email,
      queryKey: getGetStudentByEmailQueryKey(encodeURIComponent(user?.email ?? "")),
    },
  });

  const { data: invoices } = useListInvoices(
    { studentId: student?.id },
    {
      query: {
        enabled: !!student?.id,
        queryKey: getListInvoicesQueryKey({ studentId: student?.id }),
      },
    },
  );

  function handleDownloadID() {
    if (!student) return;
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Student ID Card — ${student.fullName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: white; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { width: 3.375in; height: 2.125in; background: linear-gradient(135deg, #001F3F 0%, #003366 100%); border-radius: 12px; padding: 20px; color: white; position: relative; overflow: hidden; }
    .card::before { content: ''; position: absolute; top: -30px; right: -30px; width: 120px; height: 120px; background: rgba(255,193,7,0.15); border-radius: 50%; }
    .header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; border-bottom: 1px solid rgba(255,193,7,0.3); padding-bottom: 10px; }
    .logo { width: 32px; height: 32px; background: #FFC107; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 11px; color: #001F3F; }
    .inst { font-size: 13px; font-weight: 700; }
    .course { font-size: 9px; color: rgba(255,255,255,0.6); }
    .name { font-size: 16px; font-weight: 700; margin-bottom: 3px; }
    .id { font-size: 11px; color: #FFC107; font-family: monospace; margin-bottom: 8px; }
    .details { font-size: 9px; color: rgba(255,255,255,0.7); }
    .details span { display: block; margin-bottom: 2px; }
    .badge { position: absolute; bottom: 12px; right: 14px; background: rgba(255,193,7,0.2); border: 1px solid rgba(255,193,7,0.4); border-radius: 4px; padding: 3px 8px; font-size: 8px; color: #FFC107; font-weight: 600; letter-spacing: 0.5px; }
    @media print { body { min-height: unset; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">II</div>
      <div>
        <div class="inst">IIECS Institute</div>
        <div class="course">C/C++ Algorithms Program</div>
      </div>
    </div>
    <div class="name">${student.fullName}</div>
    <div class="id">${student.idNumber}</div>
    <div class="details">
      <span>Batch: ${student.batch}</span>
      <span>Email: ${student.email}</span>
      <span>Enrolled: ${new Date(student.enrollmentDate).toLocaleDateString()}</span>
    </div>
    <div class="badge">STUDENT ID</div>
  </div>
  <script>window.print();</script>
</body>
</html>`;
    downloadPDF(html, `ID-Card-${student.idNumber}`);
  }

  function handleDownloadInvoice(inv: { invoiceNumber: string; amount: number; issuedDate?: string; dueDate?: string | null; status: string }) {
    if (!student) return;
    const isPaid = inv.status === "paid";
    const statusBg = isPaid ? "#e6f4ea" : "#fff3e0";
    const statusColor = isPaid ? "#1e7e34" : "#e65100";
    const statusBorder = isPaid ? "#c3e6cb" : "#ffcc80";
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${inv.invoiceNumber} — Upriser: Institute of Technology</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4f8; color: #1a1a2e; display: flex; justify-content: center; padding: 32px 16px; }
    .invoice { background: #fff; width: 100%; max-width: 720px; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.10); overflow: hidden; }
    .header { background: linear-gradient(135deg,#001F3F 0%,#003366 100%); padding: 28px 36px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .header img { height: 64px; background: #fff; border-radius: 8px; padding: 5px 8px; }
    .header-right { text-align: right; }
    .header-right h1 { color: #fff; font-size: 18px; font-weight: 800; }
    .header-right p { color: #FFC107; font-size: 11px; font-style: italic; margin-top: 3px; }
    .title-bar { background: #FFC107; padding: 10px 36px; display: flex; justify-content: space-between; align-items: center; }
    .title-bar h2 { color: #001F3F; font-size: 16px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
    .title-bar .meta { text-align: right; font-size: 11px; color: #001F3F; font-weight: 600; line-height: 1.6; }
    .body { padding: 28px 36px; }
    .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #001F3F; border-bottom: 2px solid #FFC107; padding-bottom: 5px; margin-bottom: 14px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
    .info-block .label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .info-block .value { font-size: 13px; font-weight: 600; color: #1a1a2e; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    thead tr { background: #001F3F; }
    thead th { color: #fff; padding: 9px 12px; font-size: 11px; font-weight: 600; text-align: left; letter-spacing: 0.5px; }
    tbody td { padding: 10px 12px; font-size: 12px; color: #374151; border-bottom: 1px solid #e5e7eb; }
    tbody td:last-child { text-align: right; font-weight: 600; }
    .total-row td { font-weight: 700 !important; font-size: 13px !important; color: #001F3F !important; background: #f9fafb; }
    .amount-banner { background: #001F3F; border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
    .amount-banner .lbl { color: #FFC107; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
    .amount-banner .amt { color: #fff; font-size: 20px; font-weight: 800; }
    .payment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .pcard { border-radius: 8px; overflow: hidden; }
    .pcard-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; }
    .pcard-head span { color: #fff; font-size: 13px; font-weight: 700; }
    .pcard.online .pcard-head { background: #2563eb; }
    .pcard.offline .pcard-head { background: #059669; }
    .pcard-body { background: #f9fafb; padding: 12px 14px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; font-size: 11px; }
    .brow { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
    .brow:last-child { margin-bottom: 0; }
    .brow .blbl { color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px; }
    .brow .bval { font-weight: 700; color: #1a1a2e; text-align: right; word-break: break-all; }
    .offline-body { background: #f9fafb; padding: 16px 14px; text-align: center; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; font-size: 11px; color: #374151; line-height: 1.7; }
    .offline-body strong { color: #059669; font-size: 12px; display: block; margin-bottom: 2px; }
    .note { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 10px 14px; font-size: 11px; color: #92400e; margin-bottom: 20px; line-height: 1.6; }
    .footer { background: #001F3F; color: #9ca3af; text-align: center; padding: 14px 36px; font-size: 10px; line-height: 1.8; }
    .footer strong { color: #FFC107; }
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusBorder}; }
    @media print { body { background: #fff; padding: 0; } .invoice { box-shadow: none; border-radius: 0; } }
  </style>
</head>
<body>
<div class="invoice">
  <div class="header">
    <img src="https://${window.location.host}/upriser-logo.png" alt="Upriser: Institute of Technology" onerror="this.style.display='none'" />
    <div class="header-right">
      <h1>UPRISER: INSTITUTE OF TECHNOLOGY</h1>
      <p>Education and Beyond...</p>
    </div>
  </div>

  <div class="title-bar">
    <h2>Fee Invoice</h2>
    <div class="meta">
      <div>Invoice No: <strong>${inv.invoiceNumber}</strong></div>
      <div>Issue Date: <strong>${inv.issuedDate ? new Date(inv.issuedDate).toLocaleDateString("en-PK", { day: "2-digit", month: "long", year: "numeric" }) : "—"}</strong></div>
      <div>Due Date: <strong>${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-PK", { day: "2-digit", month: "long", year: "numeric" }) : "Upon receipt"}</strong></div>
    </div>
  </div>

  <div class="body">
    <div class="section-title">Student Details</div>
    <div class="info-grid" style="margin-bottom:24px">
      <div class="info-block"><div class="label">Student Name</div><div class="value">${student.fullName}</div></div>
      <div class="info-block"><div class="label">Student ID</div><div class="value">${student.idNumber}</div></div>
      <div class="info-block"><div class="label">Course</div><div class="value">C/C++ Algorithms — IIECS-101</div></div>
      <div class="info-block"><div class="label">Batch</div><div class="value">${student.batch}</div></div>
      <div class="info-block"><div class="label">Email</div><div class="value">${student.email}</div></div>
      <div class="info-block"><div class="label">Status</div><div class="value"><span class="status-badge">${inv.status.toUpperCase()}</span></div></div>
    </div>

    <div class="section-title">Fee Breakdown</div>
    <table>
      <thead><tr><th>#</th><th>Description</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td>1</td><td>Course Fee — C/C++ Algorithms (${student.batch})</td><td>Rs ${inv.amount.toLocaleString()}</td></tr>
        <tr class="total-row"><td colspan="2" style="text-align:right;padding-right:12px"><strong>Total Amount Due</strong></td><td><strong>Rs ${inv.amount.toLocaleString()}</strong></td></tr>
      </tbody>
    </table>

    <div class="amount-banner">
      <span class="lbl">Total Amount Due</span>
      <span class="amt">Rs ${inv.amount.toLocaleString()} /-</span>
    </div>

    <div class="section-title">Payment Options</div>
    <div class="payment-grid">
      <div class="pcard online">
        <div class="pcard-head">🏦 <span>Online Payment</span></div>
        <div class="pcard-body">
          <div class="brow"><span class="blbl">Bank</span><span class="bval">Bank Alfalah</span></div>
          <div class="brow"><span class="blbl">Title</span><span class="bval">Upriser: The School</span></div>
          <div class="brow"><span class="blbl">Account No</span><span class="bval">0017101010424474</span></div>
          <div class="brow"><span class="blbl">IBAN</span><span class="bval">PK02ALFH0017001010424474</span></div>
          <div class="brow"><span class="blbl">Contact</span><span class="bval">0337-3724886</span></div>
        </div>
      </div>
      <div class="pcard offline">
        <div class="pcard-head">🏢 <span>Offline Payment</span></div>
        <div class="offline-body">
          💵<br/>
          Submit cash or cheque at:<br/>
          <strong>Admin Office</strong>
          Upriser: Institute of Technology<br/>
          Mon–Sat &nbsp;|&nbsp; 9:00 AM – 4:00 PM<br/>
          Contact: <strong style="display:inline">0337-3724886</strong>
        </div>
      </div>
    </div>

    <div class="note">
      ⚠️ <strong>Important:</strong> After online transfer, share the receipt with the Admin Office via WhatsApp or in person. Pay before the due date to avoid a late fine.
    </div>
  </div>

  <div class="footer">
    <strong>Upriser: Institute of Technology</strong> &nbsp;|&nbsp; Education and Beyond... &nbsp;|&nbsp; Contact: 0337-3724886<br/>
    This is a computer-generated invoice. No signature is required.
  </div>
</div>
<script>window.print();</script>
</body>
</html>`;
    downloadPDF(html, `Invoice-${inv.invoiceNumber}`);
  }

  return (
    <StudentLayout title="Downloads">
      {/* ID Card */}
      <div className="bg-card border border-card-border rounded-xl p-6 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Student ID Card</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Printable ID card with your student information and QR code</p>
          </div>
          <button
            onClick={handleDownloadID}
            disabled={!student}
            className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Print ID Card
          </button>
        </div>

        {student && (
          <div className="mt-5 p-4 bg-background rounded-lg border border-border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <span className="text-primary-foreground font-black text-sm">II</span>
              </div>
              <div>
                <div className="font-semibold text-foreground">{student.fullName}</div>
                <div className="text-xs font-mono text-primary mt-0.5">{student.idNumber}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{student.batch}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Invoices */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Invoices</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Download printable PDF invoices</p>
        </div>

        {!invoices || invoices.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No invoices available yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors">
                <div>
                  <div className="font-mono text-sm text-primary font-medium">{inv.invoiceNumber}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    PKR {inv.amount.toLocaleString()} &bull; Issued {inv.issuedDate ? new Date(inv.issuedDate).toLocaleDateString() : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded border font-medium ${
                    inv.status === "paid"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  }`}>
                    {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                  </span>
                  <button
                    onClick={() => handleDownloadInvoice(inv)}
                    className="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded-md hover:opacity-90 transition-opacity border border-border"
                  >
                    Print PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
