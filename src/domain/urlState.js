// Read deep-link state (?tab=, ?q=, filters) once when a screen mounts, so finance pages
// can link to each other pre-filtered. Screens render client-side only (App waits for
// `mounted`), so reading window.location in a useState initializer is safe.

export function urlParam(key) {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get(key);
  return value && value.trim() ? value.trim() : null;
}

export function initialTab(tabs, fallback) {
  const requested = urlParam("tab");
  return requested && tabs.includes(requested) ? requested : fallback;
}

export function initialSearch() {
  return urlParam("q") || "";
}

/** `/transactions?q=…` style links; skips empty values. */
export function withParams(path, params) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value != null && value !== "" && value !== "—")).toString();
  return query ? `${path}?${query}` : path;
}
