import { useAuth } from "@/contexts/AuthContext";
import {
  useGetStudentByEmail,
  useListInvoices,
  getGetStudentByEmailQueryKey,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import { StudentLayout } from "@/components/StudentLayout";

async function downloadFile(url: string, filename: string, userEmail: string) {
  const res = await fetch(url, { headers: { "x-user-email": userEmail } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to download (${res.status})`);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
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
    if (!student || !user?.email) return;
    
    // If student has an official ID card URL from Supabase, open it in a new tab
    if (student.idCardUrl) {
      window.open(student.idCardUrl, "_blank");
      return;
    }

    downloadFile(`/api/students/${student.id}/id-card.pdf`, `ID-Card-${student.idNumber}.pdf`, user.email).catch(() => {});
  }

  function handleDownloadInvoice(inv: { id: string; invoiceNumber: string }) {
    if (!user?.email) return;
    downloadFile(`/api/invoices/${inv.id}/pdf`, `Invoice-${inv.invoiceNumber}.pdf`, user.email).catch(() => {});
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
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadID}
              disabled={!student}
              className="px-5 py-2.5 bg-secondary text-secondary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity border border-border disabled:opacity-50"
            >
              Download ID Card PDF
            </button>
          </div>
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
                    Download PDF
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
