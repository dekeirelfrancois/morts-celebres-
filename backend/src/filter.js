import {
  DEATH_KEYWORDS,
  PERSON_HINTS,
  STRONG_OBIT_KEYWORDS,
  NEGATIVE_PATTERNS,
  NON_HUMAN_WORDS,
} from "./config.js";

export const MATCH_THRESHOLD = 25;

const TITLE_KW_POINTS = 12;
const DESC_KW_POINTS = 3;
const TITLE_BONUS = 15;
const PERSON_POINTS = 6;
const NEGATIVE_PENALTY = 12;

function normalize(text) {
  return (text || "")
    .replace(/[\u2018\u2019\u02BC\u201B]/g, "'") // apostrophes typographiques → ASCII
    .toLowerCase()
    .normalize("NFC");
}

export function scoreItem(title, description, lang) {
  const t = normalize(title);
  const d = normalize(description);
  const keywords = DEATH_KEYWORDS[lang] || DEATH_KEYWORDS.fr;

  let titleKwHits = 0;
  let descKwHits = 0;
  let strongHit = false;
  for (const kw of keywords) {
    if (t.includes(kw)) {
      titleKwHits += 1;
      if (STRONG_OBIT_KEYWORDS.includes(kw)) strongHit = true;
    } else if (d.includes(kw)) {
      descKwHits += 1;
    }
  }

  if (titleKwHits === 0 && descKwHits === 0) {
    return { match: false, score: 0, reason: "no-death-keyword" };
  }

  const tNonHuman = NON_HUMAN_WORDS.some((w) => t.includes(w));
  if (tNonHuman) {
    return { match: false, score: 0, reason: "non-human-subject" };
  }

  let personScore = 0;
  for (const hint of PERSON_HINTS[lang] || []) {
    if (t.includes(hint)) personScore += 1;
    if (d.includes(hint)) personScore += 1;
  }

  const negated = NEGATIVE_PATTERNS.some((re) => re.test(title) || re.test(description));
  const retro = /(ans|mois|jours|décennies)\s+après\s+(la\s+)?(mort|décès|disparition)/i.test(
    title + " " + description
  );

  let score =
    titleKwHits * TITLE_KW_POINTS +
    descKwHits * DESC_KW_POINTS +
    personScore * PERSON_POINTS;
  if (titleKwHits > 0) score += TITLE_BONUS;
  if (negated) score -= NEGATIVE_PENALTY;
  if (retro) score -= NEGATIVE_PENALTY * 2;

  // Signal de notoriété obligatoire : profession reconnue, mot de nécrologie,
  // ou âge du défunt (« à 85 ans », « died at 77 »). Sans cela, un simple
  // « la mort de [prénom] » dans un article sociéta ne suffit plus.
  const hasObitWord = /\bnécrolog|obituary\b/i.test(t + " " + d);
  const hasAge = /\b[àa]\s+\d{1,3}\s*ans\b/i.test(t + " " + d) ||
    /\b\d{1,3}\s*ans\b/i.test(d) ||
    /\b(died at|age of|dead at)\s+\d{1,3}\b/i.test(t + " " + d);
  if (personScore === 0 && !hasObitWord && !hasAge) {
    return { match: false, score, reason: "no-notability-signal" };
  }

  const match = score >= MATCH_THRESHOLD;
  return { match, score, reason: match ? "ok" : "below-threshold" };
}

export function buildEntry(item, feed) {
  const title = (item.title || "").trim();
  const description = (item.contentSnippet || item.content || item.summary || "").trim();
  const { score, reason } = scoreItem(title, description, feed.lang);
  return {
    id: Buffer.from(item.link || item.guid || title).toString("base64url"),
    title,
    description: description.slice(0, 400),
    link: item.link || "",
    source: feed.name,
    lang: feed.lang,
    publishedAt: item.isoDate ? new Date(item.isoDate).toISOString() : new Date().toISOString(),
    score,
    matched: reason === "ok" && score >= MATCH_THRESHOLD,
    reason,
  };
}
