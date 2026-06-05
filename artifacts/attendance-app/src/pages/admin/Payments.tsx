import { useState } from "react";
import {
  useListPayments,
  useUpdatePayment,
  useCreatePayment,
  useListStudents,
  useGenerateMonthlyInvoices,
  getListPaymentsQueryKey,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    overdue: "bg-red-500/20 text-red-400 border-red-500/30",
    partial: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status] ?? "bg-muted text-muted-foreground border-border"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function PaymentsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceMonth, setInvoiceMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [generateResult, setGenerateResult] = useState<{ created: number; skipped: number; month: string } | null>(null);
  const [form, setForm] = useState({ studentId: "", amount: "", description: "Course Fee - IIECS-101", dueDate: "" });
  const queryClient = useQueryClient();

  const { data: payments, isLoading } = useListPayments(
    { status: statusFilter || undefined },
    { query: { queryKey: getListPaymentsQueryKey({ status: statusFilter || undefined }) } },
  );
  const { data: students } = useListStudents();

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
        setForm({ studentId: "", amount: "", description: "Course Fee - IIECS-101", dueDate: "" });
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

  const totalPending = payments?.filter((p) => p.status !== "paid").reduce((s, p) => s + p.amount, 0) ?? 0;
  const totalPaid = payments?.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0) ?? 0;

  return (
    <AdminLayout title="Payments">
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
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="2000"
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

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
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
    </AdminLayout>
  );
}
