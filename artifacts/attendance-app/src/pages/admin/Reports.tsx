import { useState } from "react";
import { useGetMonthlyAttendanceReport, useListPayments, getGetMonthlyAttendanceReportQueryKey } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { AdminLayout } from "@/components/AdminLayout";

export default function ReportsPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const { data: report, isLoading } = useGetMonthlyAttendanceReport(
    { month },
    { query: { queryKey: getGetMonthlyAttendanceReportQueryKey({ month }) } },
  );
  const { data: payments } = useListPayments();

  const chartData = report?.slice(0, 15).map((r) => ({
    name: r.fullName.split(" ")[0],
    percent: r.attendancePercentage,
    present: r.daysPresent,
    absent: r.daysAbsent,
  })) ?? [];

  const totalRevenue = payments?.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0) ?? 0;
  const totalPending = payments?.filter((p) => p.status !== "paid").reduce((s, p) => s + p.amount, 0) ?? 0;

  return (
    <AdminLayout title="Reports">
      <div className="flex items-center gap-3 mb-6">
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

      {/* Payment Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-card border border-card-border rounded-lg p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Total Collected</div>
          <div className="text-3xl font-bold text-emerald-400">PKR {totalRevenue.toLocaleString()}</div>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Outstanding Dues</div>
          <div className="text-3xl font-bold text-amber-400">PKR {totalPending.toLocaleString()}</div>
        </div>
      </div>

      {/* Attendance Chart */}
      <div className="bg-card border border-card-border rounded-lg p-5 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Attendance by Student — {month}</h3>
        {isLoading ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
        ) : chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data for this month.</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 60% 22%)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "hsl(214 30% 60%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(214 30% 60%)", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: "hsl(214 80% 16%)", border: "1px solid hsl(214 60% 25%)", borderRadius: 6, fontSize: 12 }}
                labelStyle={{ color: "hsl(45 100% 96%)" }}
                itemStyle={{ color: "hsl(42 100% 50%)" }}
              />
              <Bar dataKey="percent" name="Attendance %" fill="hsl(42 100% 50%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Attendance Table */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Monthly Attendance Summary</h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : !report || report.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No data for this month.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Student", "ID", "Present", "Absent", "Late", "Total", "Percentage"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.map((r) => (
                  <tr key={r.studentId} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium text-foreground">{r.fullName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-primary">{r.idNumber}</td>
                    <td className="px-4 py-3 text-emerald-400 font-semibold">{r.daysPresent}</td>
                    <td className="px-4 py-3 text-red-400 font-semibold">{r.daysAbsent}</td>
                    <td className="px-4 py-3 text-amber-400 font-semibold">{r.daysLate}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.totalDays}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${r.attendancePercentage >= 75 ? "text-emerald-400" : "text-red-400"}`}>
                        {r.attendancePercentage}%
                      </span>
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
