#!/usr/bin/env node
/**
 * check-install.mjs — is Trakyo tracking still installed correctly on these URLs?
 *
 * Run `node check-install.mjs --help` for the interface. The short version:
 *
 *   node check-install.mjs https://www.example.com/ https://www.example.com/pricing \
 *        --host go.example.com [--api-key tky_live_...] [--probe] [--json]
 *
 * Two layers:
 *   1. Static (always): fetch each URL, follow redirects by hand so every hop is
 *      visible, find the Trakyo tag in the served HTML and apply the eight rules
 *      from references/checks.md (the same codes POST /v1/setup/verify returns).
 *   2. Authoritative (with an API key, scope links:read): POST /v1/setup/verify
 *      for each URL and print its status, recent_activity and findings.
 *
 * Shipped identically in the trakyo-install and trakyo-tracking-guard skills
 * (the monorepo's spec test asserts the two copies are byte-identical). Node 18+,
 * no dependencies, so it can run in any CI step without an install.
 */

const VERSION = "1.1.0"; // keep equal to metadata.version in SKILL.md

// Why these numbers:
//  - 15 s per request: a page that needs longer to answer has a problem this
//    script cannot diagnose, and a CI step must not hang on it.
//  - 10 redirect hops: browsers give up around 20; a tracking-relevant chain
//    longer than 10 is itself a finding worth a human's eyes.
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_HOPS = 10;
const API_BASE = "https://api.trakyo.io";
const UA = `trakyo-check-install/${VERSION} (+https://github.com/Trakyo/skills)`;

const HELP = `check-install ${VERSION} — pre-deploy check that Trakyo tracking is installed correctly

usage: node check-install.mjs <url> [<url>...] [options]

options:
  --host <tracking host>   the account's tracking host, e.g. go.example.com (dashboard →
                           Custom Domains). Enables the SCRIPT_WRONG_HOST check and fills
                           the exact tag into every fix.
  --api-key <key>          Trakyo API key with scope links:read. Also read from the
                           TRAKYO_API_KEY environment variable. Adds the authoritative
                           POST /v1/setup/verify result for each URL.
  --probe                  also fetch each URL with ?trakyo_id=probe-<random>&trakyo-no-track=1
                           and report whether the server-side redirects keep the query
                           string. trakyo-no-track=1 makes the tag do nothing, so the
                           probe records no visit. Client-side URL rewriting is NOT
                           visible to a fetch; test that in a real browser.
  --json                   machine-readable report on stdout (one document, see below);
                           progress and warnings go to stderr.
  --timeout <ms>           per-request timeout, default ${DEFAULT_TIMEOUT_MS}.
  --version                print the version and exit.
  --help                   this text.

exit codes:
  0  every URL passed (warnings may still be listed)
  1  at least one critical finding: a critical static code, a redirect that
     dropped the query string, a lost probe, or the API answering broken /
     not_installed
  2  usage error, or a URL could not be fetched at all (DNS, TLS, timeout).
     A fetch error on one URL does not stop the others.

\`unknown\` from the API is never a failure: client-rendered apps (Vite/React builds
from Lovable, v0, Bolt) inject the tag at runtime, so judge those by
recent_activity and the dashboard.

--json shape:
  {
    "version": "${VERSION}",
    "exit": 0,
    "results": [
      {
        "url": "...", "final_url": "...", "http_status": 200,
        "redirects": [{ "from": "...", "to": "...", "status": 301, "query_kept": true }],
        "static": { "checked": true, "findings": [{ "code": "SCRIPT_DEFERRED", "severity": "critical", "evidence": "...", "fix": "..." }] },
        "probe":  { "survived": true, "hops": 1 }            // only with --probe
        "api":    { "status": "ok", "recent_activity": true, "final_url": "...", "findings": [...] }   // only with an API key
        "error":  "..."                                      // only when the fetch failed
      }
    ]
  }

network: this script talks only to the URLs you pass (plus their redirect targets)
and, with an API key, to ${API_BASE}. It writes no files and reads no environment
variable other than TRAKYO_API_KEY.
`;

// ---------------------------------------------------------------------------
// arguments
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const urls = [];
let host = null;
let apiKey = process.env.TRAKYO_API_KEY || null;
let probe = false;
let json = false;
let timeoutMs = DEFAULT_TIMEOUT_MS;

