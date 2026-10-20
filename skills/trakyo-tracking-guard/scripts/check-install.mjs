#!/usr/bin/env node
/**
 * check-install.mjs — pre-deploy check that Trakyo tracking is still installed
 * correctly on a set of live URLs.
 *
 *   node check-install.mjs https://www.example.com/ https://www.example.com/pricing \
 *        --host go.example.com [--api-key tky_live_...] [--probe]
 *
 * Two layers:
 *   1. Static (always): fetch each URL, find the Trakyo tag, apply the eight
 *      rules from references/checks.md (same codes as POST /v1/setup/verify).
 *      Also reports every redirect hop and whether a query string survived it.
 *   2. Authoritative (with --api-key, scope links:read): POST /v1/setup/verify
 *      for each URL and print its status, recent_activity and findings.
 *
 * Exit code 1 on any critical finding (static or API), 2 on a fetch error, else 0.
 * `unknown` from the API is NOT a failure (client-rendered app; see checks.md).
 *
 * Node 18+. No dependencies on purpose, so it can run in any CI step.
 */

const args = process.argv.slice(2);
const urls = [];
let host = null;
let apiKey = process.env.TRAKYO_API_KEY || null;
let probe = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--host") host = args[++i];
  else if (a === "--api-key") apiKey = args[++i];
  else if (a === "--probe") probe = true;
  else if (a.startsWith("--")) { console.error(`unknown flag ${a}`); process.exit(2); }
  else urls.push(a);
}
if (urls.length === 0) {
  console.error("usage: node check-install.mjs <url> [<url>...] --host go.example.com [--api-key tky_live_...] [--probe]");
  process.exit(2);
}

const UA = "Mozilla/5.0 (compatible; trakyo-check-install/1.0; +https://trakyo.io/docs)";
const VENDORS = [
  { name: "Calendly", hosts: ["calendly.com"] },
  { name: "Typeform", hosts: ["typeform.com"] },
  { name: "iClosed", hosts: ["iclosed.io"] },
  { name: "Tally", hosts: ["tally.so"] },
  { name: "AEvent", hosts: ["aevent.com", "aevent.online"] },
  { name: "HubSpot Meetings", hosts: ["hsappstatic.net", "hubspot.com"] },
  { name: "GoHighLevel", hosts: ["msgsndr.com", "leadconnectorhq.com"] },
];

/** Follow redirects by hand so every hop (and its query string) is visible. */
async function fetchWithHops(url) {
  const hops = [];
  let current = url;
  for (let i = 0; i < 10; i++) {
    const res = await fetch(current, { redirect: "manual", headers: { "user-agent": UA, accept: "text/html" } });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const next = new URL(res.headers.get("location"), current).toString();
      hops.push({ from: current, to: next, status: res.status });
      current = next;
      continue;
    }
    const html = await res.text();
    return { finalUrl: current, status: res.status, html, hops, contentType: res.headers.get("content-type") || "" };
  }
  throw new Error("too many redirects");
}

/**
 * Script-tag scan. A tokenizer, not a regex over the whole document: it walks
 * `<script ...>` open tags in order and records whether each sits before the
 * first `</head>`. Good enough for a pre-deploy hint; the API's parse5-based
 * check is the authoritative one.
 */
function scriptTags(html) {
  const tags = [];
  const headEnd = html.search(/<\/head\s*>/i);
  const re = /<script\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const src = (attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i) || [])[1] || null;
    tags.push({
      raw: m[0],
      src,
      index: m.index,
      inHead: headEnd === -1 ? false : m.index < headEnd,
      hasDefer: /\bdefer\b/i.test(attrs),
      hasAsync: /\basync\b/i.test(attrs),
    });
  }
  return tags;
}

