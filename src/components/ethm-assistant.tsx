import { useRef, useState, useEffect } from "react";
import { Authenticated, useAction, useMutation, useQuery } from "convex/react";
import { Brain, Send, Trash2, X } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { useProcessMode } from "@/hooks/use-process-mode";
import { useUserRole } from "@/hooks/use-user-role";
import { Button } from "@/components/ui/button";

function Assistant() {
  const { assistantOpen, setAssistantOpen, selectedDeviceId } = useProcessMode();
  const messages = useQuery(api.chat.getMessages, assistantOpen ? {} : "skip");
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [clearError, setClearError] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [activeRunId, setActiveRunId] = useState<Id<"agentRuns"> | null>(null);
  const activeRun = useQuery(api.agent.getRun, activeRunId ? { runId: activeRunId } : "skip");
  const createRun = useMutation(api.agent.createRun);
  const clearHistory = useMutation(api.chat.clearHistory);
  const run = useAction(api.chatAction.run);
  const scroll = useRef<HTMLDivElement>(null);
  const questionInput = useRef<HTMLInputElement>(null);
  const status = connectionError ? "Connection interrupted" : pending ? "Reviewing available records" :
    activeRun?.status === "failed" ? "Service unavailable" : activeRun?.status === "blocked" ? "Assessment stopped" :
    activeRun?.status === "completed" ? "Response received" : "On demand";

  useEffect(() => { scroll.current?.scrollTo({ top: scroll.current.scrollHeight }); }, [messages, pending]);
  useEffect(() => {
    if (!assistantOpen) return;
    questionInput.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setAssistantOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [assistantOpen, setAssistantOpen]);

  async function send(question: string) {
    const objective = question.trim();
    if (!objective || objective.length > 1000 || pending || clearing || messages === undefined) return;
    setInput(""); setPending(true); setConnectionError(false);
    let created = false;
    try {
      const runId = await createRun({ objective, selectedDeviceId: selectedDeviceId || undefined });
      created = true; setActiveRunId(runId);
      // The backend loads this user's saved conversation and live context itself.
      await run({ runId, messages: [] });
    } catch {
      setConnectionError(true);
      if (!created) setInput(objective);
    } finally { setPending(false); }
  }

  async function clearChat() {
    if (pending || clearing || !messages?.length || !window.confirm("Clear your saved chat messages?")) return;
    setClearing(true); setClearError(false);
    try { await clearHistory({}); setActiveRunId(null); setConnectionError(false); }
    catch { setClearError(true); }
    finally { setClearing(false); }
  }

  if (!assistantOpen) return null;
  return <section role="dialog" aria-modal="false" aria-label="Ethm water intelligence assistant" className="fixed inset-x-3 bottom-20 z-50 flex max-h-[75vh] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[410px]">
    <header className="flex items-center gap-3 border-b border-border p-4"><Brain className="h-5 w-5 text-primary" /><div className="flex-1"><h2 className="font-semibold">Ethm · AI interpretation</h2><p className="text-xs text-muted-foreground" role="status">{status}</p></div><Button className="h-11 w-11" size="icon" variant="ghost" aria-label="Clear saved chat" disabled={pending || clearing || !messages?.length} onClick={() => void clearChat()}><Trash2 className="h-4 w-4" /></Button><Button className="h-11 w-11" size="icon" variant="ghost" aria-label="Close assistant" onClick={() => setAssistantOpen(false)}><X /></Button></header>
    <div ref={scroll} className="min-h-40 flex-1 space-y-4 overflow-y-auto p-4 text-sm" aria-busy={pending || clearing}>
      {messages === undefined ? <p role="status" className="text-muted-foreground">Loading your saved conversation…</p> : !messages.length && <><p className="leading-relaxed text-muted-foreground">Explain available readings, configured rules or recorded events. Interpretations may be wrong; Ethm cannot issue equipment commands.</p><div className="space-y-2">{["Explain the latest readings.", "Summarize recent device events.", "Why did the configured response change?"].map(question => <button className="min-h-11 w-full rounded-lg border border-border p-3 text-left hover:bg-accent" key={question} disabled={pending || clearing} onClick={() => void send(question)}>{question}</button>)}</div></>}
      {messages?.map(message => <div key={message._id} className={`rounded-xl p-3 leading-relaxed whitespace-pre-wrap ${message.role === "user" ? "ml-6 bg-primary text-white" : "mr-3 bg-muted text-foreground"}`}><span className="mb-1 block text-xs font-semibold opacity-70">{message.role === "user" ? "You" : message.kind === "service_status" ? "Service status" : message.kind === "interpretation" ? "AI interpretation" : "Ethm · saved message"}</span>{message.content}</div>)}
      {pending && <p role="status" className="text-muted-foreground">Reviewing available records…</p>}
      {connectionError && <p role="alert" className="text-muted-foreground">Ethm's connection was interrupted. Saved messages will update when connectivity returns. Monitoring and deterministic rules remain separate.</p>}
      {clearError && <p role="alert" className="text-muted-foreground">Chat could not be cleared. Try again when the connection returns.</p>}
    </div>
    <form className="flex gap-2 border-t border-border p-3" onSubmit={event => { event.preventDefault(); void send(input); }}><input ref={questionInput} aria-label="Question for Ethm" value={input} maxLength={1000} onChange={event => setInput(event.target.value)} disabled={pending || clearing || messages === undefined} placeholder="Ask about readings or events" className="min-h-11 min-w-0 flex-1 rounded-lg border border-input px-3 py-2 text-sm" /><Button className="h-11 w-11" type="submit" size="icon" disabled={!input.trim() || pending || clearing || messages === undefined} aria-label="Send question"><Send /></Button></form>
  </section>;
}
export default function EthmAssistant() {
  const { user, canViewFleet } = useUserRole();
  return user && canViewFleet ? <Authenticated><Assistant key={user._id} /></Authenticated> : null;
}
