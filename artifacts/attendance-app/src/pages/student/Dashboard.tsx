import { useAuth } from "@/contexts/AuthContext";
import {
  useGetStudentByEmail,
  useGetStudentProgress,
  useListAttendance,
  getGetStudentByEmailQueryKey,
  getGetStudentProgressQueryKey,
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

export default function StudentDashboard() {
  const { user } = useAuth();
  const email = user?.email ?? "";

  const { data: student } = useGetStudentByEmail(encodeURIComponent(email), {
    query: { enabled: !!email, queryKey: getGetStudentByEmailQueryKey(encodeURIComponent(email)) },
  });

  const { data: progress } = useGetStudentProgress(student?.id ?? "", {
    query: { enabled: !!student?.id, queryKey: getGetStudentProgressQueryKey(student?.id ?? "") },
  });

  const { data: recentAttendance } = useListAttendance(
    { studentId: student?.id },
    { query: { enabled: !!student?.id, queryKey: getListAttendanceQueryKey({ studentId: student?.id }) } },
  );

  const recent = recentAttendance?.slice(0, 7) ?? [];

  return (
    <StudentLayout title="My Dashboard">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-card-border rounded-xl p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0">
                <span className="text-primary text-xl font-bold">
                  {student?.fullName?.[0]?.toUpperCase() ?? "S"}
                </span>
              </div>
              <div>
                <div className="font-semibold text-foreground">{student?.fullName ?? "—"}</div>
                <div className="text-xs font-mono text-primary mt-0.5">{student?.idNumber ?? "—"}</div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {[
                ["Email", student?.email],
                ["Batch", student?.batch],
                ["Phone", student?.phone ?? "—"],
                ["Status", student?.status],
                ["Enrolled", student?.enrollmentDate ? new Date(student.enrollmentDate).toLocaleDateString() : "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-2">
                  <span className="text-muted-foreground text-xs shrink-0">{label}</span>
                  <span className="text-foreground text-xs text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats + Recent */}
        <div className="lg:col-span-2 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card border border-primary/30 rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Attendance</div>
              <div className="text-2xl font-bold text-primary">{progress?.overallAttendancePercentage ?? 0}%</div>
            </div>
            <div className="bg-card border border-card-border rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Days Present</div>
              <div className="text-2xl font-bold text-foreground">{progress?.daysPresent ?? 0}</div>
            </div>
            <div className="bg-card border border-card-border rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Total Paid</div>
              <div className="text-xl font-bold text-emerald-400">
                PKR {(progress?.totalPaid ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-card border border-card-border rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Pending</div>
              <div className="text-xl font-bold text-amber-400">
                PKR {(progress?.totalPending ?? 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Recent Attendance */}
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Recent Attendance</h3>
            </div>
            {recent.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No records yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground uppercase tracking-wide">Date</th>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground uppercase tracking-wide">Check In</th>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{r.attendanceDate}</td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">
                        {new Date(r.checkInTime).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
