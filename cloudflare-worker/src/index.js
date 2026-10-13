/**
 * DaBrowser lightweight HTML proxy for GitHub Pages.
 * This is not a full browser engine: complex JS apps, logins, WebSockets and
 * anti-bot protected sites may still fail. Do not add cookie forwarding.
 */
const MAX_REDIRECTS = 5;
const ALLOWED_METHODS = new Set(["GET", "HEAD"]);

function validateTarget(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Enter a valid website URL."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP and HTTPS websites are supported.");
  if (url.username || url.password) throw new Error("URLs containing credentials are not allowed.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      host.endsWith(".internal") || host === "metadata.google.internal" ||
      /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) ||
      host.includes(":") || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:") ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    throw new Error("Local and IP-address destinations are blocked.");
  }
  url.hash = "";
  return url;
}

function proxyUrl(workerOrigin, target) {
  return workerOrigin + "/?url=" + encodeURIComponent(target.href);
}

function rewriteUrl(workerOrigin, raw, base) {
  try {
    const target = new URL(raw, base);
    if (!["http:", "https:"].includes(target.protocol)) return raw;
    return proxyUrl(workerOrigin, target);
  } catch {
    return raw;
  }
}

function htmlResponse(response, target, workerOrigin) {
  const headers = new Headers(response.headers);
  for (const name of ["content-security-policy", "content-security-policy-report-only", "x-frame-options", "frame-options", "set-cookie", "set-cookie2", "cross-origin-opener-policy", "cross-origin-embedder-policy", "cross-origin-resource-policy"]) {
    headers.delete(name);
  }
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  const rewriter = new HTMLRewriter()
    .on("a[href]", { element(e) { e.setAttribute("href", rewriteUrl(workerOrigin, e.getAttribute("href"), target)); } })
    .on("area[href]", { element(e) { e.setAttribute("href", rewriteUrl(workerOrigin, e.getAttribute("href"), target)); } })
    .on("link[href]", { element(e) { e.setAttribute("href", rewriteUrl(workerOrigin, e.getAttribute("href"), target)); } })
    .on("script[src]", { element(e) { e.setAttribute("src", rewriteUrl(workerOrigin, e.getAttribute("src"), target)); } })
    .on("img[src]", { element(e) { e.setAttribute("src", rewriteUrl(workerOrigin, e.getAttribute("src"), target)); } })
    .on("source[src]", { element(e) { e.setAttribute("src", rewriteUrl(workerOrigin, e.getAttribute("src"), target)); } })
    .on("video[src]", { element(e) { e.setAttribute("src", rewriteUrl(workerOrigin, e.getAttribute("src"), target)); } })
    .on("audio[src]", { element(e) { e.setAttribute("src", rewriteUrl(workerOrigin, e.getAttribute("src"), target)); } })
    .on("iframe[src]", { element(e) { e.setAttribute("src", rewriteUrl(workerOrigin, e.getAttribute("src"), target)); } })
    .on("form[action]", { element(e) { e.setAttribute("action", rewriteUrl(workerOrigin, e.getAttribute("action"), target)); e.setAttribute("method", "get"); } })
    .on("head", { element(e) {
      const targetJson = JSON.stringify(target.href).replace(/</g, "\\u003c");
      e.append('<script>try{parent.postMessage({type:"dabrowser:navigate",url:'+targetJson+'},"*")}catch(e){}</script>', { html: true });
    } });
  return rewriter.transform(new Response(response.body, { status: response.status, statusText: response.statusText, headers }));
}

function errorPage(message, status = 400) {
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>DaBrowser proxy</title><style>body{font:16px system-ui;max-width:680px;margin:12vh auto;padding:24px;background:#111827;color:#f3f4f6}p{color:#cbd5e1}code{overflow-wrap:anywhere}</style><h1>DaBrowser couldn't open this page</h1><p>${message}</p><p>This free web preview is a compatibility layer, not a full browser engine. Some sites require their own browser, JavaScript features, or sign-in cookies.</p>`, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export default {
  async fetch(request) {
    const requestUrl = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
    if (!ALLOWED_METHODS.has(request.method)) return errorPage("Only GET and HEAD requests are supported by this preview.", 405);
    const rawTarget = requestUrl.searchParams.get("url");
    if (!rawTarget) return new Response("DaBrowser proxy is ready. Open DaBrowser and set this Worker URL in its proxy settings.", { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    let target;
    try { target = validateTarget(rawTarget); } catch (error) { return errorPage(error.message, 400); }

    let response;
    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        response = await fetch(target.href, {
          method: request.method,
          redirect: "manual",
          headers: {
            "Accept": request.headers.get("Accept") || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": request.headers.get("Accept-Language") || "en-US,en;q=0.8",
            "User-Agent": "Mozilla/5.0 (compatible; DaBrowserWebPreview/1.0)"
          }
        });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get("Location");
        if (!location || hop === MAX_REDIRECTS) return errorPage("Too many redirects from this website.", 502);
        try { target = validateTarget(new URL(location, target)); } catch (error) { return errorPage(error.message, 400); }
      }
    } catch {
      return errorPage("The website could not be reached. It may block proxy requests or be temporarily unavailable.", 502);
    }

    const contentType = response.headers.get("Content-Type") || "";
    const headers = new Headers(response.headers);
    for (const name of ["set-cookie", "set-cookie2", "content-security-policy", "content-security-policy-report-only", "x-frame-options", "frame-options"]) headers.delete(name);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Referrer-Policy", "no-referrer");
    headers.delete("content-encoding");
    headers.delete("content-length");
    if (contentType.includes("text/html") || contentType.includes("application/xhtml+xml")) {
      return htmlResponse(new Response(response.body, { status: response.status, statusText: response.statusText, headers }), target, requestUrl.origin);
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
};
