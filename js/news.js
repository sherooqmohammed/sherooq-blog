/* ============================================
   Sherooq's Blog — news.js
   Fetches live headlines client-side (no backend, no API key)
   using public Google News RSS feeds. Because every visit
   re-fetches fresh data, the "daily update" happens automatically
   every time someone opens the page.
   ============================================ */

(function () {
  "use strict";

  // Cache results for this many minutes before re-fetching from network.
  var CACHE_MINUTES = 60;

  // Fallback chain of proxy services. If one is down, slow, or
  // rate-limited, the next is tried automatically. The site's own
  // /api/news serverless endpoint (only live when hosted on Vercel)
  // is tried first since it has no CORS/rate-limit issues; the rest
  // are public fallbacks that also work when the site is opened
  // straight from disk (no server).
  function candidateUrls(feedUrl) {
    var encoded = encodeURIComponent(feedUrl);
    return [
      { type: "xml", url: "/api/news?url=" + encoded },
      { type: "xml", url: "https://api.allorigins.win/raw?url=" + encoded },
      { type: "rss2json", url: "https://api.rss2json.com/v1/api.json?rss_url=" + encoded },
      { type: "xml", url: "https://corsproxy.io/?url=" + encoded }
    ];
  }

  // Give each candidate a limited window to respond so one slow/hanging
  // proxy doesn't stall the whole fallback chain.
  var FETCH_TIMEOUT_MS = 6000;

  function fetchWithTimeout(url) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS);
    return fetch(url, { cache: "no-store", signal: controller.signal }).finally(function () {
      clearTimeout(timer);
    });
  }

  function parseXml(text) {
    var doc = new DOMParser().parseFromString(text, "text/xml");
    var items = Array.prototype.slice.call(doc.querySelectorAll("item"));
    return items.map(function (item) {
      return {
        title: textOf(item, "title"),
        link: textOf(item, "link"),
        pubDate: textOf(item, "pubDate"),
        source: textOf(item, "source") || ""
      };
    });
  }

  function textOf(el, tag) {
    var node = el.querySelector(tag);
    return node ? node.textContent.trim() : "";
  }

  function fetchOne(candidate) {
    return fetchWithTimeout(candidate.url).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      if (candidate.type === "rss2json") {
        return res.json().then(function (json) {
          if (json.status !== "ok" || !json.items) throw new Error("rss2json error");
          return json.items.map(function (it) {
            return {
              title: it.title,
              link: it.link,
              pubDate: it.pubDate,
              source: (it.author || (json.feed && json.feed.title)) || ""
            };
          });
        });
      }
      return res.text().then(parseXml);
    });
  }

  function fetchWithFallback(feedUrl) {
    var candidates = candidateUrls(feedUrl);
    var attempt = function (i) {
      if (i >= candidates.length) return Promise.reject(new Error("All sources failed"));
      return fetchOne(candidates[i]).catch(function () {
        return attempt(i + 1);
      });
    };
    return attempt(0);
  }

  function cacheKey(categoryId) {
    return "news_cache_" + categoryId;
  }

  function readCache(categoryId) {
    try {
      var raw = localStorage.getItem(cacheKey(categoryId));
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeCache(categoryId, items) {
    try {
      localStorage.setItem(cacheKey(categoryId), JSON.stringify({
        items: items,
        fetchedAt: Date.now()
      }));
    } catch (e) { /* ignore quota errors */ }
  }

  function isFresh(cache) {
    return cache && (Date.now() - cache.fetchedAt) < CACHE_MINUTES * 60 * 1000;
  }

  function timeAgo(ts) {
    var diffMs = Date.now() - ts;
    var mins = Math.round(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + " min ago";
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + " hr" + (hrs > 1 ? "s" : "") + " ago";
    var days = Math.round(hrs / 24);
    return days + " day" + (days > 1 ? "s" : "") + " ago";
  }

  function formatPubDate(pubDate) {
    if (!pubDate) return "";
    var d = new Date(pubDate);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  /**
   * Load news for a category, using cache first, then network.
   * options: { categoryId, feedUrl, forceRefresh }
   * returns Promise<{items, fetchedAt, fromCache}>
   */
  function loadNews(options) {
    var cache = readCache(options.categoryId);
    if (!options.forceRefresh && isFresh(cache)) {
      return Promise.resolve({ items: cache.items, fetchedAt: cache.fetchedAt, fromCache: true });
    }
    return fetchWithFallback(options.feedUrl).then(function (items) {
      writeCache(options.categoryId, items);
      return { items: items, fetchedAt: Date.now(), fromCache: false };
    }).catch(function (err) {
      // Network failed — fall back to any cached data we have, even if stale.
      if (cache && cache.items && cache.items.length) {
        return { items: cache.items, fetchedAt: cache.fetchedAt, fromCache: true, stale: true };
      }
      throw err;
    });
  }

  /* ---------- Renderers ---------- */

  function renderHomeCard(container, categoryId, feedUrl, count) {
    container.innerHTML = '<div class="skeleton" style="width:90%"></div><div class="skeleton" style="width:70%"></div><div class="skeleton" style="width:80%"></div>';
    loadNews({ categoryId: categoryId, feedUrl: feedUrl }).then(function (result) {
      var items = result.items.slice(0, count || 4);
      if (!items.length) {
        container.innerHTML = '<p>No headlines available right now.</p>';
        return;
      }
      var html = '<span class="updated-tag">Updated ' + timeAgo(result.fetchedAt) + (result.stale ? ' (offline copy)' : '') + '</span><ul>';
      items.forEach(function (item) {
        html += '<li><a href="' + item.link + '" target="_blank" rel="noopener">' + escapeHtml(item.title) + '</a></li>';
      });
      html += '</ul>';
      container.innerHTML = html;
    }).catch(function () {
      container.innerHTML = '<p>Couldn’t load headlines. <a href="#" class="retry-link">Try again</a></p>';
      var retry = container.querySelector(".retry-link");
      if (retry) retry.addEventListener("click", function (e) {
        e.preventDefault();
        renderHomeCard(container, categoryId, feedUrl, count);
      });
    });
  }

  function renderFullList(container, metaContainer, categoryId, feedUrl, forceRefresh) {
    container.innerHTML = '<div class="skeleton" style="width:95%"></div><div class="skeleton" style="width:88%"></div><div class="skeleton" style="width:92%"></div><div class="skeleton" style="width:80%"></div><div class="skeleton" style="width:90%"></div>';
    if (metaContainer) metaContainer.textContent = "Loading latest headlines…";

    loadNews({ categoryId: categoryId, feedUrl: feedUrl, forceRefresh: forceRefresh }).then(function (result) {
      var items = result.items;
      if (!items.length) {
        container.innerHTML = '<div class="state-message">No headlines available right now. Please try refreshing.</div>';
        if (metaContainer) metaContainer.textContent = "";
        return;
      }
      var html = '<ul class="headline-list">';
      items.forEach(function (item) {
        html += '<li><a class="headline-link" href="' + item.link + '" target="_blank" rel="noopener">' + escapeHtml(item.title) + '</a>' +
          '<span class="headline-meta">' + [item.source, formatPubDate(item.pubDate)].filter(Boolean).join(" · ") + '</span></li>';
      });
      html += '</ul>';
      container.innerHTML = html;
      if (metaContainer) {
        metaContainer.textContent = "Updated " + timeAgo(result.fetchedAt) + (result.stale ? " (showing last saved copy — network unavailable)" : "") + " · refreshes automatically";
      }
    }).catch(function () {
      container.innerHTML = '<div class="state-message error">Couldn’t load headlines right now. Check your connection and try refreshing.</div>';
      if (metaContainer) metaContainer.textContent = "";
    });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  window.BlogNews = {
    loadNews: loadNews,
    renderHomeCard: renderHomeCard,
    renderFullList: renderFullList
  };
})();
