import { useGetDashboardStats, useGetTodayAttendance } from "@workspace/api-client-react";
import { AdminLayout } from "@/components/AdminLayout";

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-5 ${accent ? "border-primary/40 bg-primary/5" : "border-card-border bg-card"}`}>
      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-3xl font-bold ${accent ? "text-primary" : "text-foreground"}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

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

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: todayList, isLoading: todayLoading } = useGetTodayAttendance();

  return (
    <AdminLayout title="Dashboard">
      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statsLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-card-border bg-card h-24 animate-pulse" />
          ))
        ) : (
          <>
            <StatCard label="Total Students" value={stats?.totalStudents ?? 0} />
            <StatCard
              label="Present Today"
              value={stats?.presentToday ?? 0}
              sub={`of ${(stats?.presentToday ?? 0) + (stats?.absentToday ?? 0)} marked`}
              accent
            />
            <StatCard label="Absent Today" value={stats?.absentToday ?? 0} />
            <StatCard
              label="Attendance Rate"
              value={`${stats?.attendanceRate ?? 0}%`}
              sub="Overall all-time"
              accent
            />
            <StatCard label="Pending Payments" value={stats?.pendingPayments ?? 0} />
            <StatCard label="Overdue Payments" value={stats?.overduePayments ?? 0} />
            <StatCard
              label="Total Collected"
              value={`PKR ${((stats?.totalPaidAmount ?? 0) / 1000).toFixed(0)}K`}
            />
            <StatCard
              label="Outstanding"
              value={`PKR ${((stats?.totalPendingAmount ?? 0) / 1000).toFixed(0)}K`}
            />
          </>
        )}
      </div>

      {/* Today's attendance */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Today's Attendance</h2>
          <span className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </span>
        </div>
        {todayLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : !todayList || todayList.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground text-sm">No attendance marked yet today.</p>
            <p className="text-xs text-muted-foreground mt-1 opacity-70">Use the QR Scanner to mark attendance.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Student</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">ID</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Check In</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {todayList.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors animate-in fade-in slide-in-from-bottom-1`}
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <td className="px-5 py-3 font-medium text-foreground">{r.studentName}</td>
                    <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{r.studentIdNumber}</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">
                      {new Date(r.checkInTime).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={r.status} />
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
