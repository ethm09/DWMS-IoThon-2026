/** Opens a conversation draft only. A user must explicitly submit before an AI request. */
export const ETHM_OPEN_EVENT = "dwms:open-ethm";
export function openEthmQuestion(question: string) {
  window.dispatchEvent(new CustomEvent(ETHM_OPEN_EVENT, { detail: { question: question.slice(0, 1000) } }));
}
