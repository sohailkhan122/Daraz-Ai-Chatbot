import axios from "axios";

function normalizeLink(href) {
  if (!href) return "";
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  return `https://www.daraz.pk${href.startsWith("/") ? "" : "/"}${href}`;
}

export async function scrapeDaraz(query) {
  try {
    const { data } = await axios.get("https://www.daraz.pk/catalog/", {
      params: {
        ajax: "true",
        q: query,
      },
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json, text/plain, */*",
      },
    });

    const items = Array.isArray(data?.mods?.listItems) ? data.mods.listItems : [];
    const products = items
      .map((item) => {
        const name = String(item?.name || "").trim();
        const price = String(item?.priceShow || item?.price || "Price not listed").trim();
        const link = normalizeLink(item?.itemUrl || "");
        const image = String(item?.image || "").trim();

        if (!name || !link) return null;

        return {
          name,
          price,
          link,
          image,
          source: "Daraz",
        };
      })
      .filter(Boolean)
      .slice(0, 5);

    return products;
  } catch (err) {
    console.log("Scraper error:", err.message);
    return [];
  }
}