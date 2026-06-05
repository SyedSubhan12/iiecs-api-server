import { useState } from "react";
import {
  useListPayments,
  useUpdatePayment,
  useCreatePayment,
  useListStudents,
  useGenerateMonthlyInvoices,
  useListInvoices,
  getListPaymentsQueryKey,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";

const API_BASE = "/api";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    overdue: "bg-red-500/20 text-red-400 border-red-500/30",
    partial: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    unpaid: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status] ?? "bg-muted text-muted-foreground border-border"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function InvoicePdfModal({ invoiceId, invoiceNumber, onClose }: { invoiceId: string; invoiceNumber: string; onClose: () => void }) {
  const pdfUrl = `${API_BASE}/invoices/${invoiceId}/pdf`;
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-card-border rounded-xl shadow-2xl w-full max-w-4xl flex flex-col"
        style={{ height: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <div>
            <div className="text-sm font-semibold text-foreground">Invoice Preview</div>
            <div className="text-xs text-muted-foreground font-mono mt-0.5">{invoiceNumber}</div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={pdfUrl}
              download={`${invoiceNumber}.pdf`}
              className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              ⬇ Download PDF
            </a>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
              aria-label="Close preview"
            >
              ✕
            </button>
          </div>
        </div>
        {/* PDF iframe */}
        <iframe
          src={pdfUrl}
          className="w-full flex-1 rounded-b-xl"
          title={`Invoice ${invoiceNumber}`}
          style={{ border: "none" }}
        />
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<{ id: string; invoiceNumber: string } | null>(null);
  const [invoiceMonth, setInvoiceMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [generateResult, setGenerateResult] = useState<{ created: number; skipped: number; month: string } | null>(null);
  const [form, setForm] = useState({ studentId: "", amount: "2000", description: "Course Fee - IIECS-101", dueDate: "" });
  const [clearConfirm, setClearConfirm] = useState<"attendance" | "payments" | null>(null);
  const [clearStatus, setClearStatus] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: payments, isLoading } = useListPayments(
    { status: statusFilter || undefined },
    { query: { queryKey: getListPaymentsQueryKey({ status: statusFilter || undefined }) } },
  );
  const { data: students } = useListStudents();
  const { data: invoices, isLoading: invoicesLoading } = useListInvoices(
    undefined,
    { query: { queryKey: getListInvoicesQueryKey() } },
  );

  const updateMutation = useUpdatePayment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
      },
    },
  });

  const createMutation = useCreatePayment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
        setShowForm(false);
        setForm({ studentId: "", amount: "2000", description: "Course Fee - IIECS-101", dueDate: "" });
      },
    },
  });

  const generateMutation = useGenerateMonthlyInvoices({
    mutation: {
      onSuccess: (data) => {
        setGenerateResult({ created: data.created, skipped: data.skipped, month: data.month });
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      },
    },
  });

  function markPaid(id: string) {
    updateMutation.mutate({ id, data: { status: "paid" } });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      data: {
        studentId: form.studentId,
        amount: parseFloat(form.amount),
        description: form.description,
        dueDate: form.dueDate || null,
      },
    });
  }

  function handleGenerateInvoices() {
    setGenerateResult(null);
    generateMutation.mutate({ data: { month: invoiceMonth } });
  }

  async function handleClearAll(type: "attendance" | "payments") {
    setClearStatus("Clearing...");
    try {
      const res = await fetch(`${API_BASE}/${type}`, { method: "DELETE" });
      const data = await res.json() as { deleted: number };
      setClearStatus(`✅ Deleted ${data.deleted} ${type} record${data.deleted !== 1 ? "s" : ""}.`);
      if (type === "payments") {
        queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
      }
    } catch {
      setClearStatus("❌ Failed to clear records.");
    } finally {
      setClearConfirm(null);
    }
  }

  const totalPending = payments?.filter((p) => p.status !== "paid").reduce((s, p) => s + p.amount, 0) ?? 0;
  const totalPaid = payments?.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0) ?? 0;

  return (
    <AdminLayout title="Payments">
      {/* PDF Preview Modal */}
      {previewInvoice && (
        <InvoicePdfModal
          invoiceId={previewInvoice.id}
          invoiceNumber={previewInvoice.invoiceNumber}
          onClose={() => setPreviewInvoice(null)}
        />
      )}

      {/* Confirm Dialog */}
      {clearConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-sm shadow-xl">
            <div className="text-sm font-semibold text-red-400 mb-1">⚠️ Danger Zone</div>
            <p className="text-sm text-foreground mb-5">
              Are you sure you want to delete <strong>ALL {clearConfirm}</strong> records? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleClearAll(clearConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-md hover:bg-red-700 transition-colors"
              >
                Yes, Delete All
              </button>
              <button
                onClick={() => setClearConfirm(null)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Records</div>
          <div className="text-2xl font-bold text-foreground">{payments?.length ?? 0}</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Collected</div>
          <div className="text-2xl font-bold text-emerald-400">PKR {totalPaid.toLocaleString()}</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Outstanding</div>
          <div className="text-2xl font-bold text-amber-400">PKR {totalPending.toLocaleString()}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-md bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="partial">Partial</option>
        </select>
        <div className="flex-1" />
        <button
          onClick={() => setShowInvoiceModal(true)}
          className="px-4 py-2 bg-secondary text-secondary-foreground text-sm font-medium rounded-md border border-border hover:opacity-90 transition-opacity"
        >
          📄 Generate Monthly Invoices
        </button>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
        >
          Create Payment
        </button>
      </div>

      {/* Generate Invoices Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-card-border rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-base font-semibold text-foreground mb-1">Generate Monthly Invoices</h3>
            <p className="text-xs text-muted-foreground mb-5">
              Creates a Rs 2,000 invoice for every student who doesn't already have one for the selected month. Existing invoices are skipped.
            </p>

            <div className="mb-5">
              <label className="block text-xs text-muted-foreground mb-1.5">Month</label>
              <input
                type="month"
                value={invoiceMonth}
                onChange={(e) => { setInvoiceMonth(e.target.value); setGenerateResult(null); }}
                className="w-full px-3 py-2 rounded-md bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {generateResult && (
              <div className="mb-5 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm">
                <div className="font-semibold text-emerald-400 mb-1">Done — {generateResult.month}</div>
                <div className="text-foreground">
                  <span className="text-emerald-400 font-bold">{generateResult.created}</span> invoice{generateResult.created !== 1 ? "s" : ""} created &nbsp;·&nbsp;
                  <span className="text-muted-foreground">{generateResult.skipped} already existed</span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleGenerateInvoices}
                disabled={generateMutation.isPending}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {generateMutation.isPending ? "Generating..." : "Generate Invoices"}
              </button>
              <button
                type="button"
                onClick={() => { setShowInvoiceModal(false); setGenerateResult(null); }}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="mb-5 bg-card border border-card-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">New Payment</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Student *</label>
              <select
                required
                value={form.studentId}
                onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
                className="w-full px-3 py-2 rounded-md bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select student</option>
                {students?.map((s) => (
                  <option key={s.id} value={s.id}>{s.fullName} ({s.idNumber})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Amount (PKR) *</label>
              <input
                type="number"
                required
                value={form.amount}
                disabled
                className="w-full px-3 py-2 rounded-md bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 rounded-md bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Due Date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                className="w-full px-3 py-2 rounded-md bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payments Table */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden mb-8">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : !payments || payments.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No payments found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Student", "Amount", "Description", "Due Date", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{p.studentName}</td>
                    <td className="px-4 py-3 font-mono text-foreground font-semibold">PKR {p.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.description}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.dueDate ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3">
                      {p.status !== "paid" && (
                        <button
                          onClick={() => markPaid(p.id)}
                          disabled={updateMutation.isPending}
                          className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Invoices Section ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Invoices</h2>
          <span className="text-xs text-muted-foreground">{invoices?.length ?? 0} total</span>
        </div>
        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          {invoicesLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading invoices...</div>
          ) : !invoices || invoices.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No invoices yet. Generate monthly invoices or use the Invoice button per student.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Invoice #", "Student", "Amount", "Issued", "Due", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-primary">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 font-medium text-foreground text-xs">{inv.studentName}</td>
                      <td className="px-4 py-3 font-mono text-foreground font-semibold text-xs">PKR {inv.amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(inv.issuedDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{inv.dueDate ?? "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPreviewInvoice({ id: inv.id, invoiceNumber: inv.invoiceNumber })}
                            className="text-xs px-2.5 py-1 rounded border font-medium bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25 transition-colors whitespace-nowrap"
                          >
                            🔍 Preview
                          </button>
                          <a
                            href={`${API_BASE}/invoices/${inv.id}/pdf`}
                            download={`${inv.invoiceNumber}.pdf`}
                            className="text-xs px-2.5 py-1 rounded border font-medium bg-muted text-muted-foreground border-border hover:text-foreground transition-colors whitespace-nowrap"
                          >
                            ⬇ PDF
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Danger Zone ── */}
      <div className="border border-red-500/20 rounded-lg p-5 bg-red-500/5">
        <div className="text-sm font-semibold text-red-400 mb-1">⚠️ Danger Zone</div>
        <p className="text-xs text-muted-foreground mb-4">
          These actions permanently delete records from the database and cannot be undone.
        </p>
        {clearStatus && (
          <div className="mb-4 text-xs text-foreground bg-muted/30 rounded px-3 py-2 border border-border">
            {clearStatus}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => { setClearStatus(null); setClearConfirm("attendance"); }}
            className="px-4 py-2 text-sm font-medium rounded-md border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
          >
            🗑 Clear All Attendance Records
          </button>
          <button
            onClick={() => { setClearStatus(null); setClearConfirm("payments"); }}
            className="px-4 py-2 text-sm font-medium rounded-md border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
          >
            🗑 Clear All Payments
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
