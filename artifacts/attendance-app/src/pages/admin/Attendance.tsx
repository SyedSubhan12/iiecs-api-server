import React, { useState, useMemo } from "react";
import {
  useListAttendance,
  useUpdateAttendance,
  useListStudents,
  useUpdateStudent,
  useGetStudentProgress,
  getListAttendanceQueryKey,
  getGetStudentProgressQueryKey,
  getListStudentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";

const API_BASE = "/api";

const STATUS_CONFIG = {
  present:  { label: "Present",  cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40", btnCls: "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500" },
  late:     { label: "Late",     cls: "bg-amber-500/20  text-amber-400  border-amber-500/40",    btnCls: "bg-amber-600  hover:bg-amber-500  text-white border-amber-500"  },
  absent:   { label: "Absent",   cls: "bg-red-500/20    text-red-400    border-red-500/40",      btnCls: "bg-red-700    hover:bg-red-600    text-white border-red-600"    },
  excused:  { label: "Excused",  cls: "bg-blue-500/20   text-blue-400   border-blue-500/40",     btnCls: "bg-blue-600   hover:bg-blue-500   text-white border-blue-500"   },
} as const;
type Status = keyof typeof STATUS_CONFIG;

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as Status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cfg?.cls ?? "bg-muted text-muted-foreground border-border"}`}>
      {cfg?.label ?? status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─── Student Profile Update Panel ──────────────────────────────────────────────
function StudentProfileUpdatePanel({ student }: { student: any }) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(student.fullName);
  const [phone, setPhone] = useState(student.phone ?? "");
  const [cnic, setCnic] = useState(student.cnic ?? "");
  const [address, setAddress] = useState(student.address ?? "");
  const [status, setStatus] = useState(student.status);
  
  const queryClient = useQueryClient();
  const updateMutation = useUpdateStudent({
    mutation: {
      onSuccess: () => {
        setEditing(false);
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStudentProgressQueryKey(student.id) });
      }
    }
  });

  const { data: progress, isLoading: progressLoading } = useGetStudentProgress(student.id, {
    query: { queryKey: getGetStudentProgressQueryKey(student.id) }
  });

  const handleSave = () => {
    updateMutation.mutate({
      id: student.id,
      data: {
        fullName,
        phone: phone || null,
        cnic: cnic || null,
        address: address || null,
        status,
      }
    });
  };

  return (
    <div className="p-4 bg-background/50 rounded-lg border border-border/80 text-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
        <div>
          <h4 className="text-base font-bold text-foreground">Student Profile Details</h4>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{student.idNumber} &bull; {student.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-md border border-primary/45 text-primary bg-primary/10 hover:bg-primary/20 transition-all cursor-pointer"
            >
              ✏️ Edit Profile
            </button>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50 cursor-pointer"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setFullName(student.fullName);
                  setPhone(student.phone ?? "");
                  setCnic(student.cnic ?? "");
                  setAddress(student.address ?? "");
                  setStatus(student.status);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Side: Editable Profile Form */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground uppercase mb-1">Full Name</label>
              {editing ? (
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-2 py-1 bg-card border border-input rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              ) : (
                <div className="font-semibold text-foreground">{student.fullName}</div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground uppercase mb-1">Status</label>
              {editing ? (
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-2 py-1 bg-card border border-input rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="suspended">suspended</option>
                </select>
              ) : (
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border uppercase ${
                  student.status === "active"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                    : "bg-muted text-muted-foreground border-border"
                }`}>
                  {student.status}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground uppercase mb-1">Phone</label>
              {editing ? (
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-2 py-1 bg-card border border-input rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              ) : (
                <div className="text-foreground">{student.phone || <span className="text-muted-foreground italic text-xs">Not set</span>}</div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground uppercase mb-1">CNIC</label>
              {editing ? (
                <input
                  type="text"
                  value={cnic}
                  onChange={(e) => setCnic(e.target.value)}
                  className="w-full px-2 py-1 bg-card border border-input rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              ) : (
                <div className="text-foreground font-mono">{student.cnic || <span className="text-muted-foreground italic text-xs">Not set</span>}</div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-muted-foreground uppercase mb-1">Address</label>
            {editing ? (
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-2 py-1 bg-card border border-input rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            ) : (
              <div className="text-foreground text-xs">{student.address || <span className="text-muted-foreground italic text-xs">Not set</span>}</div>
            )}
          </div>
        </div>

        {/* Right Side: Attendance Stats & Progress */}
        <div className="bg-card/40 border border-border/40 rounded-lg p-3 space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Academic Progress</div>
          {progressLoading ? (
            <div className="text-xs text-muted-foreground animate-pulse">Loading stats...</div>
          ) : progress ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Attendance Rate</div>
                <div className="text-xl font-bold text-primary">{progress.overallAttendancePercentage}%</div>
                <div className="w-full bg-muted rounded-full h-1.5 mt-1 overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${progress.overallAttendancePercentage}%` }} />
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Days Present</div>
                <div className="text-base font-semibold text-foreground mt-0.5">
                  {progress.daysPresent} / {progress.totalAttendanceRecords}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Total Fees Paid</div>
                <div className="text-sm font-semibold text-emerald-400">PKR {progress.totalPaid.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Pending Balance</div>
                <div className="text-sm font-semibold text-amber-400">PKR {progress.totalPending.toLocaleString()}</div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic">No progress data found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Manual Mark Panel ────────────────────────────────────────────────────────
function ManualAttendancePanel() {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved]   = useState<Record<string, Status>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: students, isLoading: studentsLoading } = useListStudents();
  const { data: dayRecords, isLoading: dayLoading } = useListAttendance(
    { date },
    { query: { queryKey: getListAttendanceQueryKey({ date }), refetchOnWindowFocus: true } },
  );

  // Build a map studentId → existing status for this date
  const existingMap = useMemo(() => {
    const m: Record<string, { id: string; status: Status }> = {};
    dayRecords?.forEach((r) => { m[r.studentId] = { id: r.id, status: r.status as Status }; });
    return m;
  }, [dayRecords]);

  async function markOne(studentId: string, status: Status) {
    setSaving((s) => ({ ...s, [studentId]: true }));
    setErrors((e) => ({ ...e, [studentId]: "" }));
    try {
      await fetch(`${API_BASE}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, status, attendanceDate: date }),
      });
      setSaved((s) => ({ ...s, [studentId]: status }));
      // Invalidate so list + student progress refresh
      queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey({ date }) });
      queryClient.invalidateQueries({ queryKey: getGetStudentProgressQueryKey(studentId) });
    } catch {
      setErrors((e) => ({ ...e, [studentId]: "Failed" }));
    } finally {
      setSaving((s) => ({ ...s, [studentId]: false }));
    }
  }

  async function markAll(status: Status) {
    if (!students?.length) return;
    setBulkSaving(true);
    await Promise.allSettled(
      students.map((s) => markOne(s.id, status)),
    );
    setBulkSaving(false);
  }

  const isLoading = studentsLoading || dayLoading;

  return (
    <div>
      {/* Date picker + bulk actions */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Select Date</label>
          <input
            type="date"
            value={date}
            max={new Date().toISOString().split("T")[0]}
            onChange={(e) => { setDate(e.target.value); setSaved({}); setErrors({}); }}
            className="px-3 py-2 rounded-md bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Bulk mark all:</span>
          {(["present", "absent"] as Status[]).map((s) => (
            <button
              key={s}
              disabled={bulkSaving || isLoading}
              onClick={() => markAll(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded border transition-all disabled:opacity-50 ${STATUS_CONFIG[s].btnCls}`}
            >
              {bulkSaving ? "…" : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      {!isLoading && dayRecords && students && (
        <div className="grid grid-cols-4 gap-3 mb-5">
          {(["present", "late", "absent", "excused"] as Status[]).map((st) => {
            const count = dayRecords.filter((r) => r.status === st).length;
            return (
              <div key={st} className={`rounded-lg px-4 py-3 border text-center ${STATUS_CONFIG[st].cls}`}>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs mt-0.5 opacity-80">{STATUS_CONFIG[st].label}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Student roster */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Loading...</div>
        ) : !students || students.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">No students found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["#", "Student", "ID Number", "Batch", "Current Status", "Mark As", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                 {students.map((s, i) => {
                  const existing = existingMap[s.id];
                  // saved[] wins over existing for live feedback
                  const currentStatus: Status | null = saved[s.id] ?? existing?.status ?? null;
                  const isSaving = saving[s.id];

                  return (
                    <React.Fragment key={s.id}>
                      <tr className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground text-xs font-mono w-10">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                          {s.fullName}
                          {saved[s.id] && (
                            <span className="ml-2 text-xs text-emerald-400 font-semibold animate-fade-in">✓ saved</span>
                          )}
                          {errors[s.id] && (
                            <span className="ml-2 text-xs text-red-400">{errors[s.id]}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{s.idNumber}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{s.batch}</td>
                        <td className="px-4 py-3">
                          {currentStatus ? (
                            <StatusBadge status={currentStatus} />
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Not marked</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(Object.keys(STATUS_CONFIG) as Status[]).map((st) => (
                              <button
                                key={st}
                                disabled={isSaving || currentStatus === st}
                                onClick={() => markOne(s.id, st)}
                                className={`px-2.5 py-1 text-xs font-semibold rounded border transition-all whitespace-nowrap cursor-pointer
                                  ${currentStatus === st
                                    ? `${STATUS_CONFIG[st].btnCls} opacity-60 cursor-default`
                                    : `bg-transparent border-border text-muted-foreground hover:border-current ${
                                        st === "present" ? "hover:text-emerald-400 hover:border-emerald-500/60"
                                        : st === "late"   ? "hover:text-amber-400 hover:border-amber-500/60"
                                        : st === "absent" ? "hover:text-red-400 hover:border-red-500/60"
                                        :                   "hover:text-blue-400 hover:border-blue-500/60"
                                      }`
                                  } disabled:opacity-40`}
                              >
                                {isSaving ? "…" : STATUS_CONFIG[st].label}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedStudentId(expandedStudentId === s.id ? null : s.id);
                            }}
                            className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                          >
                            {expandedStudentId === s.id ? "Close Profile ▲" : "View/Edit Profile ▼"}
                          </button>
                        </td>
                      </tr>
                      {expandedStudentId === s.id && (
                        <tr className="border-b border-border bg-muted/5">
                          <td colSpan={7} className="px-4 py-3">
                            <StudentProfileUpdatePanel student={s} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Records / History Panel ──────────────────────────────────────────────────
function AttendanceRecordsPanel() {
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
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey({ month }) });
        queryClient.invalidateQueries({ queryKey: getGetStudentProgressQueryKey(data.studentId) });
        setEditId(null);
      },
    },
  });

  return (
    <div>
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
        <div className="text-sm text-muted-foreground">{records?.length ?? 0} records</div>
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
                          {(Object.keys(STATUS_CONFIG) as Status[]).map((s) => (
                            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
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
                            onClick={() => updateMutation.mutate({ id: r.id, data: { status: editStatus } })}
                            disabled={updateMutation.isPending}
                            className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:opacity-90 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button onClick={() => setEditId(null)} className="text-xs text-muted-foreground hover:text-foreground">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditId(r.id); setEditStatus(r.status); }}
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
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const [tab, setTab] = useState<"mark" | "records">("mark");

  return (
    <AdminLayout title="Attendance">
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {([
          { key: "mark",    label: "✏️  Mark Attendance" },
          { key: "records", label: "📋 Records / History" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              tab === key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "mark"    && <ManualAttendancePanel />}
      {tab === "records" && <AttendanceRecordsPanel />}
    </AdminLayout>
  );
}
