import { useState } from "react";
import { useListAttendance, useUpdateAttendance, getListAttendanceQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    present: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    late: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    absent: "bg-red-500/20 text-red-400 border-red-500/30",
    excused: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status] ?? "bg-muted text-muted-foreground border-border"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function AttendancePage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [editId, setEditId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const queryClient = useQueryClient();

  const { data: records, isLoading } = useListAttendance(
    { month },
    { query: { queryKey: getListAttendanceQueryKey({ month }) } },
  );

  const updateMutation = useUpdateAttendance({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey({ month }) });
        setEditId(null);
      },
    },
  });

  function startEdit(id: string, status: string) {
    setEditId(id);
    setEditStatus(status);
  }

  function saveEdit(id: string) {
    updateMutation.mutate({ id, data: { status: editStatus } });
  }

  return (
    <AdminLayout title="Attendance Records">
      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 rounded-md bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex-1" />
        <div className="text-sm text-muted-foreground">
          {records?.length ?? 0} records
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : !records || records.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No records found for this month.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Date", "Student", "ID Number", "Check In", "Check Out", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{r.attendanceDate}</td>
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{r.studentName}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{r.studentIdNumber}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(r.checkInTime).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {r.checkOutTime
                        ? new Date(r.checkOutTime).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {editId === r.id ? (
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          className="px-2 py-1 rounded bg-background border border-input text-xs text-foreground"
                        >
                          {["present", "absent", "late", "excused"].map((s) => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge status={r.status} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editId === r.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveEdit(r.id)}
                            disabled={updateMutation.isPending}
                            className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:opacity-90 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(r.id, r.status)}
                          className="text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          Edit
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
