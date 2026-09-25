import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  FileText, Download, Table, BarChart3, Clock, CheckCircle, Loader2,
  Printer, Activity, Shield, Filter, AlertTriangle, Wrench, Brain,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useProcessMode, type DwmsEvent } from "@/hooks/use-process-mode.ts";
import { useUserRole } from "@/hooks/use-user-role.ts";
import { useAuth } from "@/hooks/use-auth.ts";
import {
  classifyTds, classifyTurbidity, classifyPh, classifyFlow,
  LEVEL_LABEL, type SafetyLevel,
} from "@/lib/dwms-safety.ts";

type Reading = { time: string; tds: number; turbidity: number; ph: number; status: string };

function getStatus(tds: number, turb: number, ph: number): string {
  if (tds > 600 || turb > 4 || ph < 5.5 || ph > 9.5) return "CRITICAL";
  if (tds > 300 || turb > 1 || ph < 6.5 || ph > 8.5) return "WARNING";
  return "NORMAL";
}

function generateSeedData(): Reading[] {
  const data: Reading[] = [];
  let tds = 250, turb = 1.0, ph = 7.0;
  const now = Date.now();
  for (let i = 29; i >= 0; i--) {
    tds = Math.max(50, Math.min(900, tds + (Math.random() - 0.5) * 40));
    turb = Math.max(0, Math.min(10, turb + (Math.random() - 0.5) * 0.6));
    ph = Math.max(4, Math.min(11, ph + (Math.random() - 0.5) * 0.2));
    const d = new Date(now - i * 5000);
    data.push({
      time: d.toLocaleTimeString(),
      tds: parseFloat(tds.toFixed(1)),
      turbidity: parseFloat(turb.toFixed(2)),
      ph: parseFloat(ph.toFixed(2)),
      status: getStatus(tds, turb, ph),
    });
  }
  return data;
}

