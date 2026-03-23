type LexiconItem = {
  label: string;
  terms: string[];
};

export type CommunityNotesSummary = {
  mentionsCount: number;
  chips: string[];
  shortLine: string;
  detailLine: string;
  cardLine: string;
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

const PAIN_DETAIL_LEXICON: LexiconItem[] = [
  { label: "Back pain", terms: ["back pain", "lower back", "upper back"] },
  { label: "Joint pain", terms: ["joint pain", "joints", "arthritis"] },
  { label: "Leg pain", terms: ["leg pain", "legs", "sciatica"] },
  { label: "Headaches", terms: ["headache", "migraine"] },
  { label: "Cramps", terms: ["cramps", "period pain", "period cramps"] },
  { label: "Nerve pain", terms: ["nerve pain", "neuropathy"] },
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

function extractTemperatures(lines: string[]) {
  const matches: number[] = [];

  lines.forEach((line) => {
    const regex = /\b(1[3-9]\d|2[0-3]\d)\s*c\b/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) matches.push(value);
    }
  });

  return matches.sort((a, b) => a - b);
}

function buildTemperaturePhrase(temps: number[]) {
  if (temps.length === 0) return "";
  const unique = Array.from(new Set(temps));
  const low = unique[0];
  const high = unique[unique.length - 1];
  if (low === high) return `vape temps around ${low}C`;
  if (high - low <= 8) return `vape temps around ${Math.round((low + high) / 2)}C`;
  return `vape temps around ${low}-${high}C`;
}

function buildStructuredShortLine(effects: string[], reliefs: string[], flavours: string[], contexts: string[]) {
  const benefits = joinNatural([...effects.slice(0, 2), ...reliefs.slice(0, 1)]);
  const flavoursLine = joinNatural(flavours.slice(0, 2));
  const context = contexts[0]?.toLowerCase() ?? "";

  if (benefits && context) return `Members report ${benefits}, mostly for ${context} use.`;
  if (benefits && flavoursLine) return `Members report ${benefits} with ${flavoursLine.toLowerCase()} notes.`;
  if (benefits) return `Members report ${benefits}.`;
  if (flavoursLine && context) return `Members report ${flavoursLine.toLowerCase()} notes, mostly for ${context} use.`;
  if (flavoursLine) return `Members report ${flavoursLine.toLowerCase()} flavour notes.`;
  if (context) return `Members report mostly ${context} use.`;
  return "Members are still building shared notes for this strain.";
}

function buildStructuredDetailLine(effects: string[], reliefs: string[], flavours: string[], contexts: string[], temps: number[]) {
  const parts: string[] = [];
  if (effects.length > 0) parts.push(`effects such as ${joinNatural(effects)}`);
  if (reliefs.length > 0) parts.push(`pain support for ${joinNatural(reliefs)}`);
  if (flavours.length > 0) parts.push(`flavour notes like ${joinNatural(flavours)}`);
  if (contexts.length > 0) parts.push(`common use in ${joinNatural(contexts)} sessions`);
  const temperaturePhrase = buildTemperaturePhrase(temps);
  if (temperaturePhrase) parts.push(temperaturePhrase);

  if (parts.length === 0) return "Members are still building shared notes for this strain.";
  return `Members most often mention ${joinPhrases(parts)}.`;
}

function buildCardLine(shortLine: string, effects: string[], reliefs: string[], contexts: string[], temps: number[]) {
  const benefits = joinNatural([...effects.slice(0, 2), ...reliefs.slice(0, 1)]);
  const context = contexts[0]?.toLowerCase() ?? "";
  const temperaturePhrase = buildTemperaturePhrase(temps);

  if (benefits && context && temperaturePhrase) {
    return `Members report ${benefits}, mostly for ${context} use. ${temperaturePhrase.charAt(0).toUpperCase()}${temperaturePhrase.slice(1)}.`;
  }
  if (benefits && context) return `Members report ${benefits}, mostly for ${context} use.`;
  if (benefits && temperaturePhrase) {
    return `Members report ${benefits}. ${temperaturePhrase.charAt(0).toUpperCase()}${temperaturePhrase.slice(1)}.`;
  }
  if (temperaturePhrase) return `Members report ${temperaturePhrase}.`;
  return shortLine;
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
  const painDetailCounts = collectLexiconCounts(lines, PAIN_DETAIL_LEXICON);

  const topEffects = rankLabels(effectCounts, 3, minCount);
  const topFlavours = rankLabels(flavourCounts, 2, minCount);
  const topContexts = rankLabels(contextCounts, 2, minCount);
  const topPainDetails = rankLabels(painDetailCounts, 2, minCount);
  const temperatures = extractTemperatures(lines);

  const chips = Array.from(
    new Set<string>([
      ...topEffects,
      ...topPainDetails,
      ...topFlavours,
      ...topContexts,
    ]),
  ).slice(0, 6);

  const shortLine = buildStructuredShortLine(topEffects, topPainDetails, topFlavours, topContexts);
  const detailLine = buildStructuredDetailLine(topEffects, topPainDetails, topFlavours, topContexts, temperatures);

  return {
    mentionsCount: lines.length,
    chips,
    shortLine,
    detailLine,
    cardLine: buildCardLine(shortLine, topEffects, topPainDetails, topContexts, temperatures),
    searchText: [...topEffects, ...topPainDetails, ...topFlavours, ...topContexts, ...temperatures.map((value) => `${value}c`)].join(" ").toLowerCase(),
  };
}
