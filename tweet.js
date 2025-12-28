import "dotenv/config";
import fetch from "node-fetch";
import fs from "fs";
import { TwitterApi } from "twitter-api-v2";

/* ================= CONFIG ================= */

const POLLINATIONS_URL = "https://gen.pollinations.ai/text/";
const POLLINATIONS_MODEL = "openai-fast";
const POLLINATIONS_SYSTEM = "You are helpful";
// NOTE: This is the public token used on pollinations.ai; replace with your own if needed.
const POLLINATIONS_TOKEN = "pk_WQYvjz9SpSpAcJdR";
const POLLINATIONS_ORIGIN = "https://pollinations.ai";
const POLLINATIONS_REFERER = "https://pollinations.ai/";
const POLLINATIONS_TIMEOUT_MS = Number.parseInt(
  process.env.POLLINATIONS_TIMEOUT_MS || "45000",
  10
);
const POLLINATIONS_RETRIES = Number.parseInt(
  process.env.POLLINATIONS_RETRIES || "2",
  10
);
const HN_TOP_STORY = "https://hacker-news.firebaseio.com/v0/topstories.json";
const HN_BEST_STORY = "https://hacker-news.firebaseio.com/v0/beststories.json";
const HN_ITEM = "https://hacker-news.firebaseio.com/v0/item";
const GH_TRENDING = "https://github.com/trending?since=daily";

const FEEDS = [
  {
    name: "Cloudflare Blog",
    url: "https://blog.cloudflare.com/rss/",
    category: "evergreen",
  },
  {
    name: "Stripe Blog",
    url: "https://stripe.com/blog/rss",
    category: "evergreen",
  },
  {
    name: "Netflix Tech Blog",
    url: "https://netflixtechblog.com/feed",
    category: "evergreen",
  },
  {
    name: "AWS Architecture Blog",
    url: "https://aws.amazon.com/blogs/architecture/feed/",
    category: "evergreen",
  },
  {
    name: "ArXiv cs.SE",
    url: "https://export.arxiv.org/api/query?search_query=cat:cs.SE&sortBy=lastUpdatedDate&sortOrder=descending&max_results=6",
    category: "evergreen",
  },
  {
    name: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
    category: "trending",
  },
];

const DEFAULT_HEADERS = {
  "user-agent": "daily-tech-tweet/1.0",
};

const MAX_TWEET_LENGTH = 240;
const LINK_LENGTH = 24;
const INCLUDE_LINKS = process.env.INCLUDE_LINKS !== "false";
const INCLUDE_IMAGES = process.env.INCLUDE_IMAGES !== "false";
const MAX_TEXT_LENGTH = INCLUDE_LINKS
  ? MAX_TWEET_LENGTH - LINK_LENGTH - 1
  : MAX_TWEET_LENGTH;
