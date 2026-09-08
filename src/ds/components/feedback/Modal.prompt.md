Not in the source screenshots — the console's screens only ever showed a modal trigger ("Filters", "Add Truck") in its closed state, never the dialog itself. Added because the prototype needs real data-entry surfaces. Follows the same shell as `DropdownMenu`: white, `--tk-r-2xl` corners, `--tk-shadow-modal`, navy `--tk-scrim` backdrop.

```jsx
const [open, setOpen] = useState(false);
<Button onClick={() => setOpen(true)}>Add Truck</Button>
<Modal open={open} onClose={() => setOpen(false)} title="Add Truck"
  description="Register a new truck to the fleet."
  footer={<>
    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
    <Button onClick={handleSave}>Save Truck</Button>
  </>}>
  <TextField label="Plate Number" />
</Modal>
```
