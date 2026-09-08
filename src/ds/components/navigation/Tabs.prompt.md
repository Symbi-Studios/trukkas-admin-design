Section switcher inside a detail page ("Overview / Calculation / Timeline / Documents") or above a list ("All Announcements / Published / Scheduled"). Counts go in parentheses.

```jsx
<Tabs value={tab} onChange={setTab} items={['Overview', { value: 'docs', label: 'Documents', count: 6 }]} />
```
