Every list view. Put it inside a `<SectionCard pad="none">` with a TableToolbar above and Pagination below. The first cell is usually a blue record link plus a grey sub-line; the last is an IconButton overflow.

```jsx
<DataTable selectable columns={cols} rows={rows} onRowClick={open} />
```
