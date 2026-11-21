import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PORT } from "./config.js";
import { list, size } from "./store.js";
import { startPolling, pollOnce, onNewEntries } from "./poller.js";
import * as push from "./push.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, entries: size(), subscribers: push.subscriberCount() });
});

app.get("/api/push-key", (_req, res) => {
  const key = push.getPublicKey();
  if (!key) return res.status(503).json({ error: "push non configuré" });
  res.json({ publicKey: key });
});

app.post("/api/subscribe", (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "abonnement invalide" });
  }
  const count = push.addSubscription(subscription);
  console.log(`[push] abonnés: ${count}`);
  res.json({ ok: true, subscribers: count });
});

app.post("/api/unsubscribe", (req, res) => {
  const removed = push.removeSubscription(req.body);
  res.json({ ok: true, subscribers: removed });
});

app.post("/api/test-push", async (_req, res) => {
  const result = await push.sendTestMessage();
  if (result.skipped) {
    return res.status(503).json({ error: "push non configuré" });
  }
  console.log(`[push] test: ${result.sent} envoyé(s), ${result.dropped} supprimé(s), abonnés: ${result.subscribers}`);
  res.json(result);
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
  onNewEntries((entries) => {
    for (const entry of entries) {
      push
        .sendToAll(entry).then((r) => {
        if (r.sent || r.dropped) {
          console.log(`[push] ${r.sent} envoyé(s), ${r.dropped} abonnement(s) supprimé(s)`);
        }
      }).catch((e) => console.error("[push] exception:", e.message));
    }
  });
});