function usageError(message) {
  process.stderr.write(`check-install: ${message}\nrun with --help for the interface\n`);
  process.exit(2);
}

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const value = () => {
    const v = args[++i];
    if (v === undefined || v.startsWith("--")) usageError(`${a} expects a value`);
    return v;
  };
  if (a === "--help" || a === "-h") { process.stdout.write(HELP); process.exit(0); }
  else if (a === "--version") { process.stdout.write(`${VERSION}\n`); process.exit(0); }
  else if (a === "--host") host = value().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  else if (a === "--api-key") apiKey = value();
  else if (a === "--probe") probe = true;
  else if (a === "--json") json = true;
  else if (a === "--timeout") {
    timeoutMs = Number(value());
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) usageError("--timeout expects a positive number of milliseconds");
  }
  else if (a.startsWith("--")) usageError(`unknown flag ${a}`);
  else {
    try { new URL(a); } catch { usageError(`not a URL: ${a}`); }
    urls.push(a);
  }
}
if (urls.length === 0) usageError("at least one URL is required");

// In --json mode the human-readable lines go to stderr so stdout stays parseable.
const say = (line) => (json ? process.stderr : process.stdout).write(line + "\n");

// ---------------------------------------------------------------------------
// fetching
// ---------------------------------------------------------------------------
const VENDORS = [
  { name: "Calendly", hosts: ["calendly.com"] },
  { name: "Typeform", hosts: ["typeform.com"] },
  { name: "iClosed", hosts: ["iclosed.io"] },
  { name: "Tally", hosts: ["tally.so"] },
  { name: "AEvent", hosts: ["aevent.com", "aevent.online"] },
  { name: "HubSpot Meetings", hosts: ["hsappstatic.net", "hubspot.com"] },
  { name: "GoHighLevel", hosts: ["msgsndr.com", "leadconnectorhq.com"] },
];

