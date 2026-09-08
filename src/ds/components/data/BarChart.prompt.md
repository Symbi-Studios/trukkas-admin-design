Revenue & Payouts Trend, Payment Trend, User Growth. Rounded 3px bar caps, grouped by period.

```jsx
<BarChart labels={['May','Jun','Jul']} format={v => '₦' + Math.round(v/1e6) + 'M'}
          series={[{ points: [40e6, 52e6, 61e6] }, { points: [22e6, 30e6, 33e6] }]} />
```
