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
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${inv.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #001F3F; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #FFC107; }
    .logo-wrap { display: flex; align-items: center; gap: 12px; }
    .logo { width: 44px; height: 44px; background: #001F3F; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; color: #FFC107; }
    .org-name { font-size: 20px; font-weight: 800; color: #001F3F; }
    .org-sub { font-size: 11px; color: #666; }
    .inv-title { text-align: right; }
    .inv-title h1 { font-size: 28px; font-weight: 900; color: #001F3F; }
    .inv-title .inv-num { font-size: 12px; color: #666; font-family: monospace; }
    .section { margin-bottom: 24px; }
    .section h3 { font-size: 10px; font-weight: 700; letter-spacing: 1px; color: #999; text-transform: uppercase; margin-bottom: 8px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #001F3F; color: white; text-align: left; padding: 10px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 12px 14px; font-size: 13px; border-bottom: 1px solid #eee; }
    .total-row td { font-weight: 700; font-size: 15px; background: #FFF8E1; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; background: ${inv.status === "paid" ? "#e6f4ea" : "#fff3e0"}; color: ${inv.status === "paid" ? "#1e7e34" : "#e65100"}; border: 1px solid ${inv.status === "paid" ? "#c3e6cb" : "#ffcc80"}; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-wrap">
      <div class="logo">II</div>
      <div><div class="org-name">IIECS Institute</div><div class="org-sub">C/C++ Algorithms Program — IIECS-101</div></div>
    </div>
    <div class="inv-title">
      <h1>INVOICE</h1>
      <div class="inv-num">${inv.invoiceNumber}</div>
    </div>
  </div>

  <div class="info-grid section">
    <div>
      <h3>Billed To</h3>
      <div style="font-weight:600">${student.fullName}</div>
      <div style="color:#666;font-size:12px">${student.idNumber}</div>
      <div style="color:#666;font-size:12px">${student.email}</div>
      <div style="color:#666;font-size:12px">${student.batch}</div>
    </div>
    <div>
      <h3>Invoice Details</h3>
      <div style="font-size:12px;line-height:1.8">
        <div><strong>Issue Date:</strong> ${inv.issuedDate ? new Date(inv.issuedDate).toLocaleDateString() : "—"}</div>
        <div><strong>Due Date:</strong> ${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "Upon receipt"}</div>
        <div><strong>Status:</strong> <span class="status-badge">${inv.status.toUpperCase()}</span></div>
      </div>
    </div>
  </div>

  <table>
    <thead><tr><th>Description</th><th>Amount</th></tr></thead>
    <tbody>
      <tr><td>Course Fee — IIECS-101 (${student.batch})</td><td>PKR ${inv.amount.toLocaleString()}</td></tr>
      <tr class="total-row"><td><strong>Total Due</strong></td><td><strong>PKR ${inv.amount.toLocaleString()}</strong></td></tr>
    </tbody>
  </table>

  <div class="footer">
    IIECS Institute &bull; Institutional Attendance &amp; Invoice System &bull; Generated ${new Date().toLocaleDateString()}
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
