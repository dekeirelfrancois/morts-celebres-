import { PERSON_HINTS } from "./config.js";

// ————————————————————————————————————————————————————————————
// Vérification de notoriété par Wikipédia :
// un défunt n'est signalé que s'il possède une page (fr ou en)
// décrivant UNE personne précise (pas une liste de patronyme).
// Appels: sérialisés + débit limité (Wikipédia renvoie 429 au-delà).
// Politique : en cas d'indisponibilité, l'article est mis en attente
// (retry au prochain cycle de scrutation) — jamais accepté par défaut.
// ————————————————————————————————————————————————————————————

const cache = new Map(); // "lang:nom normalisé" → résultat définitif uniquement
const MIN_DELAY_MS = 400; // ≤ 2,5 req/s vers Wikipédia

let chain = Promise.resolve();
let lastCall = 0;

function throttled(fn) {
  const run = chain.then(async () => {
    const wait = lastCall + MIN_DELAY_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  chain = run.catch(() => {});
  return run;
}

function deaccent(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function norm(s) {
  return deaccent((s || "").replace(/[\u2018\u2019\u02BC]/g, "'"))
    .replace(/['\u2019]/g, "")
    .replace(/[^a-zA-Z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const NAME_CLASS = `[A-Z\u00C0-\u00DD][\\p{L}'\u2019-]+`;

// Extraction du nom du défunt dans un titre d'article
export function extractDeceasedName(title, description = "") {
  let hay = (title || "")
    .replace(/[\u00a0\u202f\u2009]/g, " ") // espaces insécables françaises
    .replace(/[\u2018\u2019\u02BC]/g, "'") // apostrophes typographiques
    .replace(/\s+/g, " ");

  // retire les accroches de lieu (« Ville : ... »)
  const colon = hay.indexOf(" : ");
  if (colon > -1 && colon < 60) hay = hay.slice(colon + 3).trim();

  const patterns = [
    /d(?:é|e)c(?:è|e)s d(?:e|')\s*([^,\.»«:;!?]+)/i,
    /\bmorte?\s+d(?:e|')\s*([^,\.»«:;!?]+)/i,
    /\bdécéd(?:é|e)e?\s+(?:ce\s|le\s|hier\s)?([^,\.»«:;!?]+)/i,
    /\bdeath of\s+((?:the\s+)?[^,\.»«:;!?]+)/i,
    /\bpassing of\s+((?:the\s+)?[^,\.»«:;!?]+)/i,
    new RegExp(`(${NAME_CLASS}(?:\\s+(?:de|van|von|der|di|del)\\b)?(?:\\s+${NAME_CLASS}){0,3})\\s*[,:(]`, "u"),
  ];

  for (const re of patterns) {
    const m = hay.match(re);
    if (!m) continue;
    const name = sanitizeName(m[1]);
    if (name) return name;
  }

  // Formulation « [Fonction] Nom Prénom est mort(e)/décédé(e)/… »
  const verbRe =
    /(?:est\s+morte?|est\s+décédée?|s'est\s+étein\w+|vient\s+de\s+mourir|meurt|has\s+died|died\s+at|dies\s+at|passed\s+away)/i;
  const vm = hay.match(verbRe);
  if (vm && vm.index > 0) {
    const pre = hay.slice(0, vm.index).replace(/.*[,:«]\s*/, "").trim();
    const words = pre.split(/\s+/);
    const STOP = new Set(["de", "du", "d'", "van", "von", "der", "di", "del"]);
    const STOP_PREFIX = /^(l'|le |la |les |un |une |mon |ma|cet |ce |cette |et |d')/i;
    const nameWords = [];
    for (let i = words.length - 1; i >= 0 && nameWords.length < 4; i--) {
      const w = words[i];
      if (STOP.has(w.toLowerCase()) || /^[A-Z\u00C0-\u00DD]/.test(w)) {
        nameWords.unshift(w.replace(STOP_PREFIX, ""));
      } else break;
    }
    const candidate = sanitizeName(nameWords.join(" ").replace(/^[,:«»\s]+/, ""));
    if (candidate) return candidate;
  }

  return null;
}

function sanitizeName(raw) {
  let name = (raw || "").trim().replace(/[\u2018\u2019\u02BC]/g, "'");
  name = name
    .replace(/^l'/i, "")
    .replace(/^(le|la|les)\s+/i, "")
    .replace(/\s+(à|at)\s+\d{1,3}\s*(ans|years)?.*$/i, "")
    .replace(/\s*[\u00ab\u201c].*$/, "")
    .replace(/[,;:.\u00ab\u00bb]+$/, "")
    .trim();
  // retire les professions et titres honorifiques en tête
  const hints = [...(PERSON_HINTS.fr || []), ...(PERSON_HINTS.en || [])].sort(
    (a, b) => b.length - a.length
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const h of hints) {
      const esc = h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp("^(l'|le |la |un |une )?" + esc + "\\s+", "i");
      if (re.test(name)) {
        name = name.replace(re, "");
        changed = true;
      }
    }
    const hon = /^(sir|dame|lord|lady|dr\.?|prof\.?|pr\.?|mister|mr\.?|mme|mlle|m\.){1}\s+/i;
    if (hon.test(name)) {
      name = name.replace(hon, "");
    }
  }
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0 || name.length < 4) return null;
  if (words.length === 1 && name.length < 5) return null;
  return name;
}

class RateLimited extends Error {}

async function wikiSearch(lang, query) {
  const url =
    "https://" + lang + ".wikipedia.org/w/api.php" +
    "?action=query&list=search&srlimit=5&format=json&origin=*" +
    "&srsearch=" + encodeURIComponent(query);
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Deathswatch/0.1 (veille d'actualité personnelle)" },
      });
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after")) * 1000 || 1500;
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, retryAfter));
          continue;
        }
        throw new RateLimited("wiki 429");
      }
      if (!res.ok) throw new Error("wiki http " + res.status);
      const json = await res.json();
      return (json.query && json.query.search ? json.query.search : []).map((s) => s.title);
    } catch (e) {
      if (e instanceof RateLimited) throw e;
      if (attempt === 1) throw e;
      // petite pause réseau puis second essai
      await new Promise((r) => setTimeout(r, 1200));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new RateLimited("wiki 429");
}

function titleMatches(wikiTitle, candidate) {
  if (/(homonymie|liste d|list of people|patronyme)/i.test(wikiTitle)) return false;
  const t = norm(wikiTitle).replace(/\(.+\)$/, "").trim();
  const c = norm(candidate);
  if (!c) return false;
  if (t === c) return true;
  // « Jean Dupont (footballeur) », variations d'accent…
  if (t.startsWith(c) && t.length - c.length <= 30) return true;
  return false;
}

// La page visée doit décrire UNE personne (pas une liste de porteurs du nom)
async function isSinglePersonPage(wikiTitle, lang) {
  if (/\([^)]*\)/.test(wikiTitle)) return true; // « X (acteur) » = personne précise
  const url =
    "https://" + lang + ".wikipedia.org/w/api.php" +
    "?action=query&prop=extracts&exintro&explaintext&redirects=1&format=json" +
    "&titles=" + encodeURIComponent(wikiTitle);
  const res = await fetch(url, { headers: { "User-Agent": "Deathswatch/0.1" } });
  if (!res.ok) return true; // non vérifiable : on accepte
  const json = await res.json();
  const pages = Object.values((json.query && json.query.pages) || {});
  const extract = (pages[0] && pages[0].extract) || "";
  const nonPerson =
    /est un nom de personne|nom de famille|nom porté par|page d'homonymie|peut désigner|répertorie|patronyme|list of people/i;
  return !nonPerson.test(extract);
}

/**
 * Retourne { notable, wikiTitle? } ou { notable:false, retry:true } quand
 * Wikipédia est momentanément indisponible (l'entrée sera réévaluée au
 * prochain cycle, l'article étant toujours présent dans les flux RSS).
 */
export async function isNotableByName(name, lang) {
  const key = lang + ":" + norm(name);
  if (cache.has(key)) return cache.get(key);

  let result;
  try {
    const quoted = '"' + name + '"';
    const langs = lang === "fr" ? ["fr", "en"] : ["en", "fr"];
    result = { notable: false };
    for (const wl of langs) {
      const titles = await throttled(() => wikiSearch(wl, quoted));
      const hits = titles.filter((t) => titleMatches(t, name));
      for (const hit of hits) {
        if (await isSinglePersonPage(hit, wl)) {
          result = { notable: true, wikiTitle: hit };
          break;
        }
      }
      if (result.wikiTitle) break;
    }
    cache.set(key, result); // uniquement les verdicts définitifs
  } catch (e) {
    console.error("[notability] attente pour", name, ":", e.message);
    result = { notable: false, retry: true }; // réessai au prochain cycle
  }

  return result;
}
