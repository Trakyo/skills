/**
 * Remove tracking parameters from the address bar so copied links are clean
 * and Google does not index parameter variants of the same page.
 */
const TRACKING_PREFIXES = ["utm_", "fb", "gclid", "trakyo", "tclid", "ref"];

export function cleanUrl(): void {
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PREFIXES.some((p) => key.toLowerCase().startsWith(p))) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}
