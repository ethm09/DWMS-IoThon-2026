import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAction } from "convex/react";
import { Authenticated } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Brain, X, Send, Sparkles } from "lucide-react";
import { useProcessMode } from "@/hooks/use-process-mode.ts";
import { riskLabel } from "@/lib/dwms-safety.ts";
import { cn } from "@/lib/utils.ts";

type Msg = { role: "user" | "assistant"; content: string };

const WELCOME =
  "Hello, I'm Ethm AI, your intelligent safety and control assistant for DWMS. I monitor water quality, system behavior, and operational risks in real time.";

const SUGGESTED = [
  "What is DWMS?",
  "Is the water quality safe?",
  "Why did the pump start?",
  "What should I fix?",
  "Explain the latest sensor reading.",
  "Why did shutdown happen?",
];

function EthmAssistantInner() {
  const {
    assistantOpen, setAssistantOpen,
    readings, mode, pumpStatus, manualOverride, emergencyShutdown,
    dataMode, hardwareStatus, decision, quality,
  } = useProcessMode();

  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: WELCOME }]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const chat = useAction(api.chatAction.chat);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const buildContext = useCallback(() => {
    return [
      `System mode: ${mode.toUpperCase()}`,
      `Pump: ${emergencyShutdown ? "LOCKED" : pumpStatus ? "ON" : "OFF"}`,
      `Manual override: ${manualOverride ? "ACTIVE" : "INACTIVE"}`,
      `Emergency shutdown: ${emergencyShutdown ? "ACTIVE" : "INACTIVE"}`,
      `Data source: ${dataMode === "demo" ? "Demo Data" : "Real Hardware"} (${hardwareStatus})`,
      `pH: ${readings.ph ?? "—"}`,
      `TDS: ${readings.tds ?? "—"} ppm`,
      `Turbidity: ${readings.turbidity ?? "—"} NTU`,
      `Flow rate: ${readings.flowRate ?? "—"} L/min`,
      `Water quality: ${quality.toUpperCase()}`,
      `Latest assessment: ${decision.reason} Recommendation: ${decision.recommendation}`,
    ].join("\n");
  }, [mode, pumpStatus, manualOverride, emergencyShutdown, dataMode, hardwareStatus, readings, quality, decision]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending) return;
      const next: Msg[] = [...messages, { role: "user", content: trimmed }];
      setMessages(next);
      setInput("");
      setPending(true);
      try {
        const res = await chat({
          messages: next.filter((m) => m.content !== WELCOME),
          context: buildContext(),
        });
        setMessages((prev) => [...prev, { role: "assistant", content: res.text }]);
      } catch {
        setMessages((prev) => [...prev, { role: "assistant", content: "Ethm AI is temporarily offline. Please try again." }]);
      } finally {
        setPending(false);
      }
    },
    [messages, pending, chat, buildContext]
  );

  return (
    <>
      {/* Floating "Ask Ethm AI" button */}
      <AnimatePresence>
        {!assistantOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setAssistantOpen(true)}
            className="fixed bottom-4 right-4 z-[9990] flex items-center gap-2 px-4 py-3 rounded-full cursor-pointer shadow-lg font-bold tracking-wider text-xs"
            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "white", boxShadow: "0 0 24px #22c55e66" }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
          >
            <Brain className="w-4 h-4" />
            Ask Ethm AI
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {assistantOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="fixed bottom-4 right-4 z-[9991] w-[calc(100vw-2rem)] sm:w-96 flex flex-col rounded-2xl border overflow-hidden"
            style={{ height: "min(600px, 80vh)", background: "oklch(0.11 0.018 145)", borderColor: "#22c55e55", boxShadow: "0 0 40px #22c55e22" }}
          >
            {/* Header */}
            <div className="px-4 py-3 flex items-center gap-3 border-b shrink-0" style={{ borderColor: "#22c55e33", background: "oklch(0.13 0.02 145)" }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 border" style={{ borderColor: "#22c55e", background: "#22c55e18" }}>
                <Brain className="w-4 h-4" style={{ color: "#22c55e" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm tracking-wide" style={{ color: "#22c55e" }}>Ethm AI</div>
                <div className="text-[10px] text-muted-foreground truncate">Intelligent Safety & Control Assistant</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                <span className="text-[9px] font-bold tracking-widest text-green-400">ONLINE</span>
              </div>
              <button onClick={() => setAssistantOpen(false)} className="p-1 rounded hover:bg-white/10 cursor-pointer text-muted-foreground hover:text-foreground ml-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn("rounded-2xl px-3 py-2 text-xs leading-relaxed max-w-[85%] whitespace-pre-wrap", m.role === "user" ? "rounded-br-sm" : "rounded-bl-sm")}
                    style={m.role === "user"
                      ? { background: "#22c55e", color: "white" }
                      : { background: "oklch(0.16 0.02 145)", color: "oklch(0.9 0.02 145)", border: "1px solid oklch(0.24 0.03 145)" }}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {pending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1" style={{ background: "oklch(0.16 0.02 145)", border: "1px solid oklch(0.24 0.03 145)" }}>
                    {[0, 1, 2].map((i) => (
                      <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-400" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested questions (only before any user message) */}
              {messages.length === 1 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[9px] font-bold tracking-widest text-muted-foreground flex items-center gap-1 px-1">
                    <Sparkles className="w-3 h-3" /> SUGGESTED
                  </div>
                  {SUGGESTED.map((q) => (
                    <button key={q} onClick={() => void send(q)}
                      className="w-full text-left text-xs px-3 py-2 rounded-xl cursor-pointer transition-colors hover:bg-white/5"
                      style={{ background: "oklch(0.14 0.018 145)", border: "1px solid oklch(0.22 0.03 145)", color: "oklch(0.8 0.02 145)" }}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Live risk strip */}
            <div className="px-3 py-1.5 border-t flex items-center gap-2 text-[9px] font-mono tracking-wider shrink-0" style={{ borderColor: "#22c55e22", background: "oklch(0.1 0.015 145)" }}>
              <span className="text-muted-foreground">RISK:</span>
              <span style={{ color: quality === "critical" ? "#ef4444" : quality === "warning" ? "#eab308" : "#22c55e" }}>
                {riskLabel(quality)}
              </span>
              <span className="text-muted-foreground ml-auto">MODE: {mode.toUpperCase()}</span>
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => { e.preventDefault(); void send(input); }}
              className="p-3 border-t flex items-center gap-2 shrink-0"
              style={{ borderColor: "#22c55e33" }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Ethm AI…"
                className="flex-1 bg-transparent border rounded-full px-3 py-2 text-xs outline-none focus:border-emerald-400 transition-colors"
                style={{ borderColor: "oklch(0.24 0.03 145)" }}
              />
              <button type="submit" disabled={!input.trim() || pending}
                className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                style={{ background: "#22c55e", color: "white" }}>
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function EthmAssistant() {
  // Chat requires auth (Convex action reads identity-independent but keep gated for consistency).
  return (
    <Authenticated>
      <EthmAssistantInner />
    </Authenticated>
  );
}
