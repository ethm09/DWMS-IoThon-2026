import type { DemoState } from "./demo-state";
import { ETHM_KNOWLEDGE_SOURCES } from "../../convex/knowledge";

export type EthmLanguage = "en" | "ar";
export type EthmSource = { id: string; title: string; url: string };
export type EthmMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  generatedAt?: string;
  contextScenario?: string;
  contextAsOf?: string;
  kind?: string;
  sources?: EthmSource[];
};

/** The server reconstructs official fixture values; browser measurements are not evidence. */
export function demoIntelligenceContext(state: DemoState) {
  return {
    scenario: state.scenario,
    mode: state.response.mode,
    pumpOn: state.response.pumpOn,
    emergencyLatched: state.response.emergencyLatched,
    history: state.history.slice(-12).map(({ scenario, timestamp }) => ({ scenario, timestamp })),
  };
}

export function ethmSuggestedQuestions(language: EthmLanguage, emergency: boolean) {
  return language === "ar" ? [
    "اشرح القراءات الحالية وما الذي تغير، مع ذكر وقت البيانات.",
    emergency ? "لماذا يبقى إيقاف الطوارئ مفعلاً؟ وما فحوصات التعافي المطلوبة؟" : "ما أهم الحوادث والاحتمالات التي ينبغي للمشغل التحقق منها؟",
    "هل تكفي البيانات لتحليل الاتجاه؟ وضّح حدود الاستنتاج والمراجع المناسبة.",
  ] : [
    "Explain the current readings and significant changes, with evidence timestamps.",
    emergency ? "Why is emergency still latched, and what recovery checks are required?" : "Which incidents and possible causes should the operator investigate?",
    "Is there enough history to analyze the trend? Explain limitations and relevant references.",
  ];
}

export function ethmDemoError(code: string | undefined, language: EthmLanguage) {
  const limited = ["DEMO_AI_SESSION_QUOTA", "DEMO_SESSION_QUOTA", "SESSION_QUOTA_EXCEEDED", "DEMO_QUOTA_EXCEEDED"].includes(code ?? "");
  const rate = ["DEMO_AI_RATE_LIMITED", "DEMO_AI_BUSY", "RATE_LIMITED", "DEMO_RATE_LIMITED"].includes(code ?? "");
  const expired = ethmDemoSessionInvalid(code);
  const allowance = code === "DEMO_AI_BUDGET_EXHAUSTED";
  const context = code === "DEMO_AI_CONTEXT_LIMIT";
  const changed = code === "DEMO_AI_CONTEXT_CHANGED";
  const invalid = code === "INVALID_CONTEXT" || code === "DEMO_AI_BAD_REQUEST";
  if (language === "ar") {
    if (limited) return "وصلت هذه الجلسة التجريبية إلى الحد المسموح للأسئلة.";
    if (rate) return "يرجى الانتظار قليلاً قبل إرسال سؤال آخر.";
    if (expired) return "انتهت جلسة المحادثة. أعد الاتصال لبدء جلسة جديدة ضمن الحدود المتاحة.";
    if (allowance) return "توقفت محادثة إثم التجريبية مؤقتاً بعد بلوغ الحد المشترك للاستخدام. تظل السيناريوهات والتحليلات المرصودة متاحة.";
    if (context) return "بلغت المحادثة حد السياق المتاح. احذف سجل المحادثة أو اختصر السؤال؛ لا يعيد الحذف تعيين حد الأسئلة.";
    if (changed) return "تغير سياق المحادثة. أعد الاتصال لمراجعة السجل الحالي قبل إعادة إرسال السؤال.";
    if (invalid) return "تعذر التحقق من سياق السيناريو. أعد ضبط العرض التجريبي قبل المحاولة مرة أخرى.";
    return "يتعذر الوصول إلى إثم حالياً. تظل السيناريوهات والتحليلات المرصودة متاحة.";
  }
  if (limited) return "This demo session has reached its question limit.";
  if (rate) return "Please wait before sending another question.";
  if (expired) return "This chat session expired. Reconnect to start a new session within the available limits.";
  if (allowance) return "Guest Ethm has reached its shared usage allowance. Scenarios and observed insights remain available.";
  if (context) return "This conversation reached its context limit. Clear saved chat or shorten the question; clearing does not reset its question limit.";
  if (changed) return "The conversation changed. Reconnect to review its current history before sending again.";
  if (invalid) return "The scenario context could not be verified. Reset the demonstration before trying again.";
  return "Ethm is temporarily unavailable. Scenarios and observed insights remain available.";
}

export function ethmDemoQuotaExceeded(code: string | undefined): boolean {
  return ["DEMO_AI_SESSION_QUOTA", "DEMO_AI_BUDGET_EXHAUSTED", "DEMO_SESSION_QUOTA", "SESSION_QUOTA_EXCEEDED", "DEMO_QUOTA_EXCEEDED"].includes(code ?? "");
}

export function ethmDemoSessionInvalid(code: string | undefined): boolean {
  return ["DEMO_AI_SESSION_EXPIRED", "DEMO_AI_SESSION_INVALID", "DEMO_SESSION_EXPIRED", "INVALID_SESSION", "SESSION_EXPIRED"].includes(code ?? "");
}

/** A model-provided link is clickable only when it is an exact curated reference. */
export function safeEthmSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const known = ETHM_KNOWLEDGE_SOURCES.find(source => new URL(source.url).href === url.href);
    return known ? new URL(known.url).href : null;
  } catch { return null; }
}

/** Saved Live replies keep citations separate from the underlying telemetry facts. */
export function ethmSourcesForContent(content: string): EthmSource[] {
  const urls = new Set((content.match(/https:\/\/[^\s<>"\])]+/gu) ?? []).map(value => value.replace(/[.,;]+$/u, "")));
  return ETHM_KNOWLEDGE_SOURCES.filter(source => content.includes(`[${source.id}]`) || urls.has(source.url))
    .map(({ id, title, url }) => ({ id, title, url }));
}

export function ethmQuestionLanguage(question: string, selected: EthmLanguage): EthmLanguage {
  return /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u.test(question) ? "ar" : selected;
}
