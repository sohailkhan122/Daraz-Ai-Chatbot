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

    if (!message) {
      return Response.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

    const analysis = await analyzeShoppingQuery(message);
    const productName = analysis.exactQuery;

    if (!productName) {
      return Response.json(
        { error: "Could not understand the product name. Try again." },
        { status: 400 }
      );
    }

    const darazProducts = formatProducts(filterExactProducts(await scrapeDaraz(productName), productName));

    if (darazProducts.length) {
      return Response.json({
        reply: `Found ${darazProducts.length} Daraz product${darazProducts.length === 1 ? "" : "s"} for "${productName}".`,
        query: productName,
        stage: "daraz",
        products: darazProducts,
      });
    }

    const relatedQueries = [...new Set((analysis.relatedHints?.length
      ? analysis.relatedHints
      : await generateRelatedProductQueries(productName))
      .map((query) => String(query || "").trim())
      .filter(Boolean))]
      .filter((query) => normalizeText(query) !== normalizeText(productName));
    let relatedProducts = [];

    for (const relatedQuery of relatedQueries) {
      const items = filterRelatedProducts(await scrapeDaraz(relatedQuery), productName);
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