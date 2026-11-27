import { useRef, useState, useEffect, useCallback, type ReactNode, type FormEvent } from "react";
import { Authenticated, useAction, useMutation, useQuery } from "convex/react";
import { useLocation } from "react-router-dom";
import { Brain, Send, X, Trash2, RefreshCw, ShieldCheck, Clock3 } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { useProcessMode } from "@/hooks/use-process-mode";
import { useUserRole } from "@/hooks/use-user-role";
import { useDemo } from "@/hooks/use-demo";
import { Button } from "@/components/ui/button";
import { readingFreshness } from "@/lib/monitoring";
import { demoIntelligenceContext, ethmDemoError, ethmSuggestedQuestions, safeEthmSourceUrl, ethmSourcesForContent, ethmDemoSessionInvalid, ethmDemoQuotaExceeded, ethmQuestionLanguage, type EthmLanguage, type EthmMessage } from "@/lib/ethm-conversation";
import { ETHM_OPEN_EVENT } from "@/lib/ethm-context";

const SESSION_KEY = "dwms.ethm.demo-session.v1";
function savedSession() { try { return sessionStorage.getItem(SESSION_KEY); } catch { return null; } }
function saveSession(token: string | null) { try { if (token) sessionStorage.setItem(SESSION_KEY, token); else sessionStorage.removeItem(SESSION_KEY); } catch { /* A memory-only session still works when browser storage is unavailable. */ } }
function timeLabel(value?: string) { const time = value ? Date.parse(value) : NaN; return Number.isFinite(time) ? new Date(time).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : null; }

function useConversationDraft(embedded: boolean) {
  const { assistantOpen, setAssistantOpen } = useProcessMode();
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState<EthmLanguage>("en");
  useEffect(() => {
    const open = (event: Event) => {
      const question = (event as CustomEvent<{ question?: unknown }>).detail?.question;
      if (typeof question === "string") setInput(question.slice(0, 1000));
      setAssistantOpen(true);
    };
    window.addEventListener(ETHM_OPEN_EVENT, open);
    return () => window.removeEventListener(ETHM_OPEN_EVENT, open);
  }, [setAssistantOpen]);
  const close = useCallback(() => setAssistantOpen(false), [setAssistantOpen]);
  return { input, setInput, language, setLanguage, open: embedded || assistantOpen, close };
}