const MAX_IMAGE_BYTES = 5_000_000;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif"]);
const POSTED_PATH = process.env.POSTED_PATH || "posted.json";
const POSTED_LOOKBACK_DAYS = 14;
const TWEET_SIMILARITY_THRESHOLD = 0.6;
const CATEGORY_WEIGHTS = { evergreen: 0.7, trending: 0.3 };
const DIVERSITY_LOOKBACK = 5;
const CATEGORY_BALANCE_THRESHOLD = 2;
const CATEGORY_BALANCE_SHIFT = 0.2;
const THREAD_PROBABILITY = Number.parseFloat(
  process.env.THREAD_PROBABILITY || "0.3"
);
const THREAD_MIN_TWEETS = 2;
const THREAD_MAX_TWEETS = 3;
const TOPIC_DOMAINS = new Set([
  "aws.amazon.com",
  "blog.cloudflare.com",
  "cloudflare.com",
  "docs.github.com",
  "github.com",
  "kubernetes.io",
  "netflixtechblog.com",
  "openai.com",
  "postgresql.org",
  "react.dev",
  "rust-lang.org",
  "stripe.com",
  "www.postgresql.org",
  "arxiv.org",
  "theverge.com",
]);
const TOPIC_KEYWORDS = [
  "api",
  "sdk",
  "cli",
  "database",
  "db",
  "postgres",
  "mysql",
  "redis",
  "cache",
  "latency",
  "throughput",
  "scalability",
  "scale",
  "distributed",
  "consensus",
  "raft",
  "paxos",
  "kubernetes",
  "k8s",
  "docker",
  "container",
  "linux",
  "kernel",
  "compiler",
  "runtime",
  "vm",
  "garbage collector",
  "gc",
  "observability",
  "logging",
  "metrics",
  "tracing",
  "sre",
  "devops",
  "infrastructure",
  "infra",
  "cloud",
  "aws",
  "gcp",
  "azure",
  "serverless",
  "microservice",
  "monolith",
  "frontend",
  "backend",
  "full stack",
  "node",
  "react",
  "rust",
  "go",
  "python",
  "typescript",
  "javascript",
  "security",
  "encryption",
  "vulnerability",
  "cve",
  "auth",
  "oauth",
  "jwt",
  "performance",
  "benchmark",
  "ci",
  "cd",
  "ci/cd",
  "deployment",
  "release",
  "incident",
  "postmortem",
  "outage",
  "availability",
  "reliability",
  "testing",
  "qa",
  "feature flag",
  "rollout",
  "ml",
  "ai",
  "llm",
  "model",
  "training",
  "data",
  "pipeline",
  "etl",
  "analytics",
  "streaming",
  "kafka",
  "queue",
  "messaging",
  "http",
  "tcp",
  "dns",
  "cdn",
  "edge",
  "load balancer",
  "proxy",
  "rpc",
  "grpc",
  "graphql",
  "mobile",
  "ios",
  "android",
  "git",
  "open source",
  "oss",
  "license",
  "launch",
  "patch",
  "update",
  "roadmap",
  "announcement",
];
const STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "all",
  "also",
  "and",
  "any",
  "are",
  "as",
  "at",
  "because",
  "been",
  "before",
  "being",
  "between",
  "both",
  "but",
  "can",
  "could",
  "did",
  "does",
  "doing",
  "for",
  "from",
  "had",
  "has",
  "have",
  "having",
  "how",
  "into",
  "its",
  "just",
  "like",
  "more",
  "most",
  "new",
  "not",
  "now",
  "off",
  "our",
  "out",
  "over",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "too",
  "use",
  "used",
  "using",
  "very",
  "via",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "without",
  "you",
  "your",
]);
const VAGUE_PHRASES = [
  "game changer",
  "cutting edge",
  "paradigm shift",
  "next level",
  "in today's world",
  "at the end of the day",
  "revolutionary",
  "future-proof",
  "world-class",
];
const SECTION_LABEL_REGEX = /\b(observation|tradeoff|takeaway)\b\s*[:\-]/i;

const DRY_RUN = process.env.DRY_RUN === "true";
const DRY_RUN_SAVE = process.env.DRY_RUN_SAVE !== "false";

/* ================= SAFETY ================= */