function generateReportId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DWMS-${date}-${rand}`;
}

export default function Reports() {
  const [readings, setReadings] = useState<Reading[]>(generateSeedData);
  const [generating, setGenerating] = useState(false);
  const [exportType, setExportType] = useState<"pdf" | "csv">("pdf");

  const { readings: liveReadings, eventLog, quality, decision, filterStatus, pumpStatus, logEvent } = useProcessMode();
  const { user } = useAuth();
  const { role } = useUserRole();

  // Live updates
  useEffect(() => {
    const interval = setInterval(() => {
      setReadings((prev) => {
        const last = prev[prev.length - 1];
        const tds = Math.max(50, Math.min(900, last.tds + (Math.random() - 0.5) * 25));
        const turbidity = Math.max(0, Math.min(10, last.turbidity + (Math.random() - 0.5) * 0.4));
        const ph = Math.max(4, Math.min(11, last.ph + (Math.random() - 0.5) * 0.15));
        const time = new Date().toLocaleTimeString();
        return [...prev.slice(-29), { time, tds: parseFloat(tds.toFixed(1)), turbidity: parseFloat(turbidity.toFixed(2)), ph: parseFloat(ph.toFixed(2)), status: getStatus(tds, turbidity, ph) }];
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const avg = (key: keyof Reading) => {
    const vals = readings.map((r) => r[key] as number);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const exportCSV = () => {
    const header = "Time,TDS (ppm),Turbidity (NTU),pH,Status\n";
    const rows = readings.map((r) => `${r.time},${r.tds},${r.turbidity},${r.ph},${r.status}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `LDWMS_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV report downloaded");
  };

  const exportPDF = async () => {
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
        { label: "Water Quality", value: LEVEL_LABEL[quality], color: quality === "safe" ? GREEN : quality === "warning" ? YELLOW : RED },
        { label: "pH Level", value: `${(liveReadings.ph ?? 0).toFixed(2)}`, color: classifyPh(liveReadings.ph ?? 7) === "safe" ? GREEN : YELLOW },
        { label: "TDS", value: `${(liveReadings.tds ?? 0).toFixed(0)} ppm`, color: classifyTds(liveReadings.tds ?? 0) === "safe" ? GREEN : YELLOW },
        { label: "Turbidity", value: `${(liveReadings.turbidity ?? 0).toFixed(2)} NTU`, color: classifyTurbidity(liveReadings.turbidity ?? 0) === "safe" ? GREEN : YELLOW },
        { label: "Flow Rate", value: `${(liveReadings.flowRate ?? 0).toFixed(2)} L/min`, color: classifyFlow(liveReadings.flowRate ?? 0) === "safe" ? GREEN : YELLOW },
        { label: "Filter Active", value: filterStatus ? "YES" : "NO", color: filterStatus ? GREEN : MUTED },
        { label: "Pump Status", value: pumpStatus ? "ON" : "OFF", color: pumpStatus ? GREEN : MUTED },
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

      // AI Assessment
      y = addSectionHeader("ETHM AI ASSESSMENT", y);
      doc.setFontSize(8);
      doc.setTextColor(...WHITE);
      doc.text(`Risk Level: ${decision.riskLevel.toUpperCase()}`, margin + 3, y + 1);
      doc.setTextColor(...MUTED);
      doc.text(decision.reason, margin + 3, y + 7, { maxWidth: pageWidth - margin * 2 - 6 });
      doc.text(`Recommendation: ${decision.recommendation}`, margin + 3, y + 14, { maxWidth: pageWidth - margin * 2 - 6 });
      y += 24;

      // Summary stats
      y = addSectionHeader("REPORT SUMMARY STATISTICS", y);
      const summaryStats = [
        { label: "Avg TDS", value: `${avg("tds").toFixed(1)} ppm` },
        { label: "Avg Turbidity", value: `${avg("turbidity").toFixed(2)} NTU` },
        { label: "Avg pH", value: avg("ph").toFixed(2) },
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
          r.time,
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
          ["pH Level", "6.5", "8.5", "5.5", "10.0", "pH"],
          ["TDS", "—", "500", "—", "1500", "ppm"],
          ["Turbidity", "—", "5", "—", "50", "NTU"],
          ["Flow Rate", "0.5", "2.0", "—", "3.0", "L/min"],
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

      autoTable(doc, {
        startY: y,
        head: [["Sensor", "Status", "Last Calibrated", "Next Due", "Method"]],
        body: [
          ["pH Sensor", "CALIBRATED", "Buffer solutions pH 4/7/10", "30 days", "3-point buffer"],
          ["TDS Sensor", "DUE", "342 ppm NaCl standard", "30 days", "Single point NaCl"],
          ["Turbidity Sensor", "CALIBRATED", "Distilled water baseline", "30 days", "Zero-point baseline"],
          ["Flow Rate Sensor", "CALIBRATED", "Volumetric measurement", "30 days", "Known flow reference"],
        ],
        theme: "plain",
        styles: { fontSize: 8, cellPadding: 3, textColor: WHITE },
        headStyles: { fillColor: DARK_CARD, textColor: GREEN, fontStyle: "bold", fontSize: 7 },
        alternateRowStyles: { fillColor: [18, 28, 38] as [number, number, number] },
        bodyStyles: { fillColor: DARK_BG },
        didParseCell(data) {
          if (data.section === "body" && data.column.index === 1) {
            const status = data.cell.raw as string;
            if (status === "CALIBRATED") data.cell.styles.textColor = GREEN;
            else if (status === "DUE") data.cell.styles.textColor = YELLOW;
            else data.cell.styles.textColor = RED;
          }
        },
        margin: { left: margin, right: margin, bottom: 25 },
      });

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
            Comprehensive water quality reports with PDF export
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
            disabled={generating}
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
              { icon: Activity, label: "Live Readings", desc: "pH, TDS, turbidity, flow" },
              { icon: AlertTriangle, label: "Alerts History", desc: "Recent warnings & emergencies" },
              { icon: Brain, label: "AI Assessment", desc: "Ethm AI recommendations" },
              { icon: Filter, label: "Filter Status", desc: "Filtration history" },
              { icon: Wrench, label: "Calibration", desc: "Sensor calibration status" },
              { icon: Shield, label: "Thresholds", desc: "Current safety limits" },
              { icon: Table, label: "Data Table", desc: "All sensor readings" },
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
              Every page includes: Report ID, page numbers, printed by name, role, and timestamp
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Avg TDS", value: `${avg("tds").toFixed(1)} ppm`, color: "#22c55e" },
          { label: "Avg Turbidity", value: `${avg("turbidity").toFixed(2)} NTU`, color: "#eab308" },
          { label: "Avg pH", value: avg("ph").toFixed(2), color: "#22c55e" },
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
                      <td className="py-1.5 px-2 text-muted-foreground">{r.time}</td>
                      <td className="py-1.5 px-2" style={{ color: r.tds > 600 ? "#ef4444" : r.tds > 300 ? "#eab308" : "#22c55e" }}>{r.tds}</td>
                      <td className="py-1.5 px-2" style={{ color: r.turbidity > 4 ? "#ef4444" : r.turbidity > 1 ? "#eab308" : "#22c55e" }}>{r.turbidity}</td>
                      <td className="py-1.5 px-2" style={{ color: r.ph < 5.5 || r.ph > 9.5 ? "#ef4444" : r.ph < 6.5 || r.ph > 8.5 ? "#eab308" : "#22c55e" }}>{r.ph}</td>
                      <td className="py-1.5 px-2">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest" style={{ color: statusColor[r.status], background: `${statusColor[r.status]}20`, border: `1px solid ${statusColor[r.status]}44` }}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <Clock className="w-3 h-3" />
        <span>Table shows last 20 readings. Export includes all {readings.length} readings.</span>
        <CheckCircle className="w-3 h-3 text-green-500 ml-auto" />
        <span>Live data — updates every 2 seconds</span>
      </div>
    </div>
  );
}
