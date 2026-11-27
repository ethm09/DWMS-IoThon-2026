/**
 * Curated background for Ethm, reviewed against the linked primary sources.
 * These summaries do not import regulations into DWMS control policy. No
 * model, sensor calibration, treatment result or legal compliance is certified.
 * Source text is paraphrased; external pages are not fetched during a chat.
 */
export type KnowledgeSource = {
  readonly id: string;
  readonly title: string;
  readonly authority: string;
  readonly url: string;
  readonly reviewedAt: string;
  readonly scope: string;
  readonly summary: string;
  readonly limits: string;
};

export const KNOWLEDGE_REVIEWED_AT = "2026-11-27";

export const ETHM_KNOWLEDGE_SOURCES: readonly KnowledgeSource[] = [
  {
    id: "WHO_GDWQ_2026",
    title: "Guidelines for drinking-water quality, fourth edition with three addenda",
    authority: "World Health Organization",
    url: "https://www.who.int/publications/i/item/9789240121225",
    reviewedAt: KNOWLEDGE_REVIEWED_AT,
    scope: "Drinking-water risk management; published 17 June 2026",
    summary: "WHO describes risk management from catchment to consumer, health-based targets and independent surveillance. Operational monitoring complements wider microbial, chemical and system-risk assessment; a few in-range sensor channels cannot establish drinking-water safety.",
    limits: "WHO guidance is not a Saudi legal approval or a DWMS certification. Site use, applicable regulation and required laboratory testing must be established separately.",
  },
  {
    id: "WHO_PH_2022",
    title: "Chemical fact sheets: pH",
    authority: "World Health Organization",
    url: "https://www.who.int/publications/m/item/chemical-fact-sheets--ph",
    reviewedAt: KNOWLEDGE_REVIEWED_AT,
    scope: "2022 pH fact sheet, extracted from the first/second-addenda edition",
    summary: "WHO identifies pH as an important operational parameter and does not derive a health-based guideline value for pH in this fact sheet. A pH reading alone does not identify a contaminant or establish potability.",
    limits: "Do not describe DWMS's configured pH band as a WHO health-based limit or prescribe a chemical dose from this reading.",
  },
  {
    id: "WHO_TDS_2022",
    title: "Chemical fact sheets: Total dissolved solids",
    authority: "World Health Organization",
    url: "https://www.who.int/publications/m/item/chemical-fact-sheets--total-dissolved-solids",
    reviewedAt: KNOWLEDGE_REVIEWED_AT,
    scope: "2022 TDS fact sheet, extracted from the first/second-addenda edition",
    summary: "TDS describes dissolved salts and some organic matter. The fact sheet does not derive a health-based guideline value for TDS and notes acceptability concerns at high levels. TDS does not identify which dissolved constituents are present.",
    limits: "A low TDS reading is not a safety certificate. Do not infer a conductivity-to-TDS factor, temperature compensation or filter removal efficiency without the actual instrument and treatment documentation.",
  },
  {
    id: "WHO_TURBIDITY_2017",
    title: "Water quality and health: Review of turbidity",
    authority: "World Health Organization",
    url: "https://www.who.int/publications/i/item/WHO-FWC-WSH-17.01",
    reviewedAt: KNOWLEDGE_REVIEWED_AT,
    scope: "Operational turbidity interpretation across the water supply chain",
    summary: "Suspended particles cause turbidity. Changes may indicate source, treatment or distribution events; turbidity is useful operational evidence but does not itself identify pathogens. Interpretation depends on where the sample was taken and the water process.",
    limits: "Possible causes require confirmation. A pump request, conceptual filtration drawing or lower turbidity does not prove disinfection, contaminant removal or effective treatment.",
  },
  {
    id: "USGS_MONITORS_2006",
    title: "Continuous water-quality monitors: station operation, record computation and reporting",
    authority: "U.S. Geological Survey, Techniques and Methods 1-D3",
    url: "https://www.usgs.gov/publications/guidelines-and-standard-procedures-continuous-water-quality-monitors-station-operation",
    reviewedAt: KNOWLEDGE_REVIEWED_AT,
    scope: "Continuous-monitor inspection, calibration, field quality assurance and record review",
    summary: "Continuous measurements require sensor inspection, calibration checks and record review. Fouling and calibration drift can affect records; maintenance and independent checks help separate instrument issues from environmental changes.",
    limits: "This is general monitoring guidance, not the manual for DWMS's unidentified probes. Do not invent sensor models, coefficients, reference solutions, accuracy, wiring or calibration intervals. Obtain the manufacturer instructions and approved site procedure.",
  },
  {
    id: "SAUDI_WATER_CODE_2025",
    title: "Saudi Code for Water Sources and Uses — official gazette publication",
    authority: "Saudi Ministry of Environment, Water and Agriculture; Umm Al-Qura",
    url: "https://www.uqn.gov.sa/details?p=27189",
    reviewedAt: KNOWLEDGE_REVIEWED_AT,
    scope: "Saudi water-source/use regulatory context, published 23 May 2025",
    summary: "The Saudi code addresses sources and uses of water, monitoring, records and regulatory responsibilities. Applicable requirements depend on the intended water use, source and competent authority; treated-water reuse is governed by approved requirements, not a prototype dashboard status.",
    limits: "This bank does not encode the current numerical Saudi drinking/reuse/discharge tables. Obtain the applicable current approved standard and site permit for the actual end use, including required microbial/chemical laboratory results. Do not infer Saudi compliance from DWMS bands or WHO guidance.",
  },
];

/** Model-returned identifiers can resolve only to the curated citation whitelist. */
export function resolveKnowledgeSources(ids: readonly string[]): KnowledgeSource[] {
  const requested = new Set(ids.slice(0, 30));
  return ETHM_KNOWLEDGE_SOURCES.filter((source) => requested.has(source.id));
}

export function buildKnowledgeContext(ids?: readonly string[]): string {
  const sources = ids === undefined ? ETHM_KNOWLEDGE_SOURCES : resolveKnowledgeSources(ids);
  return [
    "Curated water-knowledge notes, reviewed " + KNOWLEDGE_REVIEWED_AT + ". Background knowledge is distinct from sensor observations and deterministic control policy.",
    "Use these notes only when relevant. Cite the exact source ID and direct URL for a supported general claim; do not invent citations, numeric regulatory limits or missing clauses. Do not imply every listed source was used. If the needed standard, clause or manufacturer manual is absent, say it is unavailable and request confirmation rather than guessing.",
    "Separate observed facts, possible explanations and recommended operator checks. Calibration and maintenance suggestions must defer to the identified manufacturer's manual and approved site procedure. Do not prescribe treatment/dosing, certify drinking/reuse/discharge safety, change control thresholds or bypass emergency protection. No reference establishes predictive accuracy or physical validation of DWMS.",
    ...sources.map((source) => [
      `[${source.id}] ${source.title} — ${source.authority}.`,
      `Scope: ${source.scope}. ${source.summary}`,
      `Boundary: ${source.limits}`,
      `Source: ${source.url}`,
    ].join("\n")),
  ].join("\n\n");
}
