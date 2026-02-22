type LexiconItem = {
  label: string;
  terms: string[];
};

export type CommunityNotesSummary = {
  mentionsCount: number;
  chips: string[];
  shortLine: string;
  detailLine: string;
  searchText: string;
};

const EFFECT_LEXICON: LexiconItem[] = [
  { label: "Couch lock", terms: ["couch lock", "couchlock", "sleepy", "sedating", "sedation", "knockout"] },
  { label: "Calm", terms: ["calm", "calming", "relax", "relaxed", "chill", "grounded"] },
  { label: "Uplift", terms: ["uplift", "uplifting", "euphoric", "energised", "energized"] },
  { label: "Focus", terms: ["focus", "focused", "clarity", "clear headed", "adhd"] },
  { label: "Pain relief", terms: ["pain relief", "pain", "ache", "analgesic"] },
  { label: "Anxiety relief", terms: ["anxiety", "stress", "paranoia", "panic", "racing thoughts"] },
  { label: "Munchies", terms: ["munchies", "appetite", "hungry", "hunger"] },
  { label: "Creative", terms: ["creative", "creativity", "ideas", "idea flow"] },
];

const FLAVOUR_LEXICON: LexiconItem[] = [
  { label: "Citrus", terms: ["citrus", "lemon", "lime", "orange"] },
  { label: "Berry/Fruit", terms: ["berry", "fruity", "fruit", "tropical", "grape"] },
  { label: "Sweet", terms: ["sweet", "sugary", "dessert", "vanilla"] },
  { label: "Earthy", terms: ["earthy", "soil", "woody"] },
  { label: "Pine", terms: ["pine", "piney"] },
  { label: "Diesel/Gas", terms: ["diesel", "gassy", "gas"] },
  { label: "Spicy/Pepper", terms: ["spicy", "pepper", "peppery"] },
  { label: "Floral", terms: ["floral", "lavender"] },
  { label: "Creamy", terms: ["creamy", "cream", "buttery"] },
  { label: "Skunky", terms: ["skunk", "skunky"] },
];

const CONTEXT_LEXICON: LexiconItem[] = [
  { label: "Daytime", terms: ["daytime", "day time", "day use", "workday", "functional"] },
  { label: "Evening", terms: ["evening", "after work", "late afternoon"] },
  { label: "Night", terms: ["night", "nighttime", "bed", "bedtime", "before sleep"] },
  { label: "Social", terms: ["social", "party", "conversation", "out and about"] },
];

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasTerm(text: string, term: string) {
  const cleaned = term.trim().toLowerCase();
  if (!cleaned) return false;
  if (cleaned.includes(" ")) return text.includes(cleaned);
  const rx = new RegExp(`\\b${escapeRegex(cleaned)}\\b`, "i");
  return rx.test(text);
}

function collectLexiconCounts(lines: string[], lexicon: LexiconItem[]) {
  const counts = new Map<string, number>();

  lines.forEach((line) => {
    lexicon.forEach((item) => {
      const matched = item.terms.some((term) => hasTerm(line, term));
      if (!matched) return;
      counts.set(item.label, (counts.get(item.label) ?? 0) + 1);
    });
  });

  return counts;
}

function rankLabels(counts: Map<string, number>, maxItems: number, minCount: number) {
  return Array.from(counts.entries())
    .filter(([, count]) => count >= minCount)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, maxItems)
    .map(([label]) => label);
}

function joinNatural(labels: string[]) {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

function joinPhrases(phrases: string[]) {
  if (phrases.length === 0) return "";
  if (phrases.length === 1) return phrases[0];
  if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`;
  return `${phrases.slice(0, -1).join(", ")}, and ${phrases[phrases.length - 1]}`;
}

function buildStructuredShortLine(effects: string[], flavours: string[], contexts: string[]) {
  const e = joinNatural(effects.slice(0, 2));
  const f = joinNatural(flavours.slice(0, 2));
  const c = joinNatural(contexts.slice(0, 1));

  if (e && f && c) return `Community notes: Members report ${e} effects with ${f} flavour notes, mostly for ${c} use.`;
  if (e && f) return `Community notes: Members report ${e} effects with ${f} flavour notes.`;
  if (e && c) return `Community notes: Members report ${e} effects, mostly for ${c} use.`;
  if (f && c) return `Community notes: Members report ${f} flavour notes, mostly for ${c} use.`;
  if (e) return `Community notes: Members report ${e} effects.`;
  if (f) return `Community notes: Members report ${f} flavour notes.`;
  if (c) return `Community notes: Members report mostly ${c} use.`;
  return "Community notes: Early member notes are coming in for this strain.";
}

function buildStructuredDetailLine(effects: string[], flavours: string[], contexts: string[]) {
  const parts: string[] = [];
  if (effects.length > 0) parts.push(`effects such as ${joinNatural(effects)}`);
  if (flavours.length > 0) parts.push(`flavour notes like ${joinNatural(flavours)}`);
  if (contexts.length > 0) parts.push(`common use in ${joinNatural(contexts)} sessions`);

  if (parts.length === 0) return "Members are still building shared notes for this strain.";
  return `Members most often mention ${joinPhrases(parts)}.`;
}

export function buildCommunityNotesSummary(textsInput: Array<string | null | undefined>): CommunityNotesSummary | null {
  const lines = textsInput
    .map((value) => (typeof value === "string" ? normalizeText(value) : ""))
    .filter((value) => value.length > 0);

  if (lines.length === 0) return null;

  const minCount = lines.length >= 4 ? 2 : 1;

  const effectCounts = collectLexiconCounts(lines, EFFECT_LEXICON);
  const flavourCounts = collectLexiconCounts(lines, FLAVOUR_LEXICON);
  const contextCounts = collectLexiconCounts(lines, CONTEXT_LEXICON);

  const topEffects = rankLabels(effectCounts, 3, minCount);
  const topFlavours = rankLabels(flavourCounts, 2, minCount);
  const topContexts = rankLabels(contextCounts, 2, minCount);

  const chips = Array.from(
    new Set<string>([
      ...topEffects,
      ...topFlavours,
      ...topContexts,
    ]),
  ).slice(0, 6);

  return {
    mentionsCount: lines.length,
    chips,
    shortLine: buildStructuredShortLine(topEffects, topFlavours, topContexts),
    detailLine: buildStructuredDetailLine(topEffects, topFlavours, topContexts),
    searchText: [...topEffects, ...topFlavours, ...topContexts].join(" ").toLowerCase(),
  };
}
