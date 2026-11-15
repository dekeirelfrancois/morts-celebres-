import { RETENTION_HOURS } from "./config.js";

const entries = new Map();

export function upsertMany(newEntries) {
  const added = [];
  for (const entry of newEntries) {
    if (!entry.matched) continue;
    if (entries.has(entry.id)) continue;
    entries.set(entry.id, entry);
    added.push(entry);
  }
  prune();
  return added;
}

export function list({ limit = 50, minScore = 0 } = {}) {
  return [...entries.values()]
    .filter((e) => e.score >= minScore)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt) || b.score - a.score)
    .slice(0, limit);
}

function prune() {
  const cutoff = Date.now() - RETENTION_HOURS * 3600 * 1000;
  for (const [id, entry] of entries) {
    if (new Date(entry.publishedAt).getTime() < cutoff) entries.delete(id);
  }
}

export function size() {
  return entries.size;
}