if (!DRY_RUN) {
  const required = [
    "X_API_KEY",
    "X_API_SECRET",
    "X_ACCESS_TOKEN",
    "X_ACCESS_SECRET",
  ];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required env variable: ${key}`);
    }
  }
}

/* ================= TWITTER ================= */

const twitter = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

/* ================= HELPERS ================= */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { ...DEFAULT_HEADERS, ...(options.headers || {}) };

  try {
    return await fetch(url, { ...options, headers, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeFetchError(err, url, timeoutMs) {
  if (err?.name === "AbortError") {
    return new Error(`Timeout after ${timeoutMs}ms for ${url}`);
  }
  return err;
}

function parseRetryAfterMs(res, attempt) {
  const value = res.headers.get("retry-after");
  if (value) {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(value);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return Math.min(8000, 1000 * attempt);
}

async function fetchJson(url, { retries = 2, timeoutMs = 10000 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url, {}, timeoutMs);
      if (res.ok) return await res.json();
      if (res.status === 429 && attempt < retries) {
        await sleep(parseRetryAfterMs(res, attempt));
        continue;
      }
      throw new Error(`HTTP ${res.status} for ${url}`);
    } catch (err) {
      lastError = normalizeFetchError(err, url, timeoutMs);
      if (attempt < retries) {
        await sleep(400 * attempt);
      }
    }
  }

  throw lastError;
}

async function fetchText(
  url,
  { retries = 2, timeoutMs = 10000, headers } = {}
) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url, { headers }, timeoutMs);
      if (res.ok) return await res.text();
      if (res.status === 429 && attempt < retries) {
        await sleep(parseRetryAfterMs(res, attempt));
        continue;
      }
      throw new Error(`HTTP ${res.status} for ${url}`);
    } catch (err) {
      lastError = normalizeFetchError(err, url, timeoutMs);
      if (attempt < retries) {
        await sleep(400 * attempt);
      }
    }
  }

  throw lastError;
}

function buildPollinationsUrl(prompt) {
  const params = new URLSearchParams({
    model: POLLINATIONS_MODEL,
  });
  if (POLLINATIONS_SYSTEM) {
    params.set("system", POLLINATIONS_SYSTEM);
  }
  return `${POLLINATIONS_URL}${encodeURIComponent(
    prompt
  )}?${params.toString()}`;
}

function pollinationsHeaders() {
  const headers = {};
  if (POLLINATIONS_TOKEN) {
    headers.authorization = `Bearer ${POLLINATIONS_TOKEN}`;
  }
  if (POLLINATIONS_ORIGIN) headers.origin = POLLINATIONS_ORIGIN;
  if (POLLINATIONS_REFERER) headers.referer = POLLINATIONS_REFERER;
  return Object.keys(headers).length ? headers : undefined;
}

async function generateFromPollinations(prompt) {
  const url = buildPollinationsUrl(prompt);
  return fetchText(url, {
    timeoutMs: POLLINATIONS_TIMEOUT_MS,
    retries: POLLINATIONS_RETRIES,
    headers: pollinationsHeaders(),
  });
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, "");
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function cleanText(value) {
  if (!value) return "";
  return decodeHtmlEntities(stripTags(String(value)))
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value, maxLength) {
  const text = cleanText(value);
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function normalizeTweet(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractKeywords(text, max = 6) {
  const words = cleanText(text)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ");
  const parts = words.split(/\s+/).filter(Boolean);
  const unique = [];
  const seen = new Set();

  for (const part of parts) {
    if (part.length < 4 || STOPWORDS.has(part) || seen.has(part)) continue;
    seen.add(part);
    unique.push(part);
    if (unique.length >= max) break;
  }

  return unique;
}

function signalKeywords(signal) {
  if (!signal) return [];
  if (signal.source === "GitHub Trending") {
    return extractKeywords(
      [signal.summary, signal.language].filter(Boolean).join(" ")
    );
  }
  return extractKeywords(
    [signal.title, signal.summary].filter(Boolean).join(" ")
  );
}

function tweetHasSignalKeyword(tweet, signal) {
  const keywords = signalKeywords(signal);
  if (!keywords.length) return true;
  return keywords.some((keyword) =>
    new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i").test(tweet)
  );
}

function findVaguePhrase(tweet) {
  const lower = tweet.toLowerCase();
  return VAGUE_PHRASES.find((phrase) => lower.includes(phrase)) || null;
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch (err) {
    return null;
  }
}

function matchesTopicKeywords(text) {
  const value = cleanText(text).toLowerCase();
  if (!value) return false;

  for (const keyword of TOPIC_KEYWORDS) {
    if (keyword.includes(" ")) {
      if (value.includes(keyword)) return true;
      continue;
    }

    const regex = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i");
    if (regex.test(value)) return true;
  }

  return false;
}

function isOnTopic(signal) {
  const domain = signal.url ? hostnameFromUrl(signal.url) : null;
  if (domain) {
    for (const allowed of TOPIC_DOMAINS) {
      if (domain === allowed || domain.endsWith(`.${allowed}`)) return true;
    }
  }

  const text = [signal.title, signal.summary].filter(Boolean).join(" ");
  return matchesTopicKeywords(text);
}

function extractHtmlAttr(tag, attr) {
  const regex = new RegExp(`\\b${attr}\\s*=\\s*["']([^"']+)["']`, "i");
  const match = tag.match(regex);
  if (!match) return null;
  return cleanText(match[1]);
}

function resolveUrl(base, maybeRelative) {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, base).toString();
  } catch (err) {
    return maybeRelative;
  }
}

function extractMetaImage(html, pageUrl) {
  const tags = html.match(/<meta[^>]+>/gi) || [];
  for (const tag of tags) {
    const key =
      extractHtmlAttr(tag, "property") || extractHtmlAttr(tag, "name");
    if (!key) continue;
    if (!/^og:image$|^twitter:image$/i.test(key)) continue;
    const content = extractHtmlAttr(tag, "content");
    if (content) return resolveUrl(pageUrl, content);
  }
  return null;
}

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  if (!match) return null;
  return cleanText(match[1]);
}

function extractAttr(xml, tag, attr) {
  const regex = new RegExp(`<${tag}[^>]*\\b${attr}="([^"]+)"[^>]*>`, "i");
  const match = xml.match(regex);
  if (!match) return null;
  return cleanText(match[1]);
}

function toIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseRssItems(xml, limit = 6) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const itemXml = match[1];
    const title = extractTag(itemXml, "title");
    const link = extractTag(itemXml, "link") || extractTag(itemXml, "guid");
    const pubDate =
      extractTag(itemXml, "pubDate") || extractTag(itemXml, "dc:date");
    const summary =
      extractTag(itemXml, "description") ||
      extractTag(itemXml, "content:encoded");
    const imageUrl =
      extractAttr(itemXml, "media:content", "url") ||
      extractAttr(itemXml, "media:thumbnail", "url") ||
      extractAttr(itemXml, "enclosure", "url");

    if (!title || !link) continue;

    items.push({
      title,
      link,
      publishedAt: pubDate,
      summary,
      imageUrl,
    });
  }

  return items;
}

