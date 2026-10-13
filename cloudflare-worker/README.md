# DaBrowser free web-preview proxy

This optional Cloudflare Worker helps ordinary HTML websites load inside DaBrowser on GitHub Pages. GitHub Pages itself cannot run the proxy server.

## Deploy for free

1. Create/sign in to a Cloudflare account: https://dash.cloudflare.com/
2. Open **Workers & Pages** and create a Worker named `dabrowser-web-proxy`.
3. Open the Worker editor and replace its starter code with the contents of `cloudflare-worker/src/index.js`, then deploy. (Alternatively, from a local clone, run `npx wrangler deploy` from this folder after installing Wrangler.)
4. Copy the Worker URL, usually `https://dabrowser-web-proxy.YOUR-SUBDOMAIN.workers.dev`.
5. Open IDA OS on GitHub Pages, launch DaBrowser, press the **proxy/settings** button, and paste that Worker URL. It is saved only in this browser's local storage. Clear the field to return to direct iframe mode.

## Important limitations and safety

- Cloudflare Workers Free currently includes 100,000 Worker requests per day; each proxied page, image, script, and stylesheet can use a request. See https://developers.cloudflare.com/workers/platform/limits/
- This is a compatibility proxy, **not** a full Chromium browser. Sites that require complex client-side JavaScript, API calls, sign-in cookies, WebSockets, downloads, or anti-bot checks can still fail.
- For safety, it only accepts GET/HEAD, rejects common local/private address patterns, limits redirects, and does not forward browser cookies or credentials. Do not add cookie forwarding or use this as a public general-purpose proxy.
- A Worker URL is public. Anyone who discovers it can use its free quota, so monitor usage in Cloudflare and disable the Worker if abused.
- No proxy can guarantee that every site will load. If a site fails, use its normal website in a separate browser tab.
