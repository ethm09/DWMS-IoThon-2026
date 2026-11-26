import { useRef, useState, useEffect } from "react";
import { Authenticated, useAction, useMutation } from "convex/react";
import { Brain, Send, X } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { useProcessMode } from "@/hooks/use-process-mode";
import { Button } from "@/components/ui/button";

type Message = { role: "user" | "assistant"; content: string };
function Assistant() {
  const { assistantOpen, setAssistantOpen, selectedDeviceId } = useProcessMode();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("On demand");
  const createRun = useMutation(api.agent.createRun);
  const run = useAction(api.chatAction.run);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => { scroll.current?.scrollTo({ top: scroll.current.scrollHeight }); }, [messages, pending]);
  async function send(question: string) {
    if (!question.trim() || pending) return;
    const next: Message[] = [...messages, { role: "user", content: question.trim() }];
    setMessages(next); setInput(""); setPending(true); setStatus("Checking available data");
    try {
      const runId = await createRun({ objective: question.trim(), selectedDeviceId: selectedDeviceId || undefined });
      const result = await run({ runId, messages: next });
      setMessages(current => [...current, { role: "assistant", content: result.text }]);
      setStatus(/not configured|could not complete|failed/i.test(result.text) ? "Service unavailable" : "Response received");
    } catch {
      setStatus("Service unavailable");
      setMessages(current => [...current, { role: "assistant", content: "Ethm could not reach its data or model service. Current monitoring and deterministic response rules remain available." }]);
    } finally { setPending(false); }
  }
  if (!assistantOpen) return null;
  return <section role="dialog" aria-modal="true" aria-label="Ethm water intelligence assistant" className="fixed inset-x-3 bottom-20 z-50 flex max-h-[75vh] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[410px]">
    <header className="flex items-center gap-3 border-b border-border p-4"><Brain className="h-5 w-5 text-primary" /><div className="flex-1"><h2 className="font-semibold">Ethm · AI interpretation</h2><p className="text-xs text-muted-foreground" role="status">{status}</p></div><Button size="icon" variant="ghost" aria-label="Close assistant" onClick={() => setAssistantOpen(false)}><X /></Button></header>
    <div ref={scroll} className="min-h-40 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
      {!messages.length && <><p className="leading-relaxed text-muted-foreground">Explain available readings, configured rules or recorded events. Interpretations may be wrong; Ethm cannot issue equipment commands.</p><div className="space-y-2">{["Explain the latest readings.", "Summarize recent device events.", "Why did the configured response change?"].map(question => <button className="w-full rounded-lg border border-border p-3 text-left hover:bg-accent" key={question} onClick={() => void send(question)}>{question}</button>)}</div></>}
      {messages.map((message, index) => <div key={index} className={`rounded-xl p-3 leading-relaxed whitespace-pre-wrap ${message.role === "user" ? "ml-6 bg-primary text-white" : "mr-3 bg-muted text-foreground"}`}><span className="mb-1 block text-xs font-semibold opacity-70">{message.role === "user" ? "You" : "AI interpretation"}</span>{message.content}</div>)}
      {pending && <p className="text-muted-foreground">Reviewing available records…</p>}
    </div>
    <form className="flex gap-2 border-t border-border p-3" onSubmit={event => { event.preventDefault(); void send(input); }}><input aria-label="Question for Ethm" value={input} maxLength={1000} onChange={event => setInput(event.target.value)} disabled={pending} placeholder="Ask about readings or events" className="min-w-0 flex-1 rounded-lg border border-input px-3 py-2 text-sm" /><Button type="submit" size="icon" disabled={!input.trim() || pending} aria-label="Send question"><Send /></Button></form>
  </section>;
}
export default function EthmAssistant() { return <Authenticated><Assistant /></Authenticated>; }