function parseAtomEntries(xml, limit = 6) {
  const items = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match;

  while ((match = entryRegex.exec(xml)) !== null && items.length < limit) {
    const entryXml = match[1];
    const title = extractTag(entryXml, "title");
    let link = extractAttr(entryXml, "link", "href");

    if (!link) {
      const linkMatch = entryXml.match(
        /<link[^>]*rel="alternate"[^>]*href="([^"]+)"[^>]*>/i
      );
      if (linkMatch) {
        link = cleanText(linkMatch[1]);
      }
    }

    const enclosureMatch = entryXml.match(
      /<link[^>]*rel="enclosure"[^>]*href="([^"]+)"[^>]*>/i
    );
    const imageUrl =
      extractAttr(entryXml, "media:content", "url") ||
      extractAttr(entryXml, "media:thumbnail", "url") ||
      (enclosureMatch ? cleanText(enclosureMatch[1]) : null);

    const summary =
      extractTag(entryXml, "summary") || extractTag(entryXml, "content");
    const publishedAt =
      extractTag(entryXml, "published") || extractTag(entryXml, "updated");

    if (!title || !link) continue;

    items.push({
      title,
      link,
      publishedAt,
      summary,
      imageUrl,
    });
  }

  return items;
}

function parseFeed(xml) {
  if (/<feed[\s>]/i.test(xml) && /<entry>/i.test(xml)) {
    return parseAtomEntries(xml);
  }
  return parseRssItems(xml);
}

function buildFingerprint(text) {
  const words = cleanText(text)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ");
  const parts = words.split(/\s+/).filter(Boolean);
  const unique = [];
  const seen = new Set();

  for (const part of parts) {
    if (part.length < 3 || seen.has(part)) continue;
    seen.add(part);
    unique.push(part);
    if (unique.length >= 12) break;
  }

  return unique.join(" ");
}

function similarityScore(a, b) {
  if (!a || !b) return 0;
  const setA = new Set(a.split(" "));
  const setB = new Set(b.split(" "));
  if (!setA.size || !setB.size) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection += 1;
  }
  const union = new Set([...setA, ...setB]).size;
  return union ? intersection / union : 0;
}

function buildTweetFingerprint(text) {
  return buildFingerprint(cleanText(text)).slice(0, 80);
}

function isTweetTooSimilar(tweet, posted) {
  const fingerprint = buildTweetFingerprint(tweet);
  if (!fingerprint) return false;

  return posted.some((entry) => {
    const compare =
      entry.tweetFingerprint ||
      (entry.tweet ? buildTweetFingerprint(entry.tweet) : "");
    if (!compare) return false;
    return similarityScore(compare, fingerprint) >= TWEET_SIMILARITY_THRESHOLD;
  });
}

function getRecentPosted(posted, days = POSTED_LOOKBACK_DAYS) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return posted.filter((entry) => {
    const timestamp = Date.parse(entry.date);
    return Number.isFinite(timestamp) && timestamp >= cutoff;
  });
}

function isStale(signal, maxAgeDays = 30) {
  if (!signal.publishedAt) return false;
  const timestamp = Date.parse(signal.publishedAt);
  if (!Number.isFinite(timestamp)) return false;
  const ageDays = (Date.now() - timestamp) / (24 * 60 * 60 * 1000);
  return ageDays > maxAgeDays;
}

function isDuplicate(signal, posted) {
  const fingerprint = buildFingerprint(signal.title);
  return posted.some((entry) => {
    if (entry.sourceId && entry.sourceId === signal.id) return true;
    if (entry.url && signal.url && entry.url === signal.url) return true;
    if (entry.fingerprint) {
      return similarityScore(entry.fingerprint, fingerprint) >= 0.6;
    }
    return false;
  });
}

function scoreSignal(signal) {
  let score = 0;

  if (signal.publishedAt) {
    const ageHours =
      (Date.now() - Date.parse(signal.publishedAt)) / (60 * 60 * 1000);
    score += Math.max(0, 72 - ageHours);
  }

  if (signal.category === "trending") score += 20;
  if (signal.source === "HN Best") score += 5;

  return score;
}

function pickWeighted(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let target = Math.random() * total;

  for (const [key, weight] of entries) {
    if (target < weight) return key;
    target -= weight;
  }

  return entries[0]?.[0] || "evergreen";
}

