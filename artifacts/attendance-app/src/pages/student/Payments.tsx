import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGetStudentByEmail,
  useListPayments,
  useListInvoices,
  useCreateInvoice,
  getGetStudentByEmailQueryKey,
  getListPaymentsQueryKey,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { StudentLayout } from "@/components/StudentLayout";

const API_BASE = "/api";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    overdue: "bg-red-500/20 text-red-400 border-red-500/30",
    unpaid: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    partial: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    cancelled: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status] ?? "bg-muted text-muted-foreground border-border"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function StudentInvoiceButton({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invoiceMutation = useCreateInvoice({
    mutation: {
      onSuccess: () => {
        setSuccess(true);
        setError(null);
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey({ studentId }) });
      },
      onError: () => {
        setError("Failed to generate invoice");
      },
    },
  });

  function handleGenerate() {
    setSuccess(false);
    setError(null);
    invoiceMutation.mutate({ data: { studentId } });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleGenerate}
        disabled={invoiceMutation.isPending}
        className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {invoiceMutation.isPending ? "Generating…" : "📄 Generate Invoice"}
      </button>
      {success && <span className="text-xs text-emerald-400 font-semibold">Generated</span>}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

export default function StudentPayments() {
  const { user } = useAuth();

  const { data: student } = useGetStudentByEmail(encodeURIComponent(user?.email ?? ""), {
    query: {
      enabled: !!user?.email,
      queryKey: getGetStudentByEmailQueryKey(encodeURIComponent(user?.email ?? "")),
    },
  });

  const { data: payments, isLoading: paymentsLoading } = useListPayments(
    { studentId: student?.id },
    {
      query: {
        enabled: !!student?.id,
        queryKey: getListPaymentsQueryKey({ studentId: student?.id }),
      },
    },
  );

  const { data: invoices, isLoading: invoicesLoading } = useListInvoices(
    { studentId: student?.id },
    {
      query: {
        enabled: !!student?.id,
        queryKey: getListInvoicesQueryKey({ studentId: student?.id }),
      },
    },
  );

  const totalPaid = payments?.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0) ?? 0;
  const totalPending = payments?.filter((p) => p.status !== "paid").reduce((s, p) => s + p.amount, 0) ?? 0;

  return (
    <StudentLayout title="Payments & Invoices">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-card border border-card-border rounded-lg p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Total Paid</div>
          <div className="text-3xl font-bold text-emerald-400">PKR {totalPaid.toLocaleString()}</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Outstanding</div>
          <div className="text-3xl font-bold text-amber-400">PKR {totalPending.toLocaleString()}</div>
        </div>
      </div>

      {/* Payments */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Payment Records</h3>
        </div>
        {paymentsLoading ? (
          <div className="p-6 text-center text-muted-foreground text-sm">Loading...</div>
        ) : !payments || payments.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">No payment records.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Description", "Amount", "Due Date", "Paid Date", "Status"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 text-foreground text-xs">{p.description ?? "Course Fee"}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-foreground">PKR {p.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.dueDate ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.paidDate ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoices */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-foreground">Invoices</h3>
          {student?.id && <StudentInvoiceButton studentId={student.id} />}
        </div>
        {invoicesLoading ? (
          <div className="p-6 text-center text-muted-foreground text-sm">Loading...</div>
        ) : !invoices || invoices.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">No invoices generated yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Invoice #", "Amount", "Issued", "Due", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs text-primary">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 font-semibold font-mono text-foreground">PKR {inv.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {inv.issuedDate ? new Date(inv.issuedDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{inv.dueDate ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3">
                      <a
                        href={`${API_BASE}/invoices/${inv.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2.5 py-1 rounded border font-medium bg-secondary text-secondary-foreground border-border hover:opacity-90 transition-all whitespace-nowrap"
                      >
                        ⬇ PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
