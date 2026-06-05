import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGetStudentByEmail,
  useListAttendance,
  getGetStudentByEmailQueryKey,
  getListAttendanceQueryKey,
} from "@workspace/api-client-react";
import { StudentLayout } from "@/components/StudentLayout";

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

export default function StudentAttendance() {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const { data: student } = useGetStudentByEmail(encodeURIComponent(user?.email ?? ""), {
    query: {
      enabled: !!user?.email,
      queryKey: getGetStudentByEmailQueryKey(encodeURIComponent(user?.email ?? "")),
    },
  });

  const { data: records, isLoading } = useListAttendance(
    { studentId: student?.id, month },
    {
      query: {
        enabled: !!student?.id,
        queryKey: getListAttendanceQueryKey({ studentId: student?.id, month }),
      },
    },
  );

  const present = records?.filter((r) => r.status === "present").length ?? 0;
  const late = records?.filter((r) => r.status === "late").length ?? 0;
  const absent = records?.filter((r) => r.status === "absent").length ?? 0;
  const total = records?.length ?? 0;
  const pct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  return (
    <StudentLayout title="My Attendance">
      {/* Month filter */}
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
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Present", value: present, color: "text-emerald-400" },
          { label: "Late", value: late, color: "text-amber-400" },
          { label: "Absent", value: absent, color: "text-red-400" },
          { label: "Rate", value: `${pct}%`, color: pct >= 75 ? "text-primary" : "text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-card-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : !records || records.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No records for this month.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Date", "Check In", "Check Out", "Status", "Remarks"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.attendanceDate}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(r.checkInTime).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.checkOutTime
                        ? new Date(r.checkOutTime).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.remarks ?? "—"}</td>
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
