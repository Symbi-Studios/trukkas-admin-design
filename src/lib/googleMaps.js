const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
let mapsPromise;

export function hasGoogleMapsApiKey() {
  return Boolean(apiKey);
}

export function loadGoogleMaps() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google Maps are available in the browser only.'));
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (!apiKey) return Promise.reject(new Error('The map is unavailable right now.'));
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    const callback = '__trukkasGoogleMapsReady';
    const script = document.createElement('script');
    const params = new URLSearchParams({ key: apiKey, loading: 'async', callback, v: 'weekly', region: 'NG' });
    window[callback] = () => {
      delete window[callback];
      resolve(window.google.maps);
    };
    script.async = true;
    script.src = 'https://maps.googleapis.com/maps/api/js?' + params;
    script.onerror = () => {
      delete window[callback];
      script.remove();
      mapsPromise = null;
      reject(new Error('The map could not load. Please try again.'));
    };
    document.head.appendChild(script);
  });

  return mapsPromise;
}
