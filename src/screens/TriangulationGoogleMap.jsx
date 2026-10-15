'use client';

import { useEffect, useRef, useState } from 'react';
import './TriangulationGoogleMap.css';
import { hasGoogleMapsApiKey, loadGoogleMaps } from '../lib/googleMaps.js';

const EMPTY_MAP_DATA = Object.freeze([]);

function validPoint(point) {
  return point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && point.lat >= -90 && point.lat <= 90 && point.lng >= -180 && point.lng <= 180;
}

// Render the server's weighted GPS grid through the supported OverlayView API.
// Google's visualization.HeatmapLayer was removed in May 2026.
function heatOverlay(maps, map, data) {
  const maximum = data.reduce((max, point) => Math.max(max, point.weight), 0);
  class GpsHeatOverlay extends maps.OverlayView {
    onAdd() {
      this.canvas = document.createElement('canvas');
      this.canvas.style.position = 'absolute';
      this.canvas.style.pointerEvents = 'none';
      this.getPanes().overlayLayer.appendChild(this.canvas);
    }
    draw() {
      const bounds = map.getBounds(), projection = this.getProjection();
      if (!bounds || !projection || !this.canvas || !maximum) return;
      const sw = projection.fromLatLngToDivPixel(bounds.getSouthWest());
      const ne = projection.fromLatLngToDivPixel(bounds.getNorthEast());
      if (!sw || !ne || ne.x <= sw.x) return;
      const width = Math.ceil(ne.x - sw.x), height = Math.ceil(sw.y - ne.y);
      if (width <= 0 || height <= 0 || width > 10000 || height > 10000) return;
      this.canvas.width = width;
      this.canvas.height = height;
      this.canvas.style.left = sw.x + 'px';
      this.canvas.style.top = ne.y + 'px';
      const context = this.canvas.getContext('2d');
      if (!context) return;
      for (const point of data) {
        const pixel = projection.fromLatLngToDivPixel(new maps.LatLng(point.position.lat, point.position.lng));
        if (!pixel) continue;
        const x = pixel.x - sw.x, y = pixel.y - ne.y, radius = 36;
        if (x < -radius || y < -radius || x > width + radius || y > height + radius) continue;
        const alpha = point.weight / maximum;
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(239,68,68,' + alpha * 0.8 + ')');
        gradient.addColorStop(0.5, 'rgba(245,158,11,' + alpha * 0.5 + ')');
        gradient.addColorStop(1, 'rgba(245,158,11,0)');
        context.fillStyle = gradient;
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
    }
    onRemove() { this.canvas?.remove(); this.canvas = null; }
  }
  const overlay = new GpsHeatOverlay();
  overlay.setMap(map);
  return overlay;
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
  routes = EMPTY_MAP_DATA,
  geofences = EMPTY_MAP_DATA,
  heatmap = EMPTY_MAP_DATA,
  drawingPoints,
  onDrawingPoint,
  onDrawingChange,
  drawingDisabled = false,
  onReady,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const trafficLayerRef = useRef(null);
  const hasFittedRef = useRef(false);
  const lastFitVersionRef = useRef(fitVersion);
  const onSelectRef = useRef(onSelect);
  const drawingCallbacks = useRef({ onDrawingPoint, onDrawingChange, onReady, drawingDisabled });
  const drawingRef = useRef(null);
  const syncingDrawing = useRef(false);
  const [state, setState] = useState(hasGoogleMapsApiKey() ? 'loading' : 'missing-key');
  const availablePoints = points.filter(validPoint);
  const layerPoints = [
    ...(routes || []).flatMap((route) => route.points || []),
    ...(geofences || []).flatMap((fence) => fence.polygon || []),
    ...(heatmap || []).filter((point) => point.weight > 0).map((point) => point.position),
  ].filter(validPoint);

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { drawingCallbacks.current = { onDrawingPoint, onDrawingChange, onReady, drawingDisabled }; }, [onDrawingPoint, onDrawingChange, onReady, drawingDisabled]);
  useEffect(() => { onReady?.(state === 'ready'); }, [state, onReady]);

  useEffect(() => {
    if (!containerRef.current) return;
    let active = true;
    loadGoogleMaps().then((maps) => {
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
    if (!availablePoints.length && !layerPoints.length) return;

    const bounds = new maps.LatLngBounds();
    let selectedPoint = null;
    layerPoints.forEach((point) => bounds.extend(point));
    availablePoints.forEach((point) => {
      const position = { lat: point.lat, lng: point.lng };
      bounds.extend(position);
      if (point.opportunityId === selectedId) selectedPoint = position;
      const marker = new maps.Marker({
        map,
        position,
        title: point.title || 'Triangulation location',
        ...(point.label ? { label: { text: point.label, color: '#ffffff', fontSize: '10px' } } : {}),
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
    if (shouldFit && availablePoints.length + layerPoints.length === 1) {
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
  }, [points, selectedId, state, fitVersion, fitOnDataChange, routes, geofences, heatmap]);

  useEffect(() => {
    if (state !== 'ready' || !mapRef.current) return;
    const maps = window.google.maps, map = mapRef.current, overlays = [];
    for (const route of routes || []) {
      if (route.source !== 'RECORDED_GPS' || !route.points || route.points.length < 2 || !route.points.every(validPoint)) continue;
      const line = new maps.Polyline({ map, path: route.points, strokeColor: '#2563eb', strokeOpacity: 0.8, strokeWeight: 3 });
      if (route.tripIds?.[0]) line.addListener('click', () => onSelectRef.current?.(route.tripIds[0]));
      overlays.push(line);
    }
    for (const fence of geofences || []) {
      if (!fence.polygon || fence.polygon.length < 3 || !fence.polygon.every(validPoint)) continue;
      overlays.push(new maps.Polygon({ map, paths: fence.polygon, strokeColor: '#2563eb', strokeOpacity: 0.8, strokeWeight: 2, fillColor: '#2563eb', fillOpacity: 0.15, clickable: false }));
    }
    const heatPoints = (heatmap || []).filter((point) => validPoint(point.position) && Number.isFinite(point.weight) && point.weight > 0);
    if (heatPoints.length) overlays.push(heatOverlay(maps, map, heatPoints));
    return () => { overlays.forEach((overlay) => { maps.event.clearInstanceListeners(overlay); overlay.setMap(null); }); };
  }, [state, routes, geofences, heatmap]);

  useEffect(() => {
    if (state !== 'ready' || !mapRef.current || !drawingPoints) return;
    const maps = window.google.maps, map = mapRef.current;
    const polygon = new maps.Polygon({ map, editable: !drawingDisabled, clickable: true, strokeColor: '#2563eb', strokeWeight: 2, fillColor: '#2563eb', fillOpacity: 0.15 });
    // An empty paths collection has no first path for getPath() to return.
    const path = new maps.MVCArray();
    polygon.setPath(path);
    const changed = () => {
      if (!syncingDrawing.current && !drawingCallbacks.current.drawingDisabled) {
        drawingCallbacks.current.onDrawingChange?.(path.getArray().map((point) => ({ lat: point.lat(), lng: point.lng() })));
      }
    };
    const listeners = ['insert_at', 'set_at', 'remove_at'].map((event) => path.addListener(event, changed));
    const addPoint = (event) => {
      if (!drawingCallbacks.current.drawingDisabled && event.latLng && event.vertex == null && event.edge == null) drawingCallbacks.current.onDrawingPoint?.({ lat: event.latLng.lat(), lng: event.latLng.lng() });
    };
    listeners.push(map.addListener('click', addPoint), polygon.addListener('click', addPoint));
    drawingRef.current = { polygon, path };
    map.setOptions({ zoomControl: true, draggableCursor: 'crosshair' });
    return () => {
      listeners.forEach((listener) => listener.remove());
      polygon.setMap(null);
      drawingRef.current = null;
      map.setOptions({ zoomControl: false, draggableCursor: null });
    };
  }, [state, Boolean(drawingPoints)]);

  useEffect(() => {
    const drawing = drawingRef.current;
    if (!drawing || !drawingPoints) return;
    drawing.polygon.setEditable(!drawingDisabled);
    const current = drawing.path.getArray();
    if (current.length === drawingPoints.length && current.every((point, index) => point.lat() === drawingPoints[index].lat && point.lng() === drawingPoints[index].lng)) return;
    syncingDrawing.current = true;
    drawing.path.clear();
    drawingPoints.filter(validPoint).forEach((point) => drawing.path.push(new window.google.maps.LatLng(point.lat, point.lng)));
    syncingDrawing.current = false;
  }, [drawingPoints, drawingDisabled, state]);

  return (
    <div className="tri-google-map">
      <div ref={containerRef} className="tri-google-map-canvas" aria-label={ariaLabel} />
      {state !== 'ready' && (
        <div className="tri-google-map-message" role="status">
          {state === 'missing-key' ? 'Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to display Google Maps.'
            : state === 'loading' ? 'Loading Google Maps…' : state}
        </div>
      )}
      {state === 'ready' && !drawingPoints && !availablePoints.length && !layerPoints.length && (
        <div className="tri-google-map-no-points">{emptyMessage}</div>
      )}
    </div>
  );
}