function hostOf(src, base) {
  try { return new URL(src, base).hostname.toLowerCase(); } catch { return null; }
}
const isTrakyo = (t) => (t.src && /\/api\/js\/latest\.js/i.test(t.src)) || /\bdata-trakyo\b/i.test(t.raw);
const isSelfHosted = (t) => t.src && !/\/api\/js\/latest\.js/i.test(t.src) && /trakyo(\.min)?\.js/i.test(t.src);
const isSpaShell = (html) =>
  /<div\s+id=["'](root|app|__next)["']\s*>\s*<\/div>/i.test(html) && /<script\b[^>]*type\s*=\s*["']module["']/i.test(html);

function staticChecks(html, finalUrl, knownHost) {
  const findings = [];
  const tags = scriptTags(html);
  const trakyo = tags.filter(isTrakyo);
  const snippet = `<script src="https://${knownHost || "YOUR-TRACKING-HOST"}/api/js/latest.js"></script>`;

  for (const t of tags.filter(isSelfHosted))
    findings.push({ code: "SCRIPT_SELF_HOSTED", severity: "critical", evidence: t.raw, fix: snippet });

  if (trakyo.length === 0) {
    findings.push({ code: "SCRIPT_MISSING", severity: "critical", fix: snippet,
      note: isSpaShell(html) ? "client-rendered shell: the tag may be injected at runtime; treat as unknown, confirm with --api-key" : undefined });
    return findings;
  }
  if (trakyo.length > 1)
    findings.push({ code: "SCRIPT_DUPLICATE", severity: "warning", evidence: trakyo.map((t) => t.raw).join("\n"), fix: `Keep exactly one:\n${snippet}` });

  const p = trakyo[0];
  const h = p.src ? hostOf(p.src, finalUrl) : null;
  if (knownHost && h && h !== knownHost.toLowerCase())
    findings.push({ code: "SCRIPT_WRONG_HOST", severity: "critical", evidence: p.raw, fix: snippet });
  if (p.hasDefer) findings.push({ code: "SCRIPT_DEFERRED", severity: "critical", evidence: p.raw, fix: snippet });
  else if (p.hasAsync) findings.push({ code: "SCRIPT_ASYNC", severity: "critical", evidence: p.raw, fix: snippet });
  if (!p.inHead) findings.push({ code: "SCRIPT_NOT_IN_HEAD", severity: "warning", evidence: p.raw, fix: `Move into <head>:\n${snippet}` });

  for (const v of VENDORS) {
    const embed = tags.find((t) => {
      const eh = t.src ? hostOf(t.src, finalUrl) : null;
      return eh && v.hosts.some((vh) => eh === vh || eh.endsWith(`.${vh}`));
    });
    if (embed && embed.index < p.index)
      findings.push({ code: "SCRIPT_AFTER_VENDOR_EMBED", severity: "critical", evidence: `${v.name}: ${embed.raw}`, fix: `Move the Trakyo tag ABOVE the ${v.name} embed:\n${snippet}` });
  }
  return findings;
}

async function apiVerify(url) {
  const res = await fetch("https://api.trakyo.io/v1/setup/verify", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`setup/verify ${res.status}: ${body?.error?.code || ""} ${body?.error?.message || ""}`);
  return body;
}

let exit = 0;
for (const url of urls) {
  console.log(`\n== ${url}`);
  let page;
  try {
    page = await fetchWithHops(url);
  } catch (e) {
    console.log(`   FETCH ERROR: ${e.message}`);
    exit = Math.max(exit, 2);
    continue;
  }
  for (const h of page.hops) {
    const kept = new URL(h.from).search ? (new URL(h.to).search ? "query kept" : "QUERY DROPPED") : "";
    console.log(`   redirect ${h.status}: ${h.from} -> ${h.to} ${kept}`);
    if (kept === "QUERY DROPPED") { exit = Math.max(exit, 1); console.log("   ^ critical: this redirect drops trakyo_id / utm_* / tclid"); }
  }
  if (page.status !== 200) console.log(`   HTTP ${page.status}`);
  if (!/html/i.test(page.contentType)) console.log(`   not HTML (${page.contentType}); static checks skipped`);
  else {
    const f = staticChecks(page.html, page.finalUrl, host);
    if (f.length === 0) console.log("   static: ok (tag present, blocking, in <head>, once)");
    for (const x of f) {
      console.log(`   static ${x.severity.toUpperCase()} ${x.code}${x.evidence ? `  ${x.evidence.split("\n")[0].slice(0, 120)}` : ""}`);
      if (x.note) console.log(`     note: ${x.note}`);
      if (x.severity === "critical" && !x.note) exit = Math.max(exit, 1);
    }
  }
  if (probe) {
    // Does a probe query string survive the site's own redirects?
    const probeUrl = new URL(page.finalUrl);
    probeUrl.searchParams.set("trakyo_id", "probe123");
    probeUrl.searchParams.set("trakyo-no-track", "1");
    try {
      const p = await fetchWithHops(probeUrl.toString());
      const survived = new URL(p.finalUrl).searchParams.get("trakyo_id") === "probe123";
      console.log(`   probe: ${survived ? "trakyo_id survived server redirects" : "TRAKYO_ID LOST on server redirects"} (${p.hops.length} hop(s))`);
      if (!survived) exit = Math.max(exit, 1);
      console.log("   probe: client-side URL rewriting is not visible here; open ?trakyo_id=probe-<random> (no trakyo-no-track) in a fresh browser and check the address bar, window.trakyo_id and every checkout/booking link");
    } catch (e) { console.log(`   probe: fetch error ${e.message}`); }
  }
  if (apiKey) {
    try {
      const v = await apiVerify(url);
      console.log(`   api: status=${v.status} recent_activity=${v.recent_activity} final_url=${v.final_url}`);
      if (v.unknown_reason) console.log(`   api: unknown_reason: ${v.unknown_reason}`);
      for (const f of v.findings || []) {
        console.log(`   api ${f.severity.toUpperCase()} ${f.code}: ${f.explain}`);
        if (f.fix) console.log(`     fix:\n${f.fix.split("\n").map((l) => "       " + l).join("\n")}`);
        if (f.severity === "critical") exit = Math.max(exit, 1);
      }
      if (v.status === "broken" || v.status === "not_installed") exit = Math.max(exit, 1);
    } catch (e) { console.log(`   api: ${e.message}`); }
  }
}
console.log(`\nexit ${exit} (${exit === 0 ? "pass" : exit === 1 ? "critical findings" : "fetch errors"})`);
process.exit(exit);
