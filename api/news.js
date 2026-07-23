// Vercel serverless function: server-side RSS proxy.
// Fetches the requested feed URL from the server (no browser CORS
// restrictions apply here) and returns the raw XML with a permissive
// CORS header + short edge cache, so the news pages load quickly and
// reliably without depending on third-party CORS-proxy services.

export default async function handler(req, res) {
  const feedUrl = req.query.url;

  if (!feedUrl || typeof feedUrl !== "string") {
    res.status(400).send("Missing 'url' query parameter");
    return;
  }

  let parsed;
  try {
    parsed = new URL(feedUrl);
  } catch (e) {
    res.status(400).send("Invalid url");
    return;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    res.status(400).send("Invalid protocol");
    return;
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SherooqBlogBot/1.0; +https://vercel.com)"
      }
    });

    if (!upstream.ok) {
      res.status(502).send("Upstream error: " + upstream.status);
      return;
    }

    const text = await upstream.text();

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    // Cache at the edge for 30 min, serve stale for up to an hour while revalidating.
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
    res.status(200).send(text);
  } catch (e) {
    res.status(502).send("Fetch failed: " + (e && e.message ? e.message : "unknown error"));
  }
}
