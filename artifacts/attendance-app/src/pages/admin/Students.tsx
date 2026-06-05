import { useState } from "react";
import {
  useListStudents,
  useCreateStudent,
  useGetStudentProgress,
  useCreateInvoice,
  getListStudentsQueryKey,
  getGetStudentProgressQueryKey,
  getListInvoicesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";

const API_BASE = "/api";

function ProgressPanel({ studentId, idCardUrl }: { studentId: string; idCardUrl?: string | null }) {
  const { data, isLoading } = useGetStudentProgress(studentId, {
    query: { queryKey: getGetStudentProgressQueryKey(studentId) },
  });

  if (isLoading) return <div className="text-xs text-muted-foreground p-4">Loading...</div>;
  if (!data) return null;

  return (
    <div className="mt-3 p-4 bg-background rounded-lg border border-border text-sm space-y-2">
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-muted-foreground">Attendance</div>
          <div className="text-2xl font-bold text-primary mt-0.5">{data.overallAttendancePercentage}%</div>
        </div>
        <div>
          <div className="text-muted-foreground">Days Present</div>
          <div className="font-semibold text-foreground mt-0.5">{data.daysPresent} / {data.totalAttendanceRecords}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Total Paid</div>
          <div className="font-semibold text-emerald-400 mt-0.5">PKR {data.totalPaid.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Pending</div>
          <div className="font-semibold text-amber-400 mt-0.5">PKR {data.totalPending.toLocaleString()}</div>
        </div>
      </div>
      {idCardUrl && (
        <div className="mt-2 pt-2 border-t border-border flex justify-end">
          <a
            href={idCardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
            onClick={(e) => e.stopPropagation()}
          >
            🪪 View Official ID Card PDF
          </a>
        </div>
      )}
    </div>
  );
}

interface InvoiceResult {
  id: string;
  invoiceNumber: string;
}

function InvoiceButton({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<InvoiceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invoiceMutation = useCreateInvoice({
    mutation: {
      onSuccess: (data) => {
        setResult({ id: data.id, invoiceNumber: data.invoiceNumber });
        setError(null);
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      },
      onError: () => {
        setError("Failed to generate invoice");
      },
    },
  });

  function handleGenerate(e: React.MouseEvent) {
    e.stopPropagation();
    setResult(null);
    setError(null);
    invoiceMutation.mutate({ data: { studentId } });
  }

  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={handleGenerate}
        disabled={invoiceMutation.isPending}
        className="text-xs px-2.5 py-1 rounded border font-medium bg-violet-500/15 text-violet-400 border-violet-500/30 hover:bg-violet-500/25 transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        {invoiceMutation.isPending ? "Generating…" : "📄 Invoice"}
      </button>
      {result && (
        <a
          href={`${API_BASE}/invoices/${result.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-emerald-400 hover:underline font-semibold whitespace-nowrap"
          title={result.invoiceNumber}
        >
          ✅ View PDF
        </a>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

export default function StudentsPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", fullName: "", idNumber: "", batch: "Batch B - C/C++ Algorithms", phone: "", cnic: "" });
  const queryClient = useQueryClient();

  const { data: students, isLoading } = useListStudents(
    { search: search || undefined },
    { query: { queryKey: getListStudentsQueryKey({ search: search || undefined }) } },
  );

  const createMutation = useCreateStudent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        setShowForm(false);
        setForm({ email: "", fullName: "", idNumber: "", batch: "Batch B - C/C++ Algorithms", phone: "", cnic: "" });
      },
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({ data: { ...form } });
  }

  return (
    <AdminLayout title="Students">
      <div className="flex items-center gap-3 mb-5">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or ID..."
          className="flex-1 max-w-xs px-3 py-2 rounded-md bg-card border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex-1" />
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
        >
          Add Student
        </button>
      </div>

      {/* Add Student Form */}
      {showForm && (
        <div className="mb-5 bg-card border border-card-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">New Student</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
            {[
              { label: "Full Name", key: "fullName", type: "text", required: true },
              { label: "Email", key: "email", type: "email", required: true },
              { label: "ID Number", key: "idNumber", type: "text", required: true },
              { label: "Batch", key: "batch", type: "text", required: true },
              { label: "Phone", key: "phone", type: "tel", required: false },
              { label: "CNIC", key: "cnic", type: "text", required: false },
            ].map(({ label, key, type, required }) => (
              <div key={key}>
                <label className="block text-xs text-muted-foreground mb-1">{label}{required && " *"}</label>
                <input
                  type={type}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  required={required}
                  className="w-full px-3 py-2 rounded-md bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ))}
            <div className="col-span-2 flex gap-3 mt-1">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating..." : "Create Student"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : !students || students.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No students found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["ID Number", "Name", "Email", "Batch", "Status", "Enrolled", "Invoice", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <>
                    <tr
                      key={s.id}
                      className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-primary">{s.idNumber}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{s.fullName}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{s.email}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{s.batch}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${
                          s.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-muted text-muted-foreground border-border"
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(s.enrollmentDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <InvoiceButton studentId={s.id} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {selectedId === s.id ? "▲" : "▼"}
                      </td>
                    </tr>
                    {selectedId === s.id && (
                      <tr key={`${s.id}-prog`} className="border-b border-border bg-muted/10">
                        <td colSpan={8} className="px-4 py-2">
                          <ProgressPanel studentId={s.id} idCardUrl={s.idCardUrl} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
