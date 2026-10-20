/**
 * Canonical URL helper. Google treats ?a=1 and ?a=1&b=2 as different pages,
 * so we collapse every landing URL to its path right after load.
 */
const ALLOWED_PARAMS = new Set(["page", "tab"]);

export function stripDuplicateUrlParams(): void {
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of [...url.searchParams.keys()]) {
    if (!ALLOWED_PARAMS.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) {
    window.history.replaceState({}, "", url.pathname + (url.search || "") + url.hash);
  }
}
