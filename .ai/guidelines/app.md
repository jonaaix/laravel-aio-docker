# App guidelines

## Design system

- Phones (below the `sm` breakpoint) use a 15 px root font size; everything sized in rem scales with
  it, so controls are 34 px tall there instead of 36 px. Form fields stay at 16 px on phones, because
  iOS zooms into smaller fields.
- A modal that can open on top of another one opens through Nuxt UI's `useOverlay` (created with
  `destroyOnClose`, forwarding `after:leave`), never as a modal mounted with the layout: modals stack in
  the order they were mounted, so one mounted at page load ends up beneath every later one.
