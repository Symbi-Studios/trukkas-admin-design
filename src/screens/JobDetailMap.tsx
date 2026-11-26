/// <reference types="google.maps" />
'use client';

import { useEffect, useRef, useState } from 'react';
import { hasGoogleMapsApiKey, loadGoogleMaps } from '@/lib/googleMaps';
import type { MapPoint } from '@/types/jobDetail';

// The map on Job details: the truck's last known position, the GPS trail it has recorded,
// and, when there is no trail, the driving route between pickup and delivery.

type Maps = typeof google.maps;

interface LiveLocation extends MapPoint {
  heading?: number | null;
  /** shown when the pin is hovered */
  title?: string | null;
}

interface JobDetailMapProps {
  origin?: string | null;
  destination?: string | null;
  liveLocation?: LiveLocation | null;
  /** the recorded GPS trail, oldest first */
  recordedRoute?: MapPoint[] | null;
  recordedRouteLoading?: boolean;
  /** true when the trail is the wanted route, so a missing trail is said out loud */
  preferRecordedRoute?: boolean;
  locationCaption?: string;
  ariaLabel?: string;
  zoomControl?: boolean;
}

const routeCache = new Map<string, Promise<MapPoint[] | null>>();
const geocodeCache = new Map<string, Promise<MapPoint | null>>();
const NIGERIA_CENTER = { lat: 9.082, lng: 8.6753 };

function address(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim() && value.trim() !== '—' ? value.trim() : null;
}

function point(value: { lat: number | (() => number); lng: number | (() => number) } | null | undefined): MapPoint | null {
  if (!value) return null;
  const lat = typeof value.lat === 'function' ? value.lat() : value.lat;
  const lng = typeof value.lng === 'function' ? value.lng() : value.lng;
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180 ? { lat, lng } : null;
}

async function getDrivingRoute(maps: Maps, origin: string | null, destination: string | null): Promise<MapPoint[] | null> {
  if (!origin || !destination) return null;
  const key = `${origin.toLowerCase()}\u0000${destination.toLowerCase()}`;
  const cached = routeCache.get(key);
  if (cached) return cached;
  const pending = (async (): Promise<MapPoint[] | null> => {
    try {
      const { Route } = (await maps.importLibrary('routes')) as google.maps.RoutesLibrary;
      const result = await Route.computeRoutes({ origin, destination, region: 'ng', travelMode: 'DRIVING', fields: ['path'] });
      const path = (result.routes?.[0]?.path ?? []).map((p) => point(p)).filter((p): p is MapPoint => p !== null);
      return path.length >= 2 ? path : null;
    } catch {
      return null;
    }
  })();
  routeCache.set(key, pending);
  const result = await pending;
  if (!result) routeCache.delete(key);
  return result;
}

async function geocodeAddress(maps: Maps, value: string | null): Promise<MapPoint | null> {
  if (!value) return null;
  const key = value.toLowerCase();
  const cached = geocodeCache.get(key);
  if (cached) return cached;
  const pending = (async (): Promise<MapPoint | null> => {
    try {
      const { Geocoder } = (await maps.importLibrary('geocoding')) as google.maps.GeocodingLibrary;
      const response = await new Geocoder().geocode({ address: value, region: 'NG' });
      return point(response.results?.[0]?.geometry?.location);
    } catch {
      return null;
    }
  })();
  geocodeCache.set(key, pending);
  const result = await pending;
  if (!result) geocodeCache.delete(key);
  return result;
}

interface MarkerOptions { title: string; label?: string; color: string; heading?: number | null }

function addMarker(maps: Maps, map: google.maps.Map, position: MapPoint, { title, label, color, heading }: MarkerOptions): google.maps.Marker {
  const icon: google.maps.Symbol = label
    ? { path: maps.SymbolPath.CIRCLE, scale: 8, fillColor: color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 }
    : { path: maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 7, rotation: heading ?? 0, fillColor: color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 };
  return new maps.Marker({ map, position, title, icon, ...(label ? { label: { text: label, color: '#ffffff', fontSize: '10px', fontWeight: '700' } } : {}) });
}

type Overlay = google.maps.Marker | google.maps.Polyline;

