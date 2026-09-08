Status Timeline, Demurrage Timeline, Notification History, Verification Status. Node colour carries state; pending nodes are hollow.

```jsx
<Timeline items={[
  { title: 'Discharge Completed', time: 'May 15, 2026 · 08:42 AM', description: 'Container discharged at Apapa Port', icon: 'check' },
  { title: 'Current Status', state: 'current', time: 'May 28, 2026', description: '7 days overdue and ongoing' },
  { title: 'Final Decision', state: 'pending', description: 'Pending' },
]} />
```
