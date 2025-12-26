import "dotenv/config";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { TwitterApi } from "twitter-api-v2";

/* ================= CONFIG ================= */

const POLLINATIONS_URL = "https://text.pollinations.ai/";
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
  { name: "Stripe Blog", url: "https://stripe.com/blog/rss", category: "evergreen" },
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
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
]);
const POSTED_PATH = process.env.POSTED_PATH || "posted.json";
const POSTED_LOOKBACK_DAYS = 14;
const CATEGORY_WEIGHTS = { evergreen: 0.7, trending: 0.3 };
const DRY_RUN_SAVE = process.env.DRY_RUN_SAVE !== "false";
const TECH_DOMAINS = new Set([
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
]);
const TECH_KEYWORDS = [
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
];

const DRY_RUN = process.env.DRY_RUN === "true";

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

async function fetchJson(url, { retries = 2, timeoutMs = 10000 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url, {}, timeoutMs);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(400 * attempt);
      }
    }
  }

  throw lastError;
}

async function fetchText(url, { retries = 2, timeoutMs = 10000 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url, {}, timeoutMs);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return await res.text();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(400 * attempt);
      }
    }
  }

  throw lastError;
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

function normalizeTweet(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch (err) {
    return null;
  }
}

function matchesTechKeywords(text) {
  const value = cleanText(text).toLowerCase();
  if (!value) return false;

  for (const keyword of TECH_KEYWORDS) {
    if (keyword.includes(" ")) {
      if (value.includes(keyword)) return true;
      continue;
    }

    const regex = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i");
    if (regex.test(value)) return true;
  }

  return false;
}

