Micro trend line inside a StatCard on the analytics page. No axes, no dots, no fill.

```jsx
<StatCard label="Total Revenue" value="₦128.4M" delta="18.7%"
          sparkline={<Sparkline points={[3,5,4,8,6,9]} color="var(--tk-viz-5)" />} />
```
