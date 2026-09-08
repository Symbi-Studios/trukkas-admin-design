Filter strip above a DataTable. "Clear All" is the one place orange text appears on the light shell.

```jsx
<TableToolbar search={<SearchField placeholder="Search by name, email or phone..." />}
  filters={<><FilterSelect label="All Roles" /><FilterSelect label="All Statuses" /></>}
  onClear={reset} />
```
