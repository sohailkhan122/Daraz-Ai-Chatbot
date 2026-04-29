import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

const QUERY_STOPWORDS = new Set([
  "i",
  "want",
  "wants",
  "wanting",
  "need",
  "needs",
  "needing",
  "please",
  "show",
  "see",
  "find",
  "search",
  "buy",
  "get",
  "look",
  "looking",
  "for",
  "of",
  "me",
  "my",
  "to",
  "the",
  "a",
  "an",
  "on",
  "in",
  "from",
  "under",
  "below",
  "above",
  "budget",
  "price",
  "daraz",
]);

function sanitizeShoppingQuery(text) {
  const cleaned = String(text || "")
    .replace(/["'`]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = cleaned.split(" ").filter(Boolean);
  const filtered = tokens.filter((token) => !QUERY_STOPWORDS.has(token.toLowerCase()));

  return (filtered.length ? filtered.join(" ") : cleaned).trim().slice(0, 80);
}

function fallbackProductName(message) {
  return sanitizeShoppingQuery(message);
}

function fallbackRelatedQueries(productName) {
  const base = String(productName || "")
    .toLowerCase()
    .replace(/\b(\d+(?:\.\d+)?)\s*(kwp|kw|wp|watt|watts|w)\b/gi, " ")
    .replace(/\b(128gb|256gb|512gb|1tb|64gb|32gb|16gb|8gb|4gb)\b/gi, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = base.split(" ").filter(Boolean);
  const withoutNumbers = tokens.filter((token) => !/^\d+(?:\.\d+)?$/.test(token));
  const firstThreeWords = tokens.slice(0, 3).join(" ").trim();
  const firstTwoWords = tokens.slice(0, 2).join(" ").trim();
  const firstWord = tokens.slice(0, 1).join(" ").trim();
  const lastTwoWords = tokens.slice(-2).join(" ").trim();
  const droppedLastWord = tokens.length > 2 ? tokens.slice(0, -1).join(" ").trim() : "";
  const categoryOnly = tokens.length > 2 ? tokens.slice(1).join(" ").trim() : "";

  const queries = [
    base,
    droppedLastWord,
    categoryOnly,
    firstThreeWords,
    firstTwoWords,
    lastTwoWords,
    withoutNumbers.join(" ").trim(),
    firstWord,
  ]
    .map((q) => q.trim())
    .filter(Boolean);

  return [...new Set(queries)].slice(0, 5);
}

function parseJsonText(text) {
  const cleaned = String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export async function extractProductName(message) {
  const fallback = fallbackProductName(message);

  if (!process.env.GEMINI_API_KEY) {
    return fallback;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });

  const prompt = `
Extract ONLY the product name from this shopping message.
Rules:
- Output plain text only
- No quotes
- No extra commentary
- Maximum 8 words

Message: "${message}"

Return only product name.
`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        topP: 0.1,
        maxOutputTokens: 20,
      },
    });
    const text = result.response?.text?.() || "";

    const cleaned = sanitizeShoppingQuery(text);

    return cleaned || fallback;
  } catch (error) {
    console.warn("Gemini extraction failed, using fallback:", error?.message || error);
    return fallback;
  }

}

export async function generateRelatedProductQueries(productName) {
  const fallback = fallbackRelatedQueries(productName);

  if (!process.env.GEMINI_API_KEY) {
    return fallback;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });

  const prompt = `
Create 3 related shopping search queries for this exact product when exact match is unavailable.
Rules:
- Return JSON array only
- Keep each query short (2 to 5 words)
- Focus on close alternatives and variants of the same product line
- Do not generate accessories such as cases, covers, chargers, screen protectors, or cables

Product: "${productName}"
`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        topP: 0.3,
        maxOutputTokens: 80,
      },
    });

    const raw = result.response?.text?.() || "";
    const parsed = parseJsonText(raw);

    if (!Array.isArray(parsed)) return fallback;

    const queries = parsed
      .map((q) => String(q || "").trim())
      .filter(Boolean)
      .slice(0, 3);

    return queries.length ? queries : fallback;
  } catch {
    return fallback;
  }
}

export async function analyzeShoppingQuery(message) {
  const fallback = {
    exactQuery: fallbackProductName(message),
    normalizedQuery: fallbackProductName(message),
    isAccessoryQuery: false,
    relatedHints: fallbackRelatedQueries(fallbackProductName(message)),
  };

  if (!process.env.GEMINI_API_KEY) {
    return fallback;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });

  const prompt = `
Analyze the shopping request and return JSON only.
Rules:
- exactQuery must be the exact product the user wants, not accessories
- normalizedQuery should be a concise canonical product phrase
- isAccessoryQuery should be true only if the user explicitly wants an accessory
- relatedHints should contain 3 close product variants or same-line alternatives, not accessories

Message: "${message}"

Return shape:
{
  "exactQuery": "...",
  "normalizedQuery": "...",
  "isAccessoryQuery": false,
  "relatedHints": ["...", "...", "..."]
}
`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        topP: 0.1,
        maxOutputTokens: 120,
      },
    });

    const parsed = parseJsonText(result.response?.text?.() || "");

    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }

    const exactQuery = sanitizeShoppingQuery(parsed.exactQuery || message) || fallback.exactQuery;
    const normalizedQuery = sanitizeShoppingQuery(parsed.normalizedQuery || exactQuery) || fallback.normalizedQuery;
    const relatedHints = Array.isArray(parsed.relatedHints)
      ? parsed.relatedHints.map((q) => sanitizeShoppingQuery(q)).filter(Boolean).slice(0, 3)
      : fallback.relatedHints;

    return {
      exactQuery,
      normalizedQuery,
      isAccessoryQuery: Boolean(parsed.isAccessoryQuery),
      relatedHints: relatedHints.length ? relatedHints : fallback.relatedHints,
    };
  } catch {
    return fallback;
  }
}