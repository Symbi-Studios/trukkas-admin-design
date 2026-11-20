import { useSearchParams } from "next/navigation";

// Deep-link state (?id=, ?tab=, ?q=, filters) so finance pages can link to each other
// pre-filtered or with a drawer open. Use the hook: during client-side navigation the screen
// renders before window.location changes, so only Next's search params are current.
// Screens are wrapped in Suspense by ScreenRouter, which useSearchParams needs for static export.
export function useUrlParams() {
  const params = useSearchParams();
  const get = (key) => { const value = params?.get(key); return value && value.trim() ? value.trim() : null; };
  return { get, search: () => get("q") || "", tab: (tabs, fallback) => (tabs.includes(get("tab")) ? get("tab") : fallback) };
}

/** `/transactions?q=…` style links; skips empty values. */
export function withParams(path, params) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value != null && value !== "" && value !== "—")).toString();
  return query ? `${path}?${query}` : path;
}