function isTechSignal(signal) {
  const domain = signal.url ? hostnameFromUrl(signal.url) : null;
  if (domain) {
    for (const allowed of TECH_DOMAINS) {
      if (domain === allowed || domain.endsWith(`.${allowed}`)) return true;
    }
  }

  return matchesTechKeywords(signal.title);
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
    const imageUrl =
      extractAttr(itemXml, "media:content", "url") ||
      extractAttr(itemXml, "media:thumbnail", "url") ||
      extractAttr(itemXml, "enclosure", "url");

    if (!title || !link) continue;

    items.push({
      title,
      link,
      publishedAt: pubDate,
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

    const publishedAt =
      extractTag(entryXml, "published") || extractTag(entryXml, "updated");

    if (!title || !link) continue;

    items.push({
      title,
      link,
      publishedAt,
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
  const words = cleanText(text).toLowerCase().replace(/[^a-z0-9 ]/g, " ");
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

function selectSignal(signals, posted) {
  const recent = getRecentPosted(posted);
  const candidates = signals.filter(
    (signal) =>
      signal.title &&
      isTechSignal(signal) &&
      !isStale(signal) &&
      !isDuplicate(signal, recent)
  );

  if (!candidates.length) return null;

  const desiredCategory = pickWeighted(CATEGORY_WEIGHTS);
  const byCategory = candidates.filter(
    (signal) => signal.category === desiredCategory
  );
  const pool = byCategory.length ? byCategory : candidates;
  const sorted = pool.sort((a, b) => scoreSignal(b) - scoreSignal(a));
  const pickCount = Math.min(3, sorted.length);
  const index = Math.floor(Math.random() * pickCount);
  return sorted[index];
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
        url: item.url || `https://news.ycombinator.com/item?id=${id}`,
        source,
        category,
        publishedAt: item.time ? new Date(item.time * 1000).toISOString() : null,
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
    const repoRegex =
      /<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = repoRegex.exec(html)) !== null && signals.length < limit) {
      const href = match[1];
      const text = cleanText(match[2]);
      const repoPath = href.split("?")[0].replace(/^\//, "");

      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repoPath)) continue;
      const imageUrl = `https://opengraph.githubassets.com/1/${repoPath}`;

      signals.push({
        id: `gh:${repoPath}`,
        title: text || repoPath,
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
  const linkNote = INCLUDE_LINKS
    ? "\nA source link will be appended after the text."
    : "";

  return `
Write one original tweet.

Voice: engineering tech lead, builder mindset.
Tone: calm, reflective, precise.
Style: minimal, confident, pragmatic.
Focus: systems thinking, delivery tradeoffs, and clear takeaways.

Constraints:
- Under ${MAX_TEXT_LENGTH} characters
- No emojis
- No hashtags
- No questions
- No links in the text

Structure: observation -> tradeoff -> takeaway. Keep it to one sentence if possible.${extra}${linkNote}

Signal:
Title: ${signal.title}
Source: ${signal.source}
Category: ${signal.category}
`.trim();
}

async function generateTweet(signal, guidance) {
  const prompt = buildPrompt(signal, guidance);
  const res = await fetchText(POLLINATIONS_URL + encodeURIComponent(prompt), {
    timeoutMs: 20000,
  });

  return normalizeTweet(res);
}

function validateTweetText(tweet) {
  if (!tweet) return "Output is empty.";
  if (tweet.length > MAX_TEXT_LENGTH) {
    return `Keep it under ${MAX_TEXT_LENGTH} characters.`;
  }
  if (/#/.test(tweet)) return "Remove hashtags.";
  if (/\?/.test(tweet)) return "Remove questions.";
  if (/https?:\/\//i.test(tweet)) return "Remove links from the text.";
  if (/[\u{1F300}-\u{1FAFF}]/u.test(tweet)) return "Remove emojis.";
  return null;
}

async function generateTweetWithRetries(signal, attempts = 3) {
  let guidance = "";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const tweet = await generateTweet(signal, guidance);
    const error = validateTweetText(tweet);

    if (!error) return tweet;

    guidance = `Fix: ${error}`;
  }

  throw new Error("Failed to generate a valid tweet.");
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
  const dir = path.dirname(POSTED_PATH);
  if (dir && dir !== ".") {
    fs.mkdirSync(dir, { recursive: true });
  }
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
    const signal = selectSignal(signals, posted);

    if (!signal) {
      console.log("No fresh signals found. Aborting.");
      return;
    }

    const tweetText = await generateTweetWithRetries(signal);
    const finalTweet = appendLink(tweetText, signal.url);
    const estimatedLength = estimateTweetLength(tweetText, signal.url);

    if (estimatedLength > MAX_TWEET_LENGTH) {
      throw new Error("Generated tweet is too long after the link.");
    }

    const canAttachImage = INCLUDE_IMAGES && !(INCLUDE_LINKS && signal.url);
    const imageUrl = canAttachImage ? await resolveSignalImage(signal) : null;
    const mediaId = canAttachImage ? await uploadImageFromUrl(imageUrl) : null;

    if (DRY_RUN) {
      console.log("DRY RUN - Tweet NOT posted:");
      console.log(finalTweet);
      console.log(`Source: ${signal.source}`);
      console.log(`Title: ${signal.title}`);
      if (signal.url) console.log(`Link: ${signal.url}`);
      if (canAttachImage && imageUrl) console.log(`Image: ${imageUrl}`);
      if (!canAttachImage && INCLUDE_LINKS && signal.url) {
        console.log("Image: skipped (link card will use OG image)");
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
          tweet: finalTweet,
          dryRun: true,
        });
      }
      return;
    }

    const payload = { text: finalTweet };
    if (mediaId) {
      payload.media = { media_ids: [mediaId] };
    }

    await twitter.v2.tweet(payload);

    savePosted({
      date: new Date().toISOString(),
      sourceId: signal.id,
      source: signal.source,
      category: signal.category,
      title: signal.title,
      url: signal.url,
      fingerprint: buildFingerprint(signal.title),
      imageUrl,
      tweet: finalTweet,
    });

    console.log("Tweet posted successfully:");
    console.log(finalTweet);
  } catch (err) {
    console.error("Error:", err.message);
  }
})();
