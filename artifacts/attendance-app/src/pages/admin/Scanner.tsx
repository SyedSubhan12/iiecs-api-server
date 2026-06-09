import { useEffect, useRef, useState } from "react";
import { useScanQrCode, useMarkAttendance, getGetTodayAttendanceQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";

interface ScanResult {
  student: {
    id: string;
    fullName: string;
    idNumber: string;
    batch: string;
    email: string;
  };
  alreadyMarkedToday: boolean;
  todayRecord?: { status: string; checkInTime: string } | null;
}

export default function ScannerPage() {
  const scannerRef = useRef<HTMLDivElement>(null);
  const scannerInstance = useRef<unknown>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const queryClient = useQueryClient();

  const scanMutation = useScanQrCode();
  const markMutation = useMarkAttendance({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
        setSuccessMsg("Attendance marked successfully!");
        setTimeout(() => {
          setSuccessMsg("");
          setScanResult(null);
          setIsScanning(false);
        }, 3000);
      },
    },
  });

  async function handleScan(qrData: string) {
    setScanError("");
    const cleaned = qrData.trim();
    console.debug("Scanned QR data:", cleaned);
    scanMutation.mutate(
      { data: { qrData: cleaned } },
      {
        onSuccess: (data) => {
          setScanResult(data as unknown as ScanResult);
          setIsScanning(false);
        },
        onError: (error: any) => {
          const msg = error?.response?.data?.error ?? "Student not found for this QR code.";
          setScanError(msg);
        },
      },
    );
  }

  async function startScanner() {
    setScanResult(null);
    setScanError("");
    setSuccessMsg("");
    setIsScanning(true);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      // Retrieve available cameras and pick the back/environment one if possible
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        throw new Error("No cameras found on this device.");
      }
      const cameraId = cameras.find((c) => c.label?.toLowerCase().includes("back"))?.id || cameras[0].id;

      if (scannerRef.current) {
        const qrScanner = new Html5Qrcode("qr-reader");
        scannerInstance.current = qrScanner;
        await qrScanner.start(
          cameraId,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            qrScanner.stop().catch(() => { });
            scannerInstance.current = null;
            setIsScanning(false);
            handleScan(decodedText);
          },
          (errorMessage) => {
            // Optional: log decoding errors silently
            console.debug("QR decode error:", errorMessage);
          },
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera not available. Use manual entry below.";
      setScanError(msg);
      setIsScanning(false);
    }
  }

  function stopScanner() {
    if (scannerInstance.current) {
      const s = scannerInstance.current as { stop: () => Promise<void>; isScanning?: () => boolean };
      try {
        s.stop().catch(() => { });
      } catch {
        // already stopped
      }
      scannerInstance.current = null;
    }
    setIsScanning(false);
  }


function handleMark(status: string) {
  if (!scanResult) return;
  markMutation.mutate({
    data: {
      studentId: scanResult.student.id,
      status,
    },
  });
}

function handleManualSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (manualInput.trim()) {
    handleScan(manualInput.trim());
    setManualInput("");
  }
}

useEffect(() => {
  return () => {
    stopScanner();
  };
}, []);

return (
  <AdminLayout title="QR Scanner">
    <div className="max-w-lg mx-auto">
      {/* Scanner Card */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Scan Student ID Card</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Point camera at student QR code to mark attendance</p>
        </div>

        <div className="p-5">
          {/* QR Reader container */}
          <div
            id="qr-reader"
            ref={scannerRef}
            className={`rounded-lg overflow-hidden bg-background border border-border ${isScanning ? "block" : "hidden"}`}
            style={{ width: "100%", minHeight: 280 }}
          />

          {!isScanning && !scanResult && !successMsg && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-border flex items-center justify-center">
                <svg className="w-10 h-10 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0z" />
                </svg>
              </div>
              <button
                onClick={startScanner}
                className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity text-sm"
              >
                Start Camera Scanner
              </button>
            </div>
          )}

          {isScanning && (
            <div className="mt-3 flex justify-center">
              <button
                onClick={stopScanner}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-md"
              >
                Stop Scanner
              </button>
            </div>
          )}

          {/* Success */}
          {successMsg && (
            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm text-emerald-400 font-medium">{successMsg}</span>
            </div>
          )}

          {/* Scan result */}
          {scanResult && !successMsg && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border ${scanResult.alreadyMarkedToday ? "bg-amber-500/10 border-amber-500/20" : "bg-muted/40 border-border"}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-foreground">{scanResult.student.fullName}</div>
                    <div className="text-xs text-primary font-mono mt-0.5">{scanResult.student.idNumber}</div>
                  </div>
                  {scanResult.alreadyMarkedToday && (
                    <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-medium">
                      Already marked: {scanResult.todayRecord?.status}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Batch: <span className="text-foreground">{scanResult.student.batch}</span></div>
                  <div>Email: <span className="text-foreground">{scanResult.student.email}</span></div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleMark("present")}
                  disabled={markMutation.isPending}
                  className="flex-1 py-3 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 text-sm"
                >
                  {markMutation.isPending ? "Marking..." : "Mark Present"}
                </button>
                <button
                  onClick={() => handleMark("late")}
                  disabled={markMutation.isPending}
                  className="flex-1 py-3 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 text-sm"
                >
                  Mark Late
                </button>
              </div>

              <button
                onClick={() => { setScanResult(null); startScanner(); }}
                className="w-full py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors"
              >
                Scan Another
              </button>
            </div>
          )}

          {scanError && (
            <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              {scanError}
            </div>
          )}
        </div>
      </div>

      {/* Manual QR Input */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Manual QR Entry</h3>
        <p className="text-xs text-muted-foreground mb-3">Paste QR code data directly (for testing)</p>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder='{"id":"...","name":"...","idNumber":"..."}'
            className="flex-1 px-3 py-2 rounded-md bg-background border border-input text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:opacity-90"
          >
            Submit
          </button>
        </form>
      </div>
    </div>
  </AdminLayout>
);
}
