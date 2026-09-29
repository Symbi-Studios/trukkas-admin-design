'use client';

import { useEffect, useRef, useState } from 'react';
import './TriangulationGoogleMap.css';

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
let mapsPromise;

function loadMaps() {
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
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
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.onerror = () => {
      delete window[callback];
      script.remove();
      mapsPromise = null;
      reject(new Error('Google Maps could not load. Check the key and allowed website origins.'));
    };
    document.head.appendChild(script);
  });

  return mapsPromise;
}

function validPoint(point) {
  return point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && point.lat >= -90 && point.lat <= 90 && point.lng >= -180 && point.lng <= 180;
}

export function TriangulationGoogleMap({
  points = [],
  selectedId,
  onSelect,
  ariaLabel = 'Triangulation opportunities map',
  emptyMessage = 'Opportunity coordinates are not available in the API response yet.',
  mapType = 'roadmap',
  showTraffic = false,
  zoom,
  fitVersion = 0,
  fitOnDataChange = true,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const trafficLayerRef = useRef(null);
  const hasFittedRef = useRef(false);
  const lastFitVersionRef = useRef(fitVersion);
  const onSelectRef = useRef(onSelect);
  const [state, setState] = useState(apiKey ? 'loading' : 'missing-key');
  const availablePoints = points.filter(validPoint);

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!apiKey || !containerRef.current) return;
    let active = true;
    loadMaps().then((maps) => {
      if (!active || !containerRef.current) return;
      mapRef.current = new maps.Map(containerRef.current, {
        center: { lat: 9.082, lng: 8.6753 },
        zoom: Number.isFinite(zoom) ? zoom : 6,
        mapTypeControl: false,
        zoomControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'cooperative',
      });
      setState('ready');
    }).catch((error) => { if (active) setState(error.message); });
    return () => {
      active = false;
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      trafficLayerRef.current?.setMap(null);
      trafficLayerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (state !== 'ready' || !mapRef.current) return;
    const maps = window.google.maps;
    const mapTypeId = ({
      Standard: maps.MapTypeId.ROADMAP,
      roadmap: maps.MapTypeId.ROADMAP,
      Satellite: maps.MapTypeId.SATELLITE,
      satellite: maps.MapTypeId.SATELLITE,
      Terrain: maps.MapTypeId.TERRAIN,
      terrain: maps.MapTypeId.TERRAIN,
      Hybrid: maps.MapTypeId.HYBRID,
      hybrid: maps.MapTypeId.HYBRID,
    })[mapType] || maps.MapTypeId.ROADMAP;
    mapRef.current.setMapTypeId(mapTypeId);

    if (showTraffic) {
      trafficLayerRef.current ||= new maps.TrafficLayer();
      trafficLayerRef.current.setMap(mapRef.current);
    } else {
      trafficLayerRef.current?.setMap(null);
    }
  }, [mapType, showTraffic, state]);

  useEffect(() => {
    if (state === 'ready' && mapRef.current && Number.isFinite(zoom)) {
      mapRef.current.setZoom(zoom);
    }
  }, [zoom, state]);

  useEffect(() => {
    if (state !== 'ready' || !mapRef.current) return;
    const maps = window.google.maps;
    const map = mapRef.current;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    if (!availablePoints.length) return;

    const bounds = new maps.LatLngBounds();
    let selectedPoint = null;
    availablePoints.forEach((point) => {
      const position = { lat: point.lat, lng: point.lng };
      bounds.extend(position);
      if (point.opportunityId === selectedId) selectedPoint = position;
      const marker = new maps.Marker({
        map,
        position,
        title: point.title || 'Triangulation location',
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: point.opportunityId === selectedId ? 11 : 8,
          fillColor: point.color || '#2563eb',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });
      if (point.opportunityId) marker.addListener('click', () => onSelectRef.current?.(point.opportunityId));
      markersRef.current.push(marker);
    });
    const shouldFit = fitOnDataChange || !hasFittedRef.current || fitVersion !== lastFitVersionRef.current;
    if (shouldFit && availablePoints.length === 1) {
      map.setCenter(bounds.getCenter());
      map.setZoom(11);
      hasFittedRef.current = true;
      lastFitVersionRef.current = fitVersion;
    } else if (shouldFit) {
      map.fitBounds(bounds, 42);
      hasFittedRef.current = true;
      lastFitVersionRef.current = fitVersion;
    } else if (selectedPoint) {
      map.panTo(selectedPoint);
    }
  }, [points, selectedId, state, fitVersion, fitOnDataChange]);

  return (
    <div className="tri-google-map">
      <div ref={containerRef} className="tri-google-map-canvas" aria-label={ariaLabel} />
      {state !== 'ready' && (
        <div className="tri-google-map-message" role="status">
          {state === 'missing-key' ? 'Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to display Google Maps.'
            : state === 'loading' ? 'Loading Google Maps…' : state}
        </div>
      )}
      {state === 'ready' && !availablePoints.length && (
        <div className="tri-google-map-no-points">{emptyMessage}</div>
      )}
    </div>
  );
}
