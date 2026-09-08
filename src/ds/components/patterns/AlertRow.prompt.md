Dashboard "Alerts & Pending Actions". Each row states the queue, its size and the one action allowed on it.

```jsx
<AlertRow icon="wallet" title="Payouts awaiting release" description="Approved and ready for release"
          count={8} action={<Button size="sm" variant="outline">Review</Button>} />
```
