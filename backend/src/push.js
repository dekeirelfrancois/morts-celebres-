import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const webpush = require("web-push");

let configured = false;
const subscriptions = new Set();

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:deathswatch@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
  console.log("[push] notifications configurées");
} else {
  console.warn(
    "[push] clés VAPID absentes (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) — notifications désactivées"
  );
}

export function isPushConfigured() {
  return configured;
}

export function getPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export function addSubscription(subscription) {
  subscriptions.add(subscription);
  return subscriptions.size;
}

export function removeSubscription(subscription) {
  subscriptions.delete(subscription);
  return subscriptions.size;
}

export function subscriberCount() {
  return subscriptions.size;
}

export async function sendTestMessage() {
  return sendToAll({
    title: "Test Deathswatch",
    body: "Les notifications sont opérationnelles 🎉",
    url: "/",
    source: "système",
  });
}

export async function sendToAll(entry) {
  if (!configured) return { sent: 0, dropped: 0, skipped: "not-configured" };

  const payload = JSON.stringify({
    title: "Deathswatch",
    body: entry.title,
    url: entry.link || "/",
    source: entry.source,
  });

  let sent = 0;
  let dropped = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, payload);
      sent += 1;
    } catch (e) {
      const status = e.statusCode;
      if (status === 404 || status === 410) {
        subscriptions.delete(sub);
        dropped += 1;
      } else {
        console.error("[push] échec d'envoi:", status || e.message);
      }
    }
  }

  return { sent, dropped, subscribers: subscriptions.size };
}
