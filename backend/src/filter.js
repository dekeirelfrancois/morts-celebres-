import {
  DEATH_KEYWORDS,
  PERSON_HINTS,
  STRONG_OBIT_KEYWORDS,
  NEGATIVE_PATTERNS,
} from "./config.js";

export const MATCH_THRESHOLD = 15;

function normalize(text) {
  return (text || "").toLowerCase().normalize("NFC");
}

export function scoreItem(title, description, lang) {
  const t = normalize(title);
  const d = normalize(description);
  const haystack = `${t} ${d}`;
  const keywords = DEATH_KEYWORDS[lang] || DEATH_KEYWORDS.fr;

  let keywordHits = 0;
  let titleHit = false;
  let strongHit = false;
  for (const kw of keywords) {
    if (haystack.includes(kw)) {
      keywordHits += 1;
      if (t.includes(kw)) titleHit = true;
      if (STRONG_OBIT_KEYWORDS.includes(kw)) strongHit = true;
    }
  }

  if (keywordHits === 0) return { match: false, score: 0, reason: "no-death-keyword" };

  let personScore = 0;
  for (const hint of PERSON_HINTS[lang] || []) {
    if (haystack.includes(hint)) personScore += 1;
  }

  const negated = NEGATIVE_PATTERNS.some((re) => re.test(title) || re.test(description));

  if (personScore === 0 && !(strongHit && titleHit)) {
    return { match: false, score: keywordHits * 5, reason: "no-notability-signal" };
  }

  let score = keywordHits * 10 + (titleHit ? 20 : 0) + personScore * 5;
  if (negated) score -= 25;

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
