Chrome for Live Tracking, Truck & Container Positions and the dashboard Live Fleet Map: title, live dot, legend overlay, expand. The map surface itself is the consumer's — the design system deliberately does not draw one.

```jsx
<MapPanel title="Live Map" status="687 active trips" onExpand={full}
  legend={[{ label: 'In Transit', color: 'var(--tk-blue)' }, { label: 'Loading', color: 'var(--tk-warning)' }]}>
  <MyLeafletMap />
</MapPanel>
```