async function fetchOnce(url, extraHeaders = {}) {
  return fetch(url, {
    redirect: "manual",
    headers: { "user-agent": UA, accept: "text/html,*/*;q=0.8", ...extraHeaders },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/** Follow redirects by hand so every hop (and its query string) is visible. */
async function fetchWithHops(url) {
  const hops = [];
  let current = url;
  for (let i = 0; i < MAX_HOPS; i++) {
    const res = await fetchOnce(current);
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      const next = new URL(location, current).toString();
      hops.push({
        from: current,
        to: next,
        status: res.status,
        // Only meaningful when the source carried a query string at all.
        query_kept: new URL(current).search ? Boolean(new URL(next).search) : null,
      });
      current = next;
      continue;
    }
    const html = await res.text();
    return { finalUrl: current, status: res.status, html, hops, contentType: res.headers.get("content-type") || "" };
  }
  throw new Error(`more than ${MAX_HOPS} redirects starting at ${url}`);
}

// ---------------------------------------------------------------------------
// static checks (the eight codes from references/checks.md)
// ---------------------------------------------------------------------------

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
    findings.push({
      code: "SCRIPT_MISSING",
      severity: "critical",
      fix: snippet,
      note: isSpaShell(html)
        ? "client-rendered shell: the tag may be injected at runtime; treat as unknown and confirm with --api-key"
        : undefined,
    });
    return findings;
  }
  if (trakyo.length > 1)
    findings.push({ code: "SCRIPT_DUPLICATE", severity: "warning", evidence: trakyo.map((t) => t.raw).join("\n"), fix: `Keep exactly one:\n${snippet}` });

  const p = trakyo[0];
  const h = p.src ? hostOf(p.src, finalUrl) : null;
  if (knownHost && h && h !== knownHost)
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

// ---------------------------------------------------------------------------
// authoritative check
// ---------------------------------------------------------------------------
async function apiVerify(url) {
  const res = await fetch(`${API_BASE}/v1/setup/verify`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "user-agent": UA },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const hint = res.status === 401 || res.status === 403
      ? " (the key must have scope links:read; dashboard → API & MCP)"
      : "";
    throw new Error(`setup/verify ${res.status}: ${body?.error?.code || ""} ${body?.error?.message || ""}${hint}`.trim());
  }
  return body;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const results = [];
let exit = 0;
const critical = () => { exit = Math.max(exit, 1); };

for (const url of urls) {
  const result = { url };
  results.push(result);
  say(`\n== ${url}`);

  let page;
  try {
    page = await fetchWithHops(url);
  } catch (e) {
    result.error = e.message;
    say(`   FETCH ERROR: ${e.message}`);
    exit = Math.max(exit, 2);
    continue;
  }
  result.final_url = page.finalUrl;
  result.http_status = page.status;
  result.redirects = page.hops;

  for (const h of page.hops) {
    const label = h.query_kept === null ? "" : h.query_kept ? "query kept" : "QUERY DROPPED";
    say(`   redirect ${h.status}: ${h.from} -> ${h.to} ${label}`);
    if (h.query_kept === false) { critical(); say("   ^ critical: this redirect drops trakyo_id / utm_* / tclid"); }
  }
  if (page.status !== 200) say(`   HTTP ${page.status}`);

  if (!/html/i.test(page.contentType)) {
    result.static = { checked: false, reason: `not HTML (${page.contentType})`, findings: [] };
    say(`   not HTML (${page.contentType}); static checks skipped`);
  } else {
    const findings = staticChecks(page.html, page.finalUrl, host);
    result.static = { checked: true, findings };
    if (findings.length === 0) say("   static: ok (tag present, blocking, in <head>, once)");
    for (const f of findings) {
      say(`   static ${f.severity.toUpperCase()} ${f.code}${f.evidence ? `  ${f.evidence.split("\n")[0].slice(0, 120)}` : ""}`);
      if (f.note) say(`     note: ${f.note}`);
      // A SCRIPT_MISSING on a client-rendered shell is "unknown", not a failure.
      if (f.severity === "critical" && !f.note) critical();
    }
  }

  if (probe) {
    const probeId = `probe-${Math.random().toString(36).slice(2, 10)}`;
    const probeUrl = new URL(page.finalUrl);
    probeUrl.searchParams.set("trakyo_id", probeId);
    probeUrl.searchParams.set("trakyo-no-track", "1");
    try {
      const p = await fetchWithHops(probeUrl.toString());
      const survived = new URL(p.finalUrl).searchParams.get("trakyo_id") === probeId;
      result.probe = { survived, hops: p.hops.length, final_url: p.finalUrl };
      say(`   probe: ${survived ? "trakyo_id survived server redirects" : "TRAKYO_ID LOST on server redirects"} (${p.hops.length} hop(s))`);
      if (!survived) critical();
      say("   probe: client-side URL rewriting is not visible to a fetch; open ?trakyo_id=probe-<random> (without trakyo-no-track) in a fresh browser and check the address bar, window.trakyo_id and every checkout/booking link");
    } catch (e) {
      result.probe = { error: e.message };
      say(`   probe: fetch error ${e.message}`);
    }
  }

  if (apiKey) {
    try {
      const v = await apiVerify(url);
      result.api = {
        status: v.status,
        recent_activity: v.recent_activity,
        final_url: v.final_url,
        unknown_reason: v.unknown_reason,
        findings: v.findings || [],
      };
      say(`   api: status=${v.status} recent_activity=${v.recent_activity} final_url=${v.final_url}`);
      if (v.unknown_reason) say(`   api: unknown_reason: ${v.unknown_reason}`);
      for (const f of v.findings || []) {
        say(`   api ${f.severity.toUpperCase()} ${f.code}: ${f.explain}`);
        if (f.fix) say(`     fix:\n${f.fix.split("\n").map((l) => "       " + l).join("\n")}`);
        if (f.severity === "critical") critical();
      }
      if (v.status === "broken" || v.status === "not_installed") critical();
    } catch (e) {
      result.api = { error: e.message };
      say(`   api: ${e.message}`);
    }
  }
}

const verdict = exit === 0 ? "pass" : exit === 1 ? "critical findings" : "fetch or usage errors";
say(`\nexit ${exit} (${verdict})`);
if (json) process.stdout.write(JSON.stringify({ version: VERSION, exit, results }, null, 2) + "\n");
process.exit(exit);