function getBalancedCategoryWeights(recentPosted) {
  const weights = { ...CATEGORY_WEIGHTS };
  const recent = recentPosted.slice(-DIVERSITY_LOOKBACK);
  if (!recent.length) return weights;

  const counts = { evergreen: 0, trending: 0 };
  for (const entry of recent) {
    if (entry.category === "evergreen") counts.evergreen += 1;
    if (entry.category === "trending") counts.trending += 1;
  }

  const diff = counts.trending - counts.evergreen;
  if (Math.abs(diff) < CATEGORY_BALANCE_THRESHOLD) return weights;

  if (diff > 0) {
    weights.evergreen += CATEGORY_BALANCE_SHIFT;
    weights.trending = Math.max(0.05, weights.trending - CATEGORY_BALANCE_SHIFT);
  } else {
    weights.trending += CATEGORY_BALANCE_SHIFT;
    weights.evergreen = Math.max(0.05, weights.evergreen - CATEGORY_BALANCE_SHIFT);
  }

  return weights;
}

function getRecentSources(recentPosted) {
  const recent = recentPosted.slice(-DIVERSITY_LOOKBACK);
  const sources = new Set();
  for (const entry of recent) {
    if (entry.source) sources.add(entry.source);
  }
  return sources;
}

function selectSignal(signals, posted) {
  const recent = getRecentPosted(posted);
  const candidates = signals.filter(
    (signal) =>
      signal.title &&
      isOnTopic(signal) &&
      !isStale(signal) &&
      !isDuplicate(signal, recent)
  );

  if (!candidates.length) return null;

  const recentSources = getRecentSources(recent);
  const diverseCandidates = candidates.filter(
    (signal) => !recentSources.has(signal.source)
  );
  const sourcePool = diverseCandidates.length ? diverseCandidates : candidates;
  const desiredCategory = pickWeighted(getBalancedCategoryWeights(recent));
  const byCategory = sourcePool.filter(
    (signal) => signal.category === desiredCategory
  );
  const pool = byCategory.length ? byCategory : sourcePool;

  return pool.sort((a, b) => scoreSignal(b) - scoreSignal(a))[0];
}

async function getHnSignals(listUrl, source, category, limit = 8) {
  try {
    const ids = await fetchJson(listUrl);
    const signals = [];

    for (const id of ids.slice(0, 20)) {
      const item = await fetchJson(`${HN_ITEM}/${id}.json`);
      if (!item?.title) continue;

      signals.push({
        id: `hn:${id}`,
        title: cleanText(item.title),
        summary: item.text ? cleanText(item.text) : "",
        url: item.url || `https://news.ycombinator.com/item?id=${id}`,
        source,
        category,
        publishedAt: item.time
          ? new Date(item.time * 1000).toISOString()
          : null,
      });

      if (signals.length >= limit) break;
    }

    return signals;
  } catch (err) {
    return [];
  }
}

async function getGithubTrendingSignals(limit = 8) {
  try {
    const html = await fetchText(GH_TRENDING);
    const signals = [];
    const articleRegex = /<article[\s\S]*?<\/article>/gi;
    let match;

    while (
      (match = articleRegex.exec(html)) !== null &&
      signals.length < limit
    ) {
      const block = match[0];
      const repoMatch = block.match(
        /<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i
      );
      if (!repoMatch) continue;

      const href = repoMatch[1];
      const text = cleanText(repoMatch[2]);
      const repoPath = href.split("?")[0].replace(/^\//, "");

      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repoPath)) continue;

      const descriptionMatch = block.match(
        /<p[^>]*class="[^"]*color-fg-muted[^"]*"[^>]*>([\s\S]*?)<\/p>/i
      );
      const summary = descriptionMatch ? cleanText(descriptionMatch[1]) : "";
      const languageMatch = block.match(
        /<span[^>]*itemprop="programmingLanguage"[^>]*>([^<]+)<\/span>/i
      );
      const language = languageMatch ? cleanText(languageMatch[1]) : "";
      const imageUrl = `https://opengraph.githubassets.com/1/${repoPath}`;

      signals.push({
        id: `gh:${repoPath}`,
        title: text || repoPath,
        summary,
        language,
        url: `https://github.com/${repoPath}`,
        imageUrl,
        source: "GitHub Trending",
        category: "trending",
        publishedAt: new Date().toISOString(),
      });
    }

    return signals;
  } catch (err) {
    return [];
  }
}

async function getFeedSignals(feed, limit = 6) {
  try {
    const xml = await fetchText(feed.url, { timeoutMs: 12000 });
    const items = parseFeed(xml, limit);

    return items.map((item) => ({
      id: `feed:${feed.name}:${buildFingerprint(item.title)}`,
      title: cleanText(item.title),
      summary: cleanText(item.summary || ""),
      url: item.link,
      imageUrl: item.imageUrl ? resolveUrl(item.link, item.imageUrl) : null,
      source: feed.name,
      category: feed.category,
      publishedAt: toIsoDate(item.publishedAt),
    }));
  } catch (err) {
    return [];
  }
}