type FrameProps = ReturnType<typeof useConversationDraft> & {
  embedded: boolean; demo: boolean; messages: EthmMessage[] | undefined;
  status: string; evidence: ReactNode; pending: boolean; clearing: boolean;
  maxLength: number; emergency: boolean; error?: string | null;
  quota?: number | null; onSend: (question: string) => Promise<void>;
  onClear: () => Promise<void>; onReconnect?: () => void;
  contextScenario?: string; currentContextAsOf?: string; unavailable?: boolean;
};
function ConversationFrame(props: FrameProps) {
  const { embedded, demo, messages, language, setLanguage, input, setInput, pending, clearing, open, close } = props;
  const scroll = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const blocked = pending || clearing || messages === undefined || props.quota === 0 || props.unavailable === true;
  useEffect(() => { scroll.current?.scrollTo({ top: scroll.current.scrollHeight }); }, [messages, pending]);
  useEffect(() => {
    if (!open) return;
    if (!embedded) field.current?.focus();
    const escape = (event: KeyboardEvent) => { if (!embedded && event.key === "Escape") close(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open, embedded, close]);
  if (!open) return null;
  const submit = (event: FormEvent) => { event.preventDefault(); if (!blocked) void props.onSend(input); };
  return <section role={embedded ? "region" : "dialog"} aria-modal={embedded ? undefined : "false"} aria-label="Ethm water intelligence assistant" className={embedded ? "flex min-h-[32rem] max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm" : "fixed inset-x-2 bottom-[76px] z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[480px]"}>
    <header className="flex items-center gap-3 border-b border-border bg-[#0B2039] px-4 py-3 text-white"><Brain className="h-6 w-6 shrink-0 text-cyan-300" /><div className="min-w-0 flex-1"><h2 className="font-semibold">Ethm <span className="font-normal text-slate-300">· Water Intelligence Engine</span></h2><p className="mt-0.5 text-xs text-slate-200" role="status">{props.status}</p></div><Button className="h-11 w-11 shrink-0 text-white hover:bg-white/10 hover:text-white" size="icon" variant="ghost" aria-label="Clear saved chat" disabled={pending || clearing || !messages?.length} onClick={() => void props.onClear()}><Trash2 className="h-4 w-4" /></Button>{!embedded && <Button className="h-11 w-11 shrink-0 text-white hover:bg-white/10 hover:text-white" size="icon" variant="ghost" aria-label="Close assistant" onClick={close}><X /></Button>}</header>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground"><span>{demo ? "Genuine AI · scenario data only" : "AI interpretation · authorized records"}</span><div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Suggested prompt language">{(["en", "ar"] as const).map(value => <button key={value} type="button" aria-pressed={language === value} className={`min-h-9 rounded px-2 ${language === value ? "bg-primary text-white" : "hover:bg-muted"}`} onClick={() => setLanguage(value)}>{value === "en" ? "English" : "العربية"}</button>)}</div><div className="flex w-full items-start gap-1.5"><Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{props.evidence}</span></div></div>
    <div ref={scroll} className="min-h-36 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 text-sm" aria-busy={pending || clearing}>
      {messages === undefined ? <p role="status" className="text-muted-foreground">{language === "ar" ? "جارٍ تحميل المحادثة الخاصة…" : "Loading your private conversation…"}</p> : !messages.length && <div className="space-y-3"><p className="leading-relaxed text-muted-foreground" dir="auto">{language === "ar" ? "اسأل عن القراءات، الاتجاهات، الحوادث أو أسباب قرارات السلامة. سنميز بين الحقائق المرصودة والاحتمالات والتوصيات." : "Ask about readings, trends, incidents or safety decisions. Ethm distinguishes observed facts, possible causes and recommended operator checks."}</p><div className="space-y-2">{ethmSuggestedQuestions(language, props.emergency).map(question => <button className="min-h-11 w-full rounded-lg border border-border p-3 text-start text-sm hover:bg-accent disabled:opacity-50" dir="auto" key={question} disabled={blocked} onClick={() => { setInput(question.slice(0, props.maxLength)); field.current?.focus(); }}>{question}</button>)}</div></div>}
      {messages?.map(message => <article key={message.id} className={`max-w-full rounded-xl p-3 leading-relaxed ${message.role === "user" ? "ms-5 bg-primary text-white" : "me-2 bg-muted text-foreground"}`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs opacity-80"><span className="font-semibold">{message.role === "user" ? language === "ar" ? "أنت" : "You" : message.kind === "service_status" ? "Service status" : message.kind === "interpretation" || message.kind === "ai_interpretation" ? "Ethm · AI interpretation" : "Ethm · saved message"}</span>{timeLabel(message.generatedAt) && <time dateTime={message.generatedAt}>{timeLabel(message.generatedAt)}</time>}</div>
        <div dir="auto" className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</div>
        {message.role === "assistant" && message.contextAsOf && <p className="mt-2 text-xs opacity-75">Scenario evidence: {message.contextScenario} · {timeLabel(message.contextAsOf)}{message.contextScenario !== props.contextScenario || (props.currentContextAsOf && message.contextAsOf !== props.currentContextAsOf) ? " · earlier context" : ""}</p>}
        {!!message.sources?.length && <ul aria-label="References" className="mt-3 space-y-1 border-t border-border/40 pt-2 text-xs">{message.sources.map(source => { const url = safeEthmSourceUrl(source.url); return url ? <li key={source.id}><a href={url} target="_blank" rel="noopener noreferrer" className="break-words underline underline-offset-2">{source.id} · {source.title}</a></li> : null; })}</ul>}
      </article>)}
      {pending && <p role="status" className="text-muted-foreground">{language === "ar" ? "جارٍ مراجعة الأدلة المتاحة…" : "Reviewing available evidence…"}</p>}
      {props.error && <div role="alert" className="rounded-lg border border-border p-3 text-muted-foreground"><p dir="auto">{props.error}</p>{props.onReconnect && <Button variant="outline" size="sm" className="mt-2" onClick={props.onReconnect} disabled={pending || clearing}><RefreshCw className="h-3.5 w-3.5" />{language === "ar" ? "إعادة الاتصال" : "Reconnect"}</Button>}</div>}
    </div>
    <form className="space-y-2 border-t border-border p-3" onSubmit={submit}><div className="flex items-end gap-2"><textarea ref={field} dir="auto" rows={2} aria-label="Question for Ethm" value={input} maxLength={props.maxLength} onChange={event => setInput(event.target.value)} disabled={blocked} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!blocked) void props.onSend(input); } }} placeholder={language === "ar" ? "اسأل عن القراءات أو الحوادث…" : "Ask about readings, incidents or next checks…"} className="min-h-12 min-w-0 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm" /><Button className="h-12 w-12 shrink-0" type="submit" size="icon" disabled={!input.trim() || blocked} aria-label="Send question"><Send /></Button></div><div className="flex flex-wrap items-start justify-between gap-2 text-xs text-muted-foreground"><span className="flex max-w-[24rem] gap-1"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />{language === "ar" ? "دعم للقرار فقط. لا يتحكم إثم بالمعدات ولا يثبت سلامة مياه الشرب." : "Decision support only. Ethm cannot control equipment or certify drinking-water safety."}</span>{typeof props.quota === "number" && <span>{language === "ar" ? `حتى ${props.quota} أسئلة متبقية` : `Up to ${props.quota} questions remaining`}</span>}</div></form>
  </section>;
}

