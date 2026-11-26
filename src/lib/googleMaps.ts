/// <reference types="google.maps" />
// Loads the Google Maps script once, in the browser only. The key is public by design (NEXT_PUBLIC_...);
// restrict it to this site's address in the Google Cloud console.

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
const CALLBACK = '__trukkasGoogleMapsReady';

type Maps = typeof google.maps;

let mapsPromise: Promise<Maps> | null = null;

export function hasGoogleMapsApiKey(): boolean {
  return Boolean(apiKey);
}

export function loadGoogleMaps(): Promise<Maps> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google Maps are available in the browser only.'));
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (!apiKey) return Promise.reject(new Error('The map is unavailable right now.'));
  if (mapsPromise) return mapsPromise;

  const callbacks = window as unknown as Record<string, (() => void) | undefined>;
  mapsPromise = new Promise<Maps>((resolve, reject) => {
    const script = document.createElement('script');
    const params = new URLSearchParams({ key: apiKey, loading: 'async', callback: CALLBACK, v: 'weekly', region: 'NG' });
    callbacks[CALLBACK] = () => {
      delete callbacks[CALLBACK];
      resolve(window.google.maps);
    };
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.onerror = () => {
      delete callbacks[CALLBACK];
      script.remove();
      mapsPromise = null;
      reject(new Error('The map could not load. Please try again.'));
    };
    document.head.appendChild(script);
  });

  return mapsPromise;
}