async function collectSignals() {
  const tasks = [
    getHnSignals(HN_TOP_STORY, "HN Top", "trending"),
    getHnSignals(HN_BEST_STORY, "HN Best", "evergreen"),
    getGithubTrendingSignals(),
    ...FEEDS.map((feed) => getFeedSignals(feed)),
  ];

  const results = await Promise.allSettled(tasks);
  const signals = [];

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.length) {
      signals.push(...result.value);
    }
  }

  return signals;
}

function estimateTweetLength(text, url) {
  if (!INCLUDE_LINKS || !url) return text.length;
  return text.length + 1 + LINK_LENGTH;
}

function appendLink(text, url) {
  if (!INCLUDE_LINKS || !url) return text;
  return `${text} ${url}`.trim();
}

async function resolveSignalImage(signal) {
  if (!INCLUDE_IMAGES) return null;
  if (signal.imageUrl) return signal.imageUrl;
  if (!signal.url) return null;

  try {
    const html = await fetchText(signal.url, { timeoutMs: 12000, retries: 1 });
    return extractMetaImage(html, signal.url);
  } catch (err) {
    return null;
  }
}

async function uploadImageFromUrl(imageUrl) {
  if (!imageUrl || !INCLUDE_IMAGES) return null;

  try {
    const res = await fetchWithTimeout(imageUrl, {}, 15000);
    if (!res.ok) return null;

    const contentLength = Number(res.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      return null;
    }

    const rawType = res.headers.get("content-type") || "";
    const mimeType = rawType.split(";")[0].trim().toLowerCase();
    if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) return null;

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) return null;

    const buffer = Buffer.from(arrayBuffer);
    return await twitter.v1.uploadMedia(buffer, { mimeType });
  } catch (err) {
    return null;
  }
}

function buildPrompt(signal, guidance) {
  const extra = guidance ? `\n${guidance}` : "";
  const summaryText = truncateText(signal.summary, 220);
  const summary = summaryText ? `Summary: ${summaryText}\n` : "";
  const language = signal.language
    ? `Stack/Language: ${signal.language}\n`
    : "";
  const guard =
    "\nDo not mention the source name. Do not repeat the title verbatim; paraphrase it.";
  const repoGuard =
    signal.source === "GitHub Trending"
      ? " Avoid listing the repo owner/name."
      : "";

  return `
Write one original tweet.

Voice: senior engineer with social media personality; crisp, confident, slightly punchy.
Style: minimal, pragmatic, memorable.
Goal: hook -> context -> actionable takeaway (one sentence if possible).
Open with a decisive claim or contrast. No section labels.
Be specific: include one concrete detail and 1-2 key terms from the title/summary.
Avoid vague phrasing and hedging.

Constraints:
- Under ${MAX_TEXT_LENGTH} characters
- No emojis, hashtags, questions, or links in the text

Do not mention the source or repeat the title verbatim. No labels like "Observation:" or "Tradeoff:".${extra}${guard}${repoGuard}
A source link will be appended after the text.

Signal:
Title: ${signal.title}
${summary}${language}Source: ${signal.source}
Category: ${signal.category}
`.trim();
}

function buildThreadPrompt(signal, guidance, count) {
  const extra = guidance ? `\n${guidance}` : "";
  const summaryText = truncateText(signal.summary, 200);
  const summary = summaryText ? `Summary: ${summaryText}\n` : "";
  const language = signal.language
    ? `Stack/Language: ${signal.language}\n`
    : "";
  const guard =
    "\nDo not mention the source name. Do not repeat the title verbatim; paraphrase it.";
  const repoGuard =
    signal.source === "GitHub Trending"
      ? " Avoid listing the repo owner/name."
      : "";
  const arc =
    count === 2
      ? "Thread arc:\n- Tweet 1: hook with concrete detail\n- Tweet 2: tradeoff -> actionable takeaway"
      : "Thread arc:\n- Tweet 1: hook with concrete detail\n- Tweet 2: tradeoff\n- Tweet 3: actionable takeaway";

  return `
Write a short tweet thread of ${count} tweets.

Voice: senior engineer with social media personality; crisp, confident, slightly punchy.
Style: minimal, pragmatic, memorable.
Goal: hook -> context -> actionable takeaway across the thread.
Open with a decisive claim or contrast. No section labels.
Be specific: include one concrete detail and 1-2 key terms from the title/summary.
Avoid vague phrasing and hedging.

Constraints:
- Output exactly ${count} lines, one tweet per line
- Prefix each line with "1/${count} ", "2/${count} ", etc.
- Under ${MAX_TEXT_LENGTH} characters per line
- No emojis, hashtags, questions, or links in the text

${arc}
Do not mention the source or repeat the title verbatim. No labels like "Observation:" or "Tradeoff:".${extra}${guard}${repoGuard}
A source link will be appended to the first tweet.

Signal:
Title: ${signal.title}
${summary}${language}Source: ${signal.source}
Category: ${signal.category}
`.trim();
}

