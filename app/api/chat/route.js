import { analyzeShoppingQuery, generateRelatedProductQueries } from "@/lib/gemini";
import { scrapeDaraz } from "@/lib/scraper";

function formatProducts(products) {
  return products.map((p) => ({
    title: p.name,
    price: p.price,
    link: p.link,
    source: p.source || "Unknown",
    image: p.image || "",
  }));
}

function dedupeByLink(products) {
  const seen = new Set();
  return products.filter((p) => {
    if (!p?.link || seen.has(p.link)) return false;
    seen.add(p.link);
    return true;
  });
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPriceValue(priceText) {
  const match = String(priceText || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : Number.NaN;
}

function extractBudgetLimit(text) {
  const normalized = normalizeText(text);
  const match = normalized.match(/(?:under|below|within|less than|upto|up to|max|maximum)\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;

  const limit = Number(match[1]);
  return Number.isFinite(limit) ? limit : null;
}

function filterByBudget(products, budgetLimit) {
  if (!Number.isFinite(budgetLimit)) return products;

  return products.filter((product) => {
    const priceValue = extractPriceValue(product.price);
    if (!Number.isFinite(priceValue)) return true;
    return priceValue <= budgetLimit;
  });
}

const FOLLOW_UP_HINTS = new Set([
  "price",
  "budget",
  "under",
  "below",
  "over",
  "above",
  "size",
  "color",
  "colour",
  "red",
  "blue",
  "green",
  "black",
  "white",
  "small",
  "medium",
  "large",
  "xl",
  "xxl",
  "xxxl",
  "rs",
  "rupees",
  "pkr",
]);

const FILTER_ONLY_UNITS = new Set(["gb", "tb", "kg", "g", "cm", "inch", "in", "rs", "pkr"]);

function getLastProductContext(history) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    const query = String(entry?.query || entry?.normalizedQuery || "").trim();
    if (query) return query;

    const userText = String(entry?.user || "").trim();
    if (userText && userText.split(/\s+/).length > 1) {
      return userText;
    }
  }

  return "";
}

function shouldTreatAsFollowUp(message) {
  const normalized = normalizeText(message);
  if (!normalized) return false;

  const words = normalized.split(" ").filter(Boolean);
  if (!words.length) return false;

  return words.every((word) =>
    FOLLOW_UP_HINTS.has(word) ||
    FILTER_ONLY_UNITS.has(word) ||
    /^\d+(?:\.\d+)?$/.test(word)
  );
}

function resolveContextualQuery(message, history) {
  const currentMessage = String(message || "").trim();
  const lastContext = getLastProductContext(Array.isArray(history) ? history : []);

  if (!lastContext) return currentMessage;
  if (!shouldTreatAsFollowUp(currentMessage)) return currentMessage;

  return `${lastContext} ${currentMessage}`.trim();
}

function isFollowUpQuery(message, history) {
  const currentMessage = String(message || "").trim();
  const lastContext = getLastProductContext(Array.isArray(history) ? history : []);

  return Boolean(lastContext) && shouldTreatAsFollowUp(currentMessage);
}

function getMatchTerms(query) {
  const stopwords = new Set(["watt", "watts", "w", "kw", "kwp", "wp"]);

  return normalizeText(query)
    .split(" ")
    .filter((term) => term && term.length > 1 && !stopwords.has(term));
}

function scoreProductRelevance(product, query) {
  const terms = getMatchTerms(query).filter((term) => !/^\d+(?:\.\d+)?$/.test(term));
  if (!terms.length) return 0;

  const haystack = normalizeText(`${product.name} ${product.price}`);
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function filterExactProducts(products, query) {
  const terms = getMatchTerms(query);
  if (!terms.length) return products;

  return products.filter((product) => {
    const haystack = normalizeText(`${product.name} ${product.price}`);
    return terms.every((term) => haystack.includes(term));
  });
}

function filterRelatedProducts(products, query) {
  const ranked = products
    .map((product) => ({
      product,
      score: scoreProductRelevance(product, query),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score);

  return ranked.map(({ product }) => product);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const message = String(body?.message || "").trim();
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!message) {
      return Response.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

    const contextualMessage = resolveContextualQuery(message, history);
    const followUpQuery = isFollowUpQuery(message, history);
    const budgetLimit = extractBudgetLimit(contextualMessage);
    const analysis = followUpQuery
      ? null
      : await analyzeShoppingQuery(contextualMessage);
    const productName = followUpQuery ? contextualMessage : analysis.exactQuery;

    if (!productName) {
      return Response.json(
        { error: "Could not understand the product name. Try again." },
        { status: 400 }
      );
    }

    const darazProducts = filterByBudget(
      formatProducts(filterExactProducts(await scrapeDaraz(productName), productName)),
      budgetLimit
    );

    if (darazProducts.length) {
      return Response.json({
        reply: `Found ${darazProducts.length} Daraz product${darazProducts.length === 1 ? "" : "s"} for "${productName}".`,
        query: productName,
        stage: "daraz",
        products: darazProducts,
      });
    }

    const relatedSourceQueries = analysis?.relatedHints?.length
      ? analysis.relatedHints
      : await generateRelatedProductQueries(productName);

    const relatedQueries = [...new Set(
      relatedSourceQueries
        .map((query) => String(query || "").trim())
        .filter(Boolean)
    )].filter((query) => normalizeText(query) !== normalizeText(productName));
    let relatedProducts = [];

    for (const relatedQuery of relatedQueries) {
      const items = filterByBudget(
        filterRelatedProducts(await scrapeDaraz(relatedQuery), productName),
        budgetLimit
      );
      relatedProducts = dedupeByLink([...relatedProducts, ...items]).slice(0, 5);
      if (relatedProducts.length >= 5) break;
    }

    if (relatedProducts.length) {
      const withRelatedSource = relatedProducts.map((p) => ({
        ...p,
        source: "Related (Daraz)",
      }));

      return Response.json({
        reply: `Exact product not found on Daraz. Showing related products for "${productName}".`,
        query: productName,
        stage: "related",
        relatedQueries,
        products: formatProducts(withRelatedSource),
      });
    }

    return Response.json(
      {
        reply: `No exact or related products found on Daraz for "${productName}".`,
        query: productName,
        stage: "none",
        relatedQueries,
        products: [],
      },
      { status: 200 }
    );

  } catch (err) {
    return Response.json(
      {
        error: "Something went wrong while fetching products.",
        details: err?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}