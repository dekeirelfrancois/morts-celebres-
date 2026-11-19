import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PORT } from "./config.js";
import { list, size } from "./store.js";
import { startPolling, pollOnce, onNewEntries } from "./poller.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, entries: size() });
});

app.get("/api/deaths", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const minScore = Number(req.query.minScore) || 0;
  res.json({ items: list({ limit, minScore }) });
});

app.get("/api/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(`retry: 10000\n\n`);
  res.write(`event: hello\ndata: ${JSON.stringify({ entries: size() })}\n\n`);

  const send = (entries) => {
    for (const entry of entries) {
      res.write(`event: death\ndata: ${JSON.stringify(entry)}\n\n`);
    }
  };

  const unsubscribe = onNewEntries(send);
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

app.post("/api/poll", async (_req, res) => {
  try {
    res.json(await pollOnce());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Deathswatch backend listening on http://localhost:${PORT}`);
  startPolling();
});
