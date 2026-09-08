The overflow sheet behind "More Actions" and the row "⋮". Long menus are grouped under uppercase section headings; destructive rows are red and sit last.

```jsx
<DropdownMenu items={[
  { section: 'Manage rule' },
  { label: 'Duplicate Fee Rule', icon: 'copy' },
  { divider: true },
  { label: 'Delete Fee Rule', icon: 'trash-2', tone: 'danger' },
]} />
```
