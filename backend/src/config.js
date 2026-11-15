export const PORT = process.env.PORT || 3000;

export const FEEDS = [
  {
    name: "Le Monde",
    url: "https://www.lemonde.fr/rss/une.xml",
    lang: "fr",
  },
  {
    name: "Le Figaro",
    url: "https://www.lefigaro.fr/rss/figaro_actualites.xml",
    lang: "fr",
  },
  {
    name: "Libération",
    url: "https://www.liberation.fr/rss/une/",
    lang: "fr",
  },
  {
    name: "France Info",
    url: "https://www.francetvinfo.fr/titres.rss",
    lang: "fr",
  },
  {
    name: "20 Minutes",
    url: "https://www.20minutes.fr/feeds/rss-une.xml",
    lang: "fr",
  },
  {
    name: "Ouest-France",
    url: "https://www.ouest-france.fr/rss-en-continu.xml",
    lang: "fr",
  },
  {
    name: "BBC World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    lang: "en",
  },
  {
    name: "Reuters World",
    url: "https://www.reutersagency.com/feed/?best-topics=obituaries&post_type=best",
    lang: "en",
  },
];

export const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 5 * 60 * 1000);

export const RETENTION_HOURS = Number(process.env.RETENTION_HOURS || 72);

export const DEATH_KEYWORDS = {
  fr: [
    "est mort",
    "est décédé",
    "décès de",
    "décès d'",
    "mort de",
    "mort d'",
    "vient de mourir",
    "s'est éteint",
    "s'est éteinte",
    "nécrologie",
    "disparition de",
    "disparition d'",
    "adieu à",
    "hommage à",
    "rend hommage",
    "n'est plus",
  ],
  en: [
    "dies at",
    "died at",
    "has died",
    "death of",
    "obituary",
    "passes away",
    "passed away",
    "mourns the death",
  ],
};

export const PERSON_HINTS = {
  fr: [
    "acteur", "actrice", "chanteur", "chanteuse", "musicien", "musicienne",
    "écrivain", "romancier", "romancière", "réalisateur", "réalisatrice",
    "politique", "ministre", "député", "sénateur", "maire", "président",
    "premier ministre", "scientifique", "chercheur", "chercheuse",
    "historien", "historienne", "journaliste", "animateur", "animatrice",
    "sportif", "sportive", "footballeur", "tennisman", "artiste",
    "comédien", "comédienne", "humoriste", "dessinateur", "philosophe",
    "prix nobel", "académicien", "peintre", "photographe", "architecte",
  ],
  en: [
    "actor", "actress", "singer", "musician", "writer", "author",
    "director", "politician", "minister", "president", "scientist",
    "journalist", "athlete", "footballer", "player", "artist",
    "comedian", "novelist", "historian", "nobel", "painter",
    "photographer", "architect", "philosopher", "legend", "star",
  ],
};

export const STRONG_OBIT_KEYWORDS = [
  "nécrologie",
  "obituary",
  "mort de",
  "mort d'",
  "décès de",
  "décès d'",
  "death of",
  "has died",
  "est décédé",
  "est mort",
];

export const NEGATIVE_PATTERNS = [
  /procès/i,
  /enquête sur la mort/i,
  /meurtre/i,
  /assassin/i,
  /accident.{0,40}(mort|décès)/i,
  /guerre/i,
  /attentat/i,
  /bilan/i,
  /tué/i,
  /victime/i,
  /drame/i,
  /suicide/i,
  /condamné/i,
  /marche blanche/i,
  /conjoint/i,
];
