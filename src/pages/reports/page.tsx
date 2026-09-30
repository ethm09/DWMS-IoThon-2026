import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { motion } from "motion/react";
import {
  FileText, Download, Table, BarChart3, Clock, Loader2,
  Printer, Activity, Shield, Filter, AlertTriangle, Wrench,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useProcessMode } from "@/hooks/use-process-mode.ts";
import { useUserRole } from "@/hooks/use-user-role.ts";
import { useAuth } from "@/hooks/use-auth.ts";
import {
  classifyTds, classifyTurbidity, classifyPh, THRESHOLDS,
} from "@/lib/dwms-safety.ts";

type Reading = { timestamp: string; tds: number; turbidity: number; ph: number; status: string };

function getStatus(tds: number, turb: number, ph: number): string {
  const levels = [classifyTds(tds), classifyTurbidity(turb), classifyPh(ph)];
  if (levels.includes("critical")) return "CRITICAL";
  if (levels.includes("warning")) return "WARNING";
  return "NORMAL";
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString();
}

function generateReportId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DWMS-${date}-${rand}`;
}

export default function Reports() {
  const [generating, setGenerating] = useState(false);
  const [exportType, setExportType] = useState<"pdf" | "csv">("pdf");

  const {
    readings: localReadings,
    dataMode,
    selectedDeviceId,
    lastUpdated,
    eventLog,
    logEvent,
  } = useProcessMode();
  const hardwareReadings = useQuery(
    api.devices.getRecentReadings,
    dataMode === "hardware" && selectedDeviceId
      ? { deviceId: selectedDeviceId, limit: 100 }
      : "skip",
  );
  const { user } = useAuth();
  const { role } = useUserRole();

  const isLoadingHardwareReadings =
    dataMode === "hardware" && Boolean(selectedDeviceId) && hardwareReadings === undefined;
  const demoTimestamp = Date.parse(lastUpdated) > 0 ? lastUpdated : new Date().toISOString();
  const readings: Reading[] = dataMode === "hardware"
    ? (hardwareReadings ?? []).slice().reverse().map((reading) => ({
        timestamp: reading.timestamp,
        tds: reading.tds,
        turbidity: reading.turbidity,
        ph: reading.ph,
        status: getStatus(reading.tds, reading.turbidity, reading.ph),
      }))
    : localReadings.tds !== null && localReadings.turbidity !== null && localReadings.ph !== null
      ? [{
          timestamp: demoTimestamp,
          tds: localReadings.tds,
          turbidity: localReadings.turbidity,
          ph: localReadings.ph,
          status: getStatus(localReadings.tds, localReadings.turbidity, localReadings.ph),
        }]
      : [];
  const currentReading = readings.at(-1) ?? null;
  const reportSource = dataMode === "hardware"
    ? selectedDeviceId ? `Hardware device ${selectedDeviceId}` : "Hardware mode — no device selected"
    : "Demo simulation — one local snapshot";

  const avg = (key: "tds" | "turbidity" | "ph") => {
    if (readings.length === 0) return null;
    return readings.reduce((sum, reading) => sum + reading[key], 0) / readings.length;
  };
  const formatAverage = (key: "tds" | "turbidity" | "ph", decimals: number, unit = "") => {
    const value = avg(key);
    return value === null ? "—" : `${value.toFixed(decimals)}${unit}`;
  };

  const exportCSV = () => {
    if (readings.length === 0 || isLoadingHardwareReadings) {
      toast.error("No readings are available to export");
      return;
    }
    const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const header = ["Timestamp", "TDS (ppm)", "Turbidity (NTU)", "pH", "Status"];
    const rows = readings.map((reading) => [
      reading.timestamp,
      reading.tds,
      reading.turbidity,
      reading.ph,
      reading.status,
    ]);
    const csv = [
      ["Source", reportSource].map(escapeCsv).join(","),
      `"Note","Prototype thresholds; readings are not a water-safety certification"`,
      "",
      header.map(escapeCsv).join(","),
      ...rows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `LDWMS_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV report downloaded");
  };

  const exportPDF = async () => {
    if (readings.length === 0 || isLoadingHardwareReadings) {
      toast.error("No readings are available to export");
      return;
    }
    setGenerating(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const reportId = generateReportId();
      const now = new Date();
      const printedBy = user?.profile.name ?? user?.profile.email ?? "Unknown User";
      const printedRole = role ?? "viewer";
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      let pageNum = 0;

      // Colors
      const GREEN: [number, number, number] = [34, 197, 94];
      const DARK_BG: [number, number, number] = [15, 23, 30];
      const DARK_CARD: [number, number, number] = [20, 30, 40];
      const MUTED: [number, number, number] = [100, 120, 140];
      const WHITE: [number, number, number] = [220, 230, 240];
      const RED: [number, number, number] = [239, 68, 68];
      const YELLOW: [number, number, number] = [234, 179, 8];

      // Helper: add footer to every page
      const addFooter = () => {
        pageNum++;
        doc.setFillColor(...DARK_BG);
        doc.rect(0, pageHeight - 18, pageWidth, 18, "F");
        doc.setDrawColor(...GREEN);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);

        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.setFont("helvetica", "normal");
        doc.text(`Printed by: ${printedBy}`, margin, pageHeight - 12);
        doc.text(`Role: ${printedRole.toUpperCase()}`, margin, pageHeight - 8);
        doc.text(`Printed on: ${now.toLocaleString()}`, margin, pageHeight - 4);

        doc.text(`Report ID: ${reportId}`, pageWidth - margin, pageHeight - 12, { align: "right" });
        doc.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - 8, { align: "right" });
        doc.text("LDWMS — CONFIDENTIAL", pageWidth - margin, pageHeight - 4, { align: "right" });
      };

      // Helper: add page background
      const addBackground = () => {
        doc.setFillColor(...DARK_BG);
        doc.rect(0, 0, pageWidth, pageHeight, "F");
      };

      // Helper: add section header
      const addSectionHeader = (title: string, y: number): number => {
        doc.setFillColor(...DARK_CARD);
        doc.roundedRect(margin, y, pageWidth - margin * 2, 8, 1, 1, "F");
        doc.setTextColor(...GREEN);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(title, margin + 3, y + 5.5);
        return y + 12;
      };

      // ═══════════════════════════════════════════════════════════════════════
      // PAGE 1: Cover & Summary
      // ═══════════════════════════════════════════════════════════════════════
      addBackground();

      // Header block
      doc.setFillColor(20, 35, 45);
      doc.roundedRect(margin, 15, pageWidth - margin * 2, 35, 2, 2, "F");
      doc.setDrawColor(...GREEN);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, 15, pageWidth - margin * 2, 35, 2, 2, "S");

      doc.setTextColor(...GREEN);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("LDWMS", margin + 5, 28);
      doc.setFontSize(8);
      doc.setTextColor(...WHITE);
      doc.text("DEFENSE WATER MONITORING SYSTEM", margin + 5, 34);
      doc.setTextColor(...MUTED);
      doc.setFontSize(7);
      doc.text("Smart Water Treatment Monitoring & Control", margin + 5, 40);
      doc.setFontSize(6);
      doc.text(`Source: ${reportSource}`, margin + 5, 46);

      doc.setTextColor(...GREEN);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("WATER QUALITY REPORT", pageWidth - margin - 5, 28, { align: "right" });
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(`Report ID: ${reportId}`, pageWidth - margin - 5, 35, { align: "right" });
      doc.text(`Generated: ${now.toLocaleString()}`, pageWidth - margin - 5, 41, { align: "right" });

      // Current system status
      let y = 60;
      y = addSectionHeader("CURRENT SYSTEM STATUS", y);

      const statusItems = [
        { label: "Latest quality", value: currentReading?.status ?? "NO DATA", color: currentReading?.status === "CRITICAL" ? RED : currentReading?.status === "WARNING" ? YELLOW : GREEN },
        { label: "pH Level", value: currentReading ? currentReading.ph.toFixed(2) : "—", color: currentReading ? (classifyPh(currentReading.ph) === "safe" ? GREEN : classifyPh(currentReading.ph) === "warning" ? YELLOW : RED) : MUTED },
        { label: "TDS", value: currentReading ? `${currentReading.tds.toFixed(0)} ppm` : "—", color: currentReading ? (classifyTds(currentReading.tds) === "safe" ? GREEN : classifyTds(currentReading.tds) === "warning" ? YELLOW : RED) : MUTED },
        { label: "Turbidity", value: currentReading ? `${currentReading.turbidity.toFixed(2)} NTU` : "—", color: currentReading ? (classifyTurbidity(currentReading.turbidity) === "safe" ? GREEN : classifyTurbidity(currentReading.turbidity) === "warning" ? YELLOW : RED) : MUTED },
        { label: "Data source", value: dataMode === "hardware" ? "HARDWARE" : "DEMO", color: dataMode === "hardware" ? GREEN : YELLOW },
        { label: "Device", value: selectedDeviceId ? selectedDeviceId.slice(0, 16) : "—", color: selectedDeviceId ? WHITE : MUTED },
      ];

      statusItems.forEach((item, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = margin + col * 60;
        const itemY = y + row * 14;
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.text(item.label.toUpperCase(), x, itemY);
        doc.setFontSize(10);
        doc.setTextColor(...item.color);
        doc.setFont("helvetica", "bold");
        doc.text(item.value, x, itemY + 5);
        doc.setFont("helvetica", "normal");
      });

      y += Math.ceil(statusItems.length / 3) * 14 + 8;

      // Rule assessment: this is the shared prototype threshold policy, not an AI prediction.
      y = addSectionHeader("PROTOTYPE THRESHOLD ASSESSMENT", y);
      doc.setFontSize(8);
      doc.setTextColor(...WHITE);
      doc.text(`Latest reading status: ${currentReading?.status ?? "NO DATA"}`, margin + 3, y + 1);
      doc.setTextColor(...MUTED);
      doc.text("Built-in prototype thresholds only. This report is not a validated water-safety certification.", margin + 3, y + 7, { maxWidth: pageWidth - margin * 2 - 6 });
      y += 16;

      // Summary stats
      y = addSectionHeader("REPORT SUMMARY STATISTICS", y);
      const summaryStats = [
        { label: "Avg TDS", value: formatAverage("tds", 1, " ppm") },
        { label: "Avg Turbidity", value: formatAverage("turbidity", 2, " NTU") },
        { label: "Avg pH", value: formatAverage("ph", 2) },
        { label: "Total Readings", value: `${readings.length}` },
        { label: "Critical Events", value: `${readings.filter((r) => r.status === "CRITICAL").length}` },
        { label: "Warning Events", value: `${readings.filter((r) => r.status === "WARNING").length}` },
      ];
      summaryStats.forEach((s, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = margin + col * 60;
        const itemY = y + row * 12;
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.text(s.label.toUpperCase(), x, itemY);
        doc.setFontSize(9);
        doc.setTextColor(...WHITE);
        doc.setFont("helvetica", "bold");
        doc.text(s.value, x, itemY + 5);
        doc.setFont("helvetica", "normal");
      });

      y += Math.ceil(summaryStats.length / 3) * 12 + 8;

      // Alerts summary
      y = addSectionHeader("RECENT ALERTS", y);
      const recentAlerts = eventLog
        .filter((e) => e.type.toLowerCase().includes("emergency") || e.type.toLowerCase().includes("warning") || e.type.toLowerCase().includes("alert"))
        .slice(0, 5);

      if (recentAlerts.length === 0) {
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text("No recent alerts recorded.", margin + 3, y + 1);
        y += 8;
      } else {
        recentAlerts.forEach((alert) => {
          doc.setFontSize(7);
          doc.setTextColor(...(alert.type.includes("Emergency") ? RED : YELLOW));
          doc.text(`[${new Date(alert.timestamp).toLocaleString()}] ${alert.type}`, margin + 3, y + 1);
          if (alert.decision) {
            doc.setTextColor(...MUTED);
            doc.text(alert.decision, margin + 6, y + 5, { maxWidth: pageWidth - margin * 2 - 10 });
            y += 4;
          }
          y += 6;
        });
      }

      addFooter();

      // ═══════════════════════════════════════════════════════════════════════
      // PAGE 2: Sensor Data Table
      // ═══════════════════════════════════════════════════════════════════════
      doc.addPage();
      addBackground();

      y = 15;
      y = addSectionHeader("SENSOR READINGS DATA TABLE", y);

      autoTable(doc, {
        startY: y,
        head: [["#", "Time", "TDS (ppm)", "Turbidity (NTU)", "pH", "Status"]],
        body: readings.map((r, i) => [
          String(i + 1),
          formatTimestamp(r.timestamp),
          String(r.tds),
          String(r.turbidity),
          String(r.ph),
          r.status,
        ]),
        theme: "plain",
        styles: {
          fontSize: 7,
          cellPadding: 2,
          textColor: WHITE,
        },
        headStyles: {
          fillColor: DARK_CARD,
          textColor: GREEN,
          fontStyle: "bold",
          fontSize: 7,
        },
        alternateRowStyles: {
          fillColor: [18, 28, 38] as [number, number, number],
        },
        bodyStyles: {
          fillColor: DARK_BG,
        },
        columnStyles: {
          5: {
            fontStyle: "bold",
          },
        },
        didParseCell(data) {
          if (data.section === "body" && data.column.index === 5) {
            const status = data.cell.raw as string;
            if (status === "CRITICAL") data.cell.styles.textColor = RED;
            else if (status === "WARNING") data.cell.styles.textColor = YELLOW;
            else data.cell.styles.textColor = GREEN;
          }
        },
        margin: { left: margin, right: margin, bottom: 25 },
      });

      addFooter();

      // ═══════════════════════════════════════════════════════════════════════
      // PAGE 3: Activity Log & Operator Actions
      // ═══════════════════════════════════════════════════════════════════════
      doc.addPage();
      addBackground();

      y = 15;
      y = addSectionHeader("OPERATOR ACTIVITY LOG", y);

      const recentEvents = eventLog.slice(0, 20);
      if (recentEvents.length === 0) {
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text("No operator actions recorded in this session.", margin + 3, y + 1);
      } else {
        autoTable(doc, {
          startY: y,
          head: [["Timestamp", "Event", "Parameter", "Details", "Mode"]],
          body: recentEvents.map((e) => [
            new Date(e.timestamp).toLocaleString(),
            e.type,
            e.parameter ?? "—",
            e.decision ?? e.action ?? "—",
            e.systemMode.toUpperCase(),
          ]),
          theme: "plain",
          styles: {
            fontSize: 7,
            cellPadding: 2,
            textColor: WHITE,
          },
          headStyles: {
            fillColor: DARK_CARD,
            textColor: GREEN,
            fontStyle: "bold",
            fontSize: 7,
          },
          alternateRowStyles: {
            fillColor: [18, 28, 38] as [number, number, number],
          },
          bodyStyles: {
            fillColor: DARK_BG,
          },
          columnStyles: {
            0: { cellWidth: 35 },
            3: { cellWidth: 55 },
          },
          margin: { left: margin, right: margin, bottom: 25 },
        });
      }

      addFooter();

      // ═══════════════════════════════════════════════════════════════════════
      // PAGE 4: Calibration & Thresholds
      // ═══════════════════════════════════════════════════════════════════════
      doc.addPage();
      addBackground();

      y = 15;
      y = addSectionHeader("THRESHOLD CONFIGURATION", y);

      autoTable(doc, {
        startY: y,
        head: [["Parameter", "Safe Min", "Safe Max", "Critical Low", "Critical High", "Unit"]],
        body: [
          ["pH", String(THRESHOLDS.ph.safe.min), String(THRESHOLDS.ph.safe.max), String(THRESHOLDS.ph.critical.below), String(THRESHOLDS.ph.critical.above), "pH"],
          ["TDS", "—", String(THRESHOLDS.tds.safe.max), "—", String(THRESHOLDS.tds.critical.above), "ppm"],
          ["Turbidity", "—", String(THRESHOLDS.turbidity.safe.max), "—", String(THRESHOLDS.turbidity.critical.above), "NTU"],
        ],
        theme: "plain",
        styles: { fontSize: 8, cellPadding: 3, textColor: WHITE },
        headStyles: { fillColor: DARK_CARD, textColor: GREEN, fontStyle: "bold", fontSize: 7 },
        alternateRowStyles: { fillColor: [18, 28, 38] as [number, number, number] },
        bodyStyles: { fillColor: DARK_BG },
        margin: { left: margin, right: margin, bottom: 25 },
      });

      const thresholdTableEnd = (doc as unknown as Record<string, { finalY: number }>).lastAutoTable.finalY + 10;

      y = addSectionHeader("CALIBRATION STATUS", thresholdTableEnd);
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text("Calibration records are not stored by the current application. No calibration date or status is available.", margin + 3, y + 1, { maxWidth: pageWidth - margin * 2 - 6 });

      addFooter();

      // Save PDF
      doc.save(`LDWMS_Report_${reportId}.pdf`);
      toast.success(`Report ${reportId} downloaded`);

      // Log the print event
      logEvent({
        type: "Report Exported",
        parameter: "PDF Report",
        newValue: reportId,
        decision: `Report generated by ${printedBy} (${printedRole})`,
        action: "PDF report downloaded",
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = () => {
    if (exportType === "csv") exportCSV();
    else exportPDF();
  };

  const criticals = readings.filter((r) => r.status === "CRITICAL").length;
  const warnings = readings.filter((r) => r.status === "WARNING").length;
  const normals = readings.filter((r) => r.status === "NORMAL").length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold tracking-widest text-primary uppercase">Report Generator</h2>
          </div>
          <p className="text-xs text-muted-foreground tracking-wider mt-0.5">
            Export the selected device history or one clearly labeled demo snapshot
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["pdf", "csv"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setExportType(t)}
                className="px-3 py-1.5 text-[10px] font-bold tracking-widest cursor-pointer transition-all"
                style={{
                  background: exportType === t ? "oklch(0.6 0.17 145)" : "transparent",
                  color: exportType === t ? "oklch(0.08 0.01 145)" : "oklch(0.55 0.04 145)",
                }}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <Button
            onClick={handleExport}
            disabled={generating || isLoadingHardwareReadings || readings.length === 0}
            className="font-bold tracking-widest cursor-pointer text-xs"
            style={{ background: "oklch(0.6 0.17 145)", color: "oklch(0.1 0.02 145)" }}
          >
            {generating
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> GENERATING...</>
              : <><Download className="w-3.5 h-3.5 mr-1.5" /> EXPORT {exportType.toUpperCase()}</>
            }
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[10px] text-muted-foreground">
        <span className="font-bold text-amber-400">{reportSource}</span>
        <span className="mx-2">·</span>
        Reports use the shared prototype thresholds. Calibration history, flow readings, and verified water-safety certification are not available here.
      </div>

      {/* Report contents preview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
            <Printer className="w-4 h-4" /> PDF REPORT INCLUDES
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Activity, label: "Saved Readings", desc: "pH, TDS, turbidity from selected source" },
              { icon: AlertTriangle, label: "Alerts History", desc: "Recent warnings & emergencies" },
              { icon: Shield, label: "Threshold Assessment", desc: "Shared prototype rule thresholds" },
              { icon: Wrench, label: "Calibration", desc: "Not recorded by the current app" },
              { icon: Filter, label: "Thresholds", desc: "Built-in software limits" },
              { icon: Table, label: "Data Table", desc: "Last 100 device readings or demo snapshot" },
              { icon: FileText, label: "Activity Log", desc: "Operator actions audit" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border/50 p-2.5 flex items-start gap-2">
                <item.icon className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] font-bold text-foreground">{item.label}</div>
                  <div className="text-[9px] text-muted-foreground">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg bg-muted/20 p-2.5 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-[10px] text-muted-foreground">
              PDF includes: report ID, page numbers, printed by name, role, timestamp, and source
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: dataMode === "demo" ? "Snapshot TDS" : "Avg TDS", value: formatAverage("tds", 1, " ppm"), color: "#22c55e" },
          { label: dataMode === "demo" ? "Snapshot Turbidity" : "Avg Turbidity", value: formatAverage("turbidity", 2, " NTU"), color: "#eab308" },
          { label: dataMode === "demo" ? "Snapshot pH" : "Avg pH", value: formatAverage("ph", 2), color: "#22c55e" },
          { label: "Total Readings", value: `${readings.length}`, color: "#a855f7" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <div className="text-[9px] font-bold tracking-widest text-muted-foreground">{s.label.toUpperCase()}</div>
              <div className="font-mono font-bold text-lg mt-0.5" style={{ color: s.color }}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Event distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> EVENT DISTRIBUTION
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "NORMAL", count: normals, color: "#22c55e" },
              { label: "WARNING", count: warnings, color: "#eab308" },
              { label: "CRITICAL", count: criticals, color: "#ef4444" },
            ].map((e) => {
              const pct = readings.length > 0 ? (e.count / readings.length) * 100 : 0;
              return (
                <div key={e.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold tracking-widest" style={{ color: e.color }}>{e.label}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{e.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-border overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      animate={{ width: `${pct}%`, backgroundColor: e.color }}
                      transition={{ duration: 0.6 }}
                    />
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">{pct.toFixed(0)}% of readings</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Data table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
            <Table className="w-4 h-4" /> DATA TABLE
            <span className="ml-auto text-[9px] font-mono text-muted-foreground">{readings.length} readings</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="border-b border-border">
                  {["#", "TIME", "TDS (ppm)", "TURBIDITY (NTU)", "pH", "STATUS"].map((h) => (
                    <th key={h} className="text-left py-2 px-2 text-[9px] font-bold tracking-widest text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {readings.slice(-20).reverse().map((r, i) => {
                  const statusColor: Record<string, string> = { NORMAL: "#22c55e", WARNING: "#eab308", CRITICAL: "#ef4444" };
                  return (
                    <tr key={i} className="border-b border-border/30 hover:bg-accent/20 transition-colors">
                      <td className="py-1.5 px-2 text-muted-foreground">{readings.length - i}</td>
                      <td className="py-1.5 px-2 text-muted-foreground">{formatTimestamp(r.timestamp)}</td>
                      <td className="py-1.5 px-2" style={{ color: classifyTds(r.tds) === "critical" ? "#ef4444" : classifyTds(r.tds) === "warning" ? "#eab308" : "#22c55e" }}>{r.tds}</td>
                      <td className="py-1.5 px-2" style={{ color: classifyTurbidity(r.turbidity) === "critical" ? "#ef4444" : classifyTurbidity(r.turbidity) === "warning" ? "#eab308" : "#22c55e" }}>{r.turbidity}</td>
                      <td className="py-1.5 px-2" style={{ color: classifyPh(r.ph) === "critical" ? "#ef4444" : classifyPh(r.ph) === "warning" ? "#eab308" : "#22c55e" }}>{r.ph}</td>
                      <td className="py-1.5 px-2">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest" style={{ color: statusColor[r.status], background: `${statusColor[r.status]}20`, border: `1px solid ${statusColor[r.status]}44` }}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {readings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      {isLoadingHardwareReadings
                        ? "Loading saved device readings…"
                        : dataMode === "hardware" && !selectedDeviceId
                          ? "Select a hardware device to load its saved readings."
                          : "No readings are available for this source yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <Clock className="w-3 h-3" />
        <span>{dataMode === "hardware" ? `Showing ${readings.length} of the last 100 saved readings; table displays up to 20.` : "Demo mode shows one simulated snapshot, not historical data."}</span>
        <span className="ml-auto">{isLoadingHardwareReadings ? "Loading device history…" : reportSource}</span>
      </div>
    </div>
  );
}
