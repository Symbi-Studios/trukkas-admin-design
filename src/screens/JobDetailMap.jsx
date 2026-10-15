'use client';

import { useEffect, useRef, useState } from 'react';
import { hasGoogleMapsApiKey, loadGoogleMaps } from '../lib/googleMaps.js';

const routeCache = new Map();
const geocodeCache = new Map();
const NIGERIA_CENTER = { lat: 9.082, lng: 8.6753 };

function address(value) {
  return typeof value === 'string' && value.trim() && value.trim() !== '—' ? value.trim() : null;
}

function point(value) {
  if (!value) return null;
  const read = (key) => typeof value[key] === 'function' ? value[key]() : value[key];
  const lat = read('lat'), lng = read('lng');
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180
    ? { lat, lng }
    : null;
}

function routeKey(origin, destination) {
  return origin.toLowerCase() + '\u0000' + destination.toLowerCase();
}

async function getDrivingRoute(maps, origin, destination) {
  if (!origin || !destination) return null;
  const key = routeKey(origin, destination);
  if (routeCache.has(key)) return routeCache.get(key);
  const pending = (async () => {
    try {
      const { Route } = await maps.importLibrary('routes');
      const result = await Route.computeRoutes({ origin, destination, region: 'ng', travelMode: 'DRIVING', fields: ['path'] });
      const path = result.routes?.[0]?.path?.map(point).filter(Boolean) || [];
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

async function geocodeAddress(maps, value) {
  if (!value) return null;
  const key = value.toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key);
  const pending = (async () => {
    try {
      const { Geocoder } = await maps.importLibrary('geocoding');
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

function addMarker(maps, map, position, { title, label, color, heading }) {
  const icon = label
    ? { path: maps.SymbolPath.CIRCLE, scale: 8, fillColor: color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 }
    : { path: maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 7, rotation: Number.isFinite(heading) ? heading : 0, fillColor: color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 };
  return new maps.Marker({ map, position, title, icon, ...(label ? { label: { text: label, color: '#ffffff', fontSize: '10px', fontWeight: '700' } } : {}) });
}

export function JobDetailMap({ origin, destination, liveLocation, recordedRoute, recordedRouteLoading = false, preferRecordedRoute = false, locationCaption, ariaLabel = 'Job route map', zoomControl = false }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [state, setState] = useState(hasGoogleMapsApiKey() ? 'loading' : 'missing-key');
  const [mapMessage, setMapMessage] = useState('');
  const originAddress = address(origin), destinationAddress = address(destination);
  const livePoint = point(liveLocation);
  const heading = Number.isFinite(liveLocation?.heading) && liveLocation.heading >= 0 && liveLocation.heading <= 360 ? liveLocation.heading : null;
  const truckTitle = [liveLocation?.title, liveLocation?.description, liveLocation?.updatedAt].filter((part) => typeof part === 'string' && part && part !== '—').join(' · ') || 'Live truck GPS';

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
        fullscreenControl: false,
        gestureHandling: 'cooperative',
      });
      setState('ready');
    }).catch((error) => {
      if (active) {
        setState('error');
        setMapMessage(error.message || 'Google Maps could not load.');
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
    const overlays = [];
    setMapMessage('');

    const render = async () => {
      const gpsPathCandidate = Array.isArray(recordedRoute) && recordedRoute.length >= 2 ? recordedRoute.map(point) : null;
      const gpsPath = gpsPathCandidate?.every(Boolean) ? gpsPathCandidate : null;
      const routePath = gpsPath || (recordedRouteLoading ? null : await getDrivingRoute(maps, originAddress, destinationAddress));
      if (!active) return;
      let originPoint = routePath && !gpsPath ? routePath[0] : null;
      let destinationPoint = routePath && !gpsPath ? routePath[routePath.length - 1] : null;
      const routeRendered = Boolean(routePath);
      if (routePath) {
        overlays.push(new maps.Polyline({ map, path: routePath, strokeColor: gpsPath ? '#7c3aed' : '#2563eb', strokeOpacity: 0.88, strokeWeight: 4, clickable: false }));
        if (gpsPath) {
          overlays.push(addMarker(maps, map, gpsPath[0], { title: 'Recorded GPS route start', label: 'S', color: '#2563eb' }));
          overlays.push(addMarker(maps, map, gpsPath[gpsPath.length - 1], { title: 'Latest recorded GPS point', label: 'E', color: '#0f766e' }));
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
          map.setCenter(bounds.getCenter());
          map.setZoom(12);
        } else {
          map.fitBounds(bounds, 42);
        }
      }

      if (recordedRouteLoading && !gpsPath) {
        setMapMessage('Loading recorded GPS route…');
      } else if (preferRecordedRoute && !gpsPath) {
        setMapMessage(routeRendered
          ? 'Recorded GPS route unavailable; showing driving directions.'
          : originPoint || destinationPoint
            ? 'Recorded GPS route unavailable; showing pickup and delivery markers.'
            : livePoint ? 'Recorded GPS route unavailable; showing live truck GPS.'
              : 'No recorded GPS route or map coordinates are available.');
      } else if (originAddress && destinationAddress && !routeRendered) {
        setMapMessage(originPoint || destinationPoint
          ? 'Driving route unavailable; showing available location markers.'
          : livePoint ? 'Driving route unavailable; showing live truck GPS.'
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
  }, [state, originAddress, destinationAddress, recordedRoute, recordedRouteLoading, preferRecordedRoute, livePoint?.lat, livePoint?.lng, heading, truckTitle]);

  const message = state === 'loading' ? 'Loading Google Maps…'
    : state === 'missing-key' ? 'Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to display Google Maps.'
      : state === 'error' ? mapMessage
        : mapMessage;

  return (
    <div className="jd-google-map" role="group" aria-label={ariaLabel}>
      <div ref={containerRef} className="jd-google-map-canvas" />
      {message && <div className={'jd-google-map-message' + (state === 'ready' ? ' jd-google-map-message-ready' : '') + (state === 'ready' && locationCaption ? ' jd-google-map-message-with-caption' : '')} role="status">{message}</div>}
      {locationCaption && <div className="jd-google-map-caption">{locationCaption}</div>}
    </div>
  );
}