function normalizeThreadLine(line, index, count) {
  let text = line.trim();
  text = text.replace(/^\d+\s*\/\s*\d+\s+/, "");
  const prefix = `${index + 1}/${count} `;
  return normalizeTweet(`${prefix}${text}`);
}

function parseThread(text, count) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length !== count) return null;
  return lines.map((line, index) => normalizeThreadLine(line, index, count));
}

function shouldGenerateThread() {
  if (!Number.isFinite(THREAD_PROBABILITY) || THREAD_PROBABILITY <= 0) {
    return false;
  }
  return Math.random() < Math.min(THREAD_PROBABILITY, 1);
}

function pickThreadLength() {
  const min = Math.min(THREAD_MIN_TWEETS, THREAD_MAX_TWEETS);
  const max = Math.max(THREAD_MIN_TWEETS, THREAD_MAX_TWEETS);
  if (min === max) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

async function generateTweet(signal, guidance) {
  const prompt = buildPrompt(signal, guidance);
  const res = await generateFromPollinations(prompt);

  return normalizeTweet(res);
}

async function generateThread(signal, guidance, count) {
  const prompt = buildThreadPrompt(signal, guidance, count);
  const res = await generateFromPollinations(prompt);
  return parseThread(res, count);
}

function validateTweetText(tweet, signal, { requireKeyword = true } = {}) {
  if (!tweet) return "Output is empty.";
  if (tweet.length > MAX_TEXT_LENGTH) {
    return `Keep it under ${MAX_TEXT_LENGTH} characters.`;
  }
  if (/#/.test(tweet)) return "Remove hashtags.";
  if (/\?/.test(tweet)) return "Remove questions.";
  if (/https?:\/\//i.test(tweet)) return "Remove links from the text.";
  if (/[\u{1F300}-\u{1FAFF}]/u.test(tweet)) return "Remove emojis.";
  if (SECTION_LABEL_REGEX.test(tweet)) {
    return "Remove section labels like Observation/Tradeoff/Takeaway.";
  }
  const vaguePhrase = findVaguePhrase(tweet);
  if (vaguePhrase) {
    return `Avoid vague phrasing like "${vaguePhrase}".`;
  }
  if (requireKeyword && !tweetHasSignalKeyword(tweet, signal)) {
    return "Include at least one concrete term from the title or summary.";
  }
  if (signal?.source) {
    const sourceRegex = new RegExp(`\\b${escapeRegExp(signal.source)}\\b`, "i");
    if (sourceRegex.test(tweet)) {
      return "Avoid mentioning the source name.";
    }
  }
  if (signal?.source === "GitHub Trending" && signal?.title) {
    const title = signal.title.toLowerCase();
    if (title && tweet.toLowerCase().includes(title)) {
      return "Avoid listing the repo name verbatim.";
    }
  }
  return null;
}

async function generateTweetWithRetries(signal, posted, attempts = 3) {
  let guidance = "";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const tweet = await generateTweet(signal, guidance);
    const error = validateTweetText(tweet, signal);

    if (!error && !isTweetTooSimilar(tweet, posted)) return tweet;
    if (!error) {
      guidance = "Make it meaningfully different from recent tweets.";
      continue;
    }

    guidance = `Fix: ${error}`;
  }

  throw new Error("Failed to generate a valid tweet.");
}

async function generateThreadWithRetries(signal, posted, count, attempts = 3) {
  let guidance = "";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const thread = await generateThread(signal, guidance, count);
    if (!thread) {
      guidance = `Output exactly ${count} lines, one tweet per line.`;
      continue;
    }

    let error = null;
    for (let i = 0; i < thread.length; i += 1) {
      const tweet = thread[i];
      error = validateTweetText(tweet, signal, { requireKeyword: i === 0 });
      if (error) break;
    }

    const combined = thread.join(" ");
    if (!error && !isTweetTooSimilar(combined, posted)) return thread;
    if (!error) {
      guidance = "Make it meaningfully different from recent tweets.";
      continue;
    }

    guidance = `Fix: ${error}`;
  }

  throw new Error("Failed to generate a valid thread.");
}

async function postThread(tweets, mediaId) {
  let replyTo = null;
  const posted = [];

  for (let i = 0; i < tweets.length; i += 1) {
    const payload = { text: tweets[i] };
    if (i === 0 && mediaId) {
      payload.media = { media_ids: [mediaId] };
    }
    if (replyTo) {
      payload.reply = { in_reply_to_tweet_id: replyTo };
    }

    const res = await twitter.v2.tweet(payload);
    const id = res?.data?.id;
    if (id) {
      posted.push(id);
      replyTo = id;
    }
  }

  return posted;
}

function loadPosted() {
  if (!fs.existsSync(POSTED_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(POSTED_PATH, "utf8"));
  } catch (err) {
    return [];
  }
}

function savePosted(entry) {
  const data = loadPosted();
  data.push(entry);
  fs.writeFileSync(POSTED_PATH, JSON.stringify(data, null, 2));
}

/* ================= MAIN ================= */

(async () => {
  try {
    const signals = await collectSignals();

    if (!signals.length) {
      console.log("No signals found. Aborting.");
      return;
    }

    const posted = loadPosted();
    const recentPosted = getRecentPosted(posted);
    const signal = selectSignal(signals, posted);

    if (!signal) {
      console.log("No fresh signals found. Aborting.");
      return;
    }

    const useThread = shouldGenerateThread();
    const threadLength = useThread ? pickThreadLength() : 1;
    const tweetTexts = useThread
      ? await generateThreadWithRetries(signal, recentPosted, threadLength)
      : [await generateTweetWithRetries(signal, recentPosted)];
    const finalTweets = tweetTexts.map((tweet, index) =>
      index === 0 ? appendLink(tweet, signal.url) : tweet
    );
    const estimatedLength = estimateTweetLength(tweetTexts[0], signal.url);

    if (estimatedLength > MAX_TWEET_LENGTH) {
      throw new Error("Generated tweet is too long after the link.");
    }
    for (let i = 1; i < tweetTexts.length; i += 1) {
      if (tweetTexts[i].length > MAX_TWEET_LENGTH) {
        throw new Error("Generated tweet is too long.");
      }
    }

    const canAttachImage = INCLUDE_IMAGES && !(INCLUDE_LINKS && signal.url);
    const imageUrl = canAttachImage ? await resolveSignalImage(signal) : null;
    const mediaId = canAttachImage ? await uploadImageFromUrl(imageUrl) : null;
    const combinedTweet = tweetTexts.join(" ");

    if (DRY_RUN) {
      console.log("DRY RUN - Tweet NOT posted:");
      finalTweets.forEach((tweet) => console.log(tweet));
      console.log(`Source: ${signal.source}`);
      console.log(`Title: ${signal.title}`);
      if (signal.url) console.log(`Link: ${signal.url}`);
      if (canAttachImage && imageUrl) console.log(`Image: ${imageUrl}`);
      if (!canAttachImage && INCLUDE_LINKS && signal.url) {
        console.log("Image: skipped (link card will use OG image)");
      }
      if (finalTweets.length > 1) {
        console.log(`Thread: ${finalTweets.length} tweets`);
      }
      console.log(`Length: ${estimatedLength}/${MAX_TWEET_LENGTH}`);
      if (DRY_RUN_SAVE) {
        savePosted({
          date: new Date().toISOString(),
          sourceId: signal.id,
          source: signal.source,
          category: signal.category,
          title: signal.title,
          url: signal.url,
          fingerprint: buildFingerprint(signal.title),
          imageUrl,
          tweet: combinedTweet,
          threadTweets: finalTweets.length > 1 ? finalTweets : undefined,
          tweetFingerprint: buildTweetFingerprint(combinedTweet),
          dryRun: true,
        });
      }
      return;
    }

    if (finalTweets.length > 1) {
      await postThread(finalTweets, mediaId);
    } else {
      const payload = { text: finalTweets[0] };
      if (mediaId) {
        payload.media = { media_ids: [mediaId] };
      }
      await twitter.v2.tweet(payload);
    }

    savePosted({
      date: new Date().toISOString(),
      sourceId: signal.id,
      source: signal.source,
      category: signal.category,
      title: signal.title,
      url: signal.url,
      fingerprint: buildFingerprint(signal.title),
      imageUrl,
      tweet: combinedTweet,
      threadTweets: finalTweets.length > 1 ? finalTweets : undefined,
      tweetFingerprint: buildTweetFingerprint(combinedTweet),
    });

    console.log("Tweet posted successfully:");
    finalTweets.forEach((tweet) => console.log(tweet));
  } catch (err) {
    console.error("Error:", err.message);
  }
})();
