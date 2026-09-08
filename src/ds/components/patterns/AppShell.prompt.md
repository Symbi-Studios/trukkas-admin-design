The console layout. Almost every screen is: KPI row, then a main column of cards, with an optional 320px rail of insight panels on the right.

```jsx
<AppShell sidebar={<Sidebar>…</Sidebar>} topbar={<TopBar user="Trukkas Admin" role="Super Admin" />}
          rail={<SectionCard title="Quick Actions">…</SectionCard>}>
  <PageHeader title="Fleet Management" />
</AppShell>
```
