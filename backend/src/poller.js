import Parser from "rss-parser";
import { FEEDS, POLL_INTERVAL_MS } from "./config.js";
import { buildEntry } from "./filter.js";
import { upsertMany } from "./store.js";

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
  },
});
const listeners = new Set();

export function onNewEntries(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function pollOnce() {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return Promise.all(parsed.items.map((item) => buildEntry(item, feed)));
    })
  );

  const all = [];
  const errors = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
    else errors.push(String(r.reason?.message || r.reason));
  }

  const added = upsertMany(all);
  if (added.length > 0) {
    for (const fn of listeners) {
      try {
        fn(added);
      } catch (e) {
        console.error("listener error:", e.message);
      }
    }
  }

  return { fetched: all.length, added: added.length, errors };
}

export function startPolling() {
  const run = async () => {
    try {
      const stats = await pollOnce();
      console.log(
        `[poll] fetched=${stats.fetched} added=${stats.added}` +
          (stats.errors.length ? ` errors=${stats.errors.length}` : "")
      );
    } catch (e) {
      console.error("[poll] failed:", e.message);
    }
  };

  run();
  setInterval(run, POLL_INTERVAL_MS);
}