export function JobDetailMap({
  origin, destination, liveLocation, recordedRoute, recordedRouteLoading = false, preferRecordedRoute = false,
  locationCaption, ariaLabel = 'Job route map', zoomControl = false,
}: JobDetailMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [state, setState] = useState<'loading' | 'missing-key' | 'ready' | 'error'>(hasGoogleMapsApiKey() ? 'loading' : 'missing-key');
  const [mapMessage, setMapMessage] = useState('');
  const originAddress = address(origin);
  const destinationAddress = address(destination);
  const livePoint = point(liveLocation);
  const heading = liveLocation?.heading ?? null;
  const truckTitle = liveLocation?.title || 'Truck GPS';

  useEffect(() => {
    if (!containerRef.current) return undefined;
    let active = true;
    loadGoogleMaps().then((maps) => {
      if (!active || !containerRef.current) return;
      mapRef.current = new maps.Map(containerRef.current, {
        center: NIGERIA_CENTER,
        zoom: 5,
        mapTypeControl: false,
        zoomControl,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: 'cooperative',
      });
      setState('ready');
    }).catch(() => {
      if (active) {
        setState('error');
        setMapMessage('The map could not load. Please try again.');
      }
    });
    return () => {
      active = false;
      mapRef.current = null;
    };
  }, [zoomControl]);

  useEffect(() => {
    const maps = window.google?.maps;
    const map = mapRef.current;
    if (state !== 'ready' || !maps || !map) return undefined;
    let active = true;
    const overlays: Overlay[] = [];
    setMapMessage('');

    const render = async () => {
      const trail = Array.isArray(recordedRoute) && recordedRoute.length >= 2 ? recordedRoute : null;
      const routePath = trail ?? (recordedRouteLoading ? null : await getDrivingRoute(maps, originAddress, destinationAddress));
      if (!active) return;
      let originPoint = routePath && !trail ? routePath[0] : null;
      let destinationPoint = routePath && !trail ? routePath[routePath.length - 1] : null;
      const routeRendered = Boolean(routePath);
      if (routePath) {
        overlays.push(new maps.Polyline({ map, path: routePath, strokeColor: trail ? '#7c3aed' : '#2563eb', strokeOpacity: 0.88, strokeWeight: 4, clickable: false }));
        if (trail) {
          overlays.push(addMarker(maps, map, trail[0], { title: 'Recorded GPS route start', label: 'S', color: '#2563eb' }));
          overlays.push(addMarker(maps, map, trail[trail.length - 1], { title: 'Latest recorded GPS point', label: 'E', color: '#0f766e' }));
        }
      } else if (!recordedRouteLoading) {
        const [geocodedOrigin, geocodedDestination] = await Promise.all([
          geocodeAddress(maps, originAddress), geocodeAddress(maps, destinationAddress),
        ]);
        if (!active) return;
        originPoint = geocodedOrigin;
        destinationPoint = geocodedDestination;
      }

      const bounds = new maps.LatLngBounds();
      const hasAnyPoint = Boolean(routePath?.length || originPoint || destinationPoint || livePoint);
      if (routePath) routePath.forEach((position) => bounds.extend(position));
      if (originPoint) {
        bounds.extend(originPoint);
        overlays.push(addMarker(maps, map, originPoint, { title: originAddress || 'Pickup location', label: 'P', color: '#2563eb' }));
      }
      if (destinationPoint) {
        bounds.extend(destinationPoint);
        overlays.push(addMarker(maps, map, destinationPoint, { title: destinationAddress || 'Delivery location', label: 'D', color: '#dc2626' }));
      }
      if (livePoint) {
        bounds.extend(livePoint);
        overlays.push(addMarker(maps, map, livePoint, { title: truckTitle, color: '#7c3aed', heading }));
      }

      if (hasAnyPoint) {
        if (livePoint && !routePath && !originPoint && !destinationPoint) {
          map.setCenter(livePoint);
          map.setZoom(14);
        } else if ((routePath?.length || 0) + Number(Boolean(livePoint)) + Number(Boolean(originPoint && !routePath)) + Number(Boolean(destinationPoint && !routePath)) === 1) {
          const center = bounds.getCenter();
          if (center) map.setCenter(center);
          map.setZoom(12);
        } else {
          map.fitBounds(bounds, 42);
        }
      }

      if (recordedRouteLoading && !trail) {
        setMapMessage('Loading recorded GPS route…');
      } else if (preferRecordedRoute && !trail) {
        setMapMessage(routeRendered
          ? 'Recorded GPS route unavailable; showing driving directions.'
          : originPoint || destinationPoint
            ? 'Recorded GPS route unavailable; showing pickup and delivery markers.'
            : livePoint ? 'Recorded GPS route unavailable; showing the last truck position.'
              : 'No recorded GPS route or map coordinates are available.');
      } else if (originAddress && destinationAddress && !routeRendered) {
        setMapMessage(originPoint || destinationPoint
          ? 'Driving route unavailable; showing available location markers.'
          : livePoint ? 'Driving route unavailable; showing the last truck position.'
            : 'Pickup and delivery coordinates could not be resolved.');
      } else if (!hasAnyPoint) {
        setMapMessage('No map coordinates are available for this job.');
      }
    };

    render().catch(() => { if (active) setMapMessage('The job locations could not be displayed on this map.'); });
    return () => {
      active = false;
      overlays.forEach((overlay) => overlay.setMap(null));
    };
    // livePoint is rebuilt on every render, so its numbers are the dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, originAddress, destinationAddress, recordedRoute, recordedRouteLoading, preferRecordedRoute, livePoint?.lat, livePoint?.lng, heading, truckTitle]);

  const message = state === 'loading' ? 'Loading Google Maps…'
    : state === 'missing-key' ? 'The map is unavailable right now.'
      : mapMessage;

  return (
    <div className="jd-google-map" role="group" aria-label={ariaLabel}>
      <div ref={containerRef} className="jd-google-map-canvas" />
      {message && <div className={`jd-google-map-message${state === 'ready' ? ' jd-google-map-message-ready' : ''}${state === 'ready' && locationCaption ? ' jd-google-map-message-with-caption' : ''}`} role="status">{message}</div>}
      {locationCaption && <div className="jd-google-map-caption">{locationCaption}</div>}
    </div>
  );
}