function LiveAssistant({ embedded }: { embedded: boolean }) {
  const draft = useConversationDraft(embedded);
  const { selectedDeviceId, sensorData } = useProcessMode();
  const [now, setNow] = useState(Date.now());
  const messages = useQuery(api.chat.getMessages, draft.open ? {} : "skip");
  const [pending, setPending] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [clearError, setClearError] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [activeRunId, setActiveRunId] = useState<Id<"agentRuns"> | null>(null);
  const activeRun = useQuery(api.agent.getRun, activeRunId ? { runId: activeRunId } : "skip");
  const control = useQuery(api.devices.getControlState, draft.open && selectedDeviceId ? { deviceId: selectedDeviceId } : "skip");
  const createRun = useMutation(api.agent.createRun);
  const clearHistory = useMutation(api.chat.clearHistory);
  const run = useAction(api.chatAction.run);
  useEffect(() => { if (!draft.open) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [draft.open]);
  async function send(question: string) {
    const objective = question.trim();
    if (!objective || objective.length > 1000 || pending || clearing || messages === undefined) return;
    draft.setInput(""); setPending(true); setConnectionError(false);
    let created = false;
    try {
      const runId = await createRun({ objective, selectedDeviceId: selectedDeviceId || undefined });
      created = true; setActiveRunId(runId);
      // Server-owned private conversation and authorized tools supply all evidence.
      await run({ runId, messages: [], language: ethmQuestionLanguage(objective, draft.language) });
    } catch { setConnectionError(true); if (!created) draft.setInput(objective); }
    finally { setPending(false); }
  }
  async function clearChat() {
    if (pending || clearing || !messages?.length || !window.confirm(draft.language === "ar" ? "هل تريد حذف رسائل محادثتك المحفوظة؟" : "Clear your saved chat messages?")) return;
    setClearing(true); setClearError(false);
    try { await clearHistory({}); setActiveRunId(null); setConnectionError(false); }
    catch { setClearError(true); }
    finally { setClearing(false); }
  }
  const status = connectionError ? "Connection interrupted" : pending ? "Reviewing authorized evidence" : activeRun?.status === "failed" ? "Service unavailable" : activeRun?.status === "blocked" ? "Assessment stopped" : activeRun?.status === "completed" ? "Response received" : "Private conversation · on demand";
  const saved = messages?.map(message => ({ id: message._id, role: message.role, content: message.content, kind: message.kind, generatedAt: new Date(message._creationTime).toISOString(), sources: message.role === "assistant" && message.kind === "interpretation" ? ethmSourcesForContent(message.content) : [] }));
  return <ConversationFrame {...draft} embedded={embedded} demo={false} messages={saved} status={status} pending={pending} clearing={clearing} maxLength={1000} emergency={control?.mode === "emergency"} onSend={send} onClear={clearChat} error={connectionError ? "Ethm's connection was interrupted. Saved messages update when connectivity returns. No equipment action was executed." : clearError ? "Chat could not be cleared. Try again when the connection returns." : null} evidence={<>{selectedDeviceId || "No device selected"} · {readingFreshness(sensorData?.timestamp, now).toUpperCase()}{timeLabel(sensorData?.timestamp) ? ` · ${timeLabel(sensorData?.timestamp)}` : " · awaiting available records"}</>} />;
}

class DemoRequestError extends Error {
  constructor(public code: string, public remainingTurns?: number) { super(code); }
}
type DemoSavedMessage = Omit<EthmMessage, "id">;
type DemoSession = { sessionToken: string; expiresAt: string; remainingTurns: number; limits: { turns: number; maxQuestionCharacters: number }; messages: DemoSavedMessage[] };
type DemoAnswer = { text: string; generatedAt: string; contextScenario: string; contextAsOf: string; remainingTurns: number; sources?: EthmMessage["sources"]; kind: string };
function demoEndpoint(path: string) {
  const value = import.meta.env.VITE_CONVEX_SITE_URL?.trim() || import.meta.env.VITE_CONVEX_URL?.trim().replace(/\.convex\.cloud\/?$/, ".convex.site");
  if (!value) throw new DemoRequestError("DEMO_AI_UNAVAILABLE");
  const url = new URL(value);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new DemoRequestError("DEMO_AI_UNAVAILABLE");
  return `${url.origin}/demo/ethm/${path}`;
}
async function demoRequest<T>(path: string, body: unknown, token?: string | null): Promise<T> {
  const response = await fetch(demoEndpoint(path), { method: "POST", credentials: "omit", headers: { "Content-Type": "application/json", ...(token ? { "X-DWMS-Demo-Session": token } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(65_000) });
  const data = await response.json();
  if (!response.ok) throw new DemoRequestError(data?.error?.code ?? "DEMO_AI_UNAVAILABLE", data?.remainingTurns);
  return data as T;
}
function DemoAssistant({ embedded }: { embedded: boolean }) {
  const draft = useConversationDraft(embedded);
  const { state } = useDemo();
  const token = useRef<string | null>(savedSession());
  const [messages, setMessages] = useState<EthmMessage[] | undefined>();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [maxLength, setMaxLength] = useState(600);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const generation = useRef(0);
  async function loadSession() {
    if (connecting || pending || clearing) return;
    setConnecting(true); setErrorCode(null);
    try {
      const session = await demoRequest<DemoSession>("session", {}, token.current);
      token.current = session.sessionToken; saveSession(session.sessionToken);
      setMessages(session.messages.map((message, index) => ({ ...message, id: `saved-${index}-${message.generatedAt ?? ""}` })));
      setRemaining(session.remainingTurns); setExpiresAt(session.expiresAt); setMaxLength(Math.min(600, session.limits.maxQuestionCharacters));
    } catch (failure) {
      const code = failure instanceof DemoRequestError ? failure.code : "DEMO_AI_UNAVAILABLE";
      if (ethmDemoSessionInvalid(code)) { token.current = null; saveSession(null); }
      setErrorCode(code); setMessages(current => current ?? []);
    } finally { setConnecting(false); }
  }
  useEffect(() => {
    if (!draft.open || messages !== undefined || connecting) return;
    void loadSession();
    // One non-model session lookup on first open. Reconnect is always explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.open]);
  async function send(question: string) {
    const objective = question.trim();
    if (!objective || objective.length > maxLength || pending || connecting || clearing || !token.current || remaining === 0) return;
    const request = ++generation.current;
    const askedAt = new Date().toISOString();
    const context = demoIntelligenceContext(state);
    draft.setInput(""); setPending(true); setErrorCode(null);
    setMessages(current => [...(current ?? []), { id: `question-${request}`, role: "user", content: objective, generatedAt: askedAt }]);
    try {
      const answer = await demoRequest<DemoAnswer>("chat", { question: objective, context, language: ethmQuestionLanguage(objective, draft.language) }, token.current);
      if (request !== generation.current) return;
      setRemaining(answer.remainingTurns);
      setMessages(current => [...(current ?? []), { id: `answer-${request}`, role: "assistant", content: answer.text, generatedAt: answer.generatedAt, contextScenario: answer.contextScenario, contextAsOf: answer.contextAsOf, kind: answer.kind, sources: answer.sources }]);
    } catch (failure) {
      if (request !== generation.current) return;
      const code = failure instanceof DemoRequestError ? failure.code : "DEMO_AI_UNAVAILABLE";
      if (ethmDemoQuotaExceeded(code)) setRemaining(0);
      else if (failure instanceof DemoRequestError && typeof failure.remainingTurns === "number") setRemaining(failure.remainingTurns);
      if (ethmDemoSessionInvalid(code)) { token.current = null; saveSession(null); }
      setErrorCode(code);
    } finally { if (request === generation.current) setPending(false); }
  }
  async function clearChat() {
    if (pending || clearing || !token.current || !messages?.length || !window.confirm(draft.language === "ar" ? "هل تريد حذف محادثة هذه الجلسة التجريبية؟ لا يعيد الحذف تعيين حد الأسئلة." : "Clear this session's chat? Clearing does not reset its question limit.")) return;
    const previousLimit = ethmDemoQuotaExceeded(errorCode ?? undefined) ? errorCode : null;
    setClearing(true); setErrorCode(null);
    try {
      const session = await demoRequest<DemoSession>("session", { clearHistory: true }, token.current);
      generation.current += 1; setMessages([]); setRemaining(previousLimit ? 0 : session.remainingTurns); setErrorCode(previousLimit);
    } catch (failure) { setErrorCode(failure instanceof DemoRequestError ? failure.code : "DEMO_AI_UNAVAILABLE"); }
    finally { setClearing(false); }
  }
  const error = errorCode ? ethmDemoError(errorCode, draft.language) : null;
  return <ConversationFrame {...draft} embedded={embedded} demo messages={messages} status={errorCode ? "Temporarily unavailable" : remaining === 0 ? "Session question limit reached" : connecting ? "Connecting private demo session" : pending ? "Analyzing official scenario evidence" : "Guest conversation · GPT-5-mini"} pending={pending || connecting} clearing={clearing} maxLength={maxLength} emergency={state.response.emergencyLatched} onSend={send} onClear={clearChat} quota={remaining} error={error} onReconnect={error && !ethmDemoQuotaExceeded(errorCode ?? undefined) ? () => void loadSession() : undefined} unavailable={!!errorCode || !token.current} contextScenario={state.scenario} currentContextAsOf={state.updatedAt} evidence={<>{state.scenario} · {timeLabel(state.updatedAt)}{expiresAt ? ` · chat session until ${new Date(expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</>} />;
}
function LiveAssistantAccess({ embedded }: { embedded: boolean }) {
  const { user, canViewFleet } = useUserRole();
  return user && canViewFleet ? <Authenticated><LiveAssistant key={user._id} embedded={embedded} /></Authenticated> : null;
}
export default function EthmAssistant({ embedded = false }: { embedded?: boolean }) {
  const { pathname } = useLocation();
  const dedicated = pathname === "/demo/assistant" || pathname === "/live/assistant";
  if (dedicated !== embedded) return null;
  if (pathname === "/demo" || pathname.startsWith("/demo/")) return <DemoAssistant embedded={embedded} />;
  if (pathname === "/live" || pathname.startsWith("/live/")) return <LiveAssistantAccess embedded={embedded} />;
  return null;
}
