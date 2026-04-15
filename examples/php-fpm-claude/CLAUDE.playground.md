# Project context

This is a **prototyping playground** for a non-technical user. Its purpose: a space for the user to explore ideas, with you (Claude) as the implementer.

## Workspace model
- `/app` is a Laravel application (Livewire + Volt + Tailwind). This is the primary project.
- `/app/sideprojects/<name>/` is where non-Laravel sub-projects live (Python analyses, Node tools, one-off scripts, ML experiments, anything computational). All committed to the same repo.
- The Laravel app is the **bridge to the user's browser** — UI, database, authentication. It is not the only tool.

## When to use which
- **Laravel (Livewire/Blade)** — anything the user needs to see, click, or persist in a database.
- **Sideprojects** — one-off analyses, data transforms, scraping, ML, report generation. Any language (Python, Node, shell, Go, ...). Return results as files (`.json`, `.csv`, `.md`, `.html`) and reference them by path.
- **Mixed** — fine to have a Python script produce data and a Livewire component visualize it.

## UI framework
- **Flux UI** is the default component library. Use `<flux:input>`, `<flux:button>`, `<flux:modal>`, etc. Check the Flux docs before building anything UI-related.
- If Flux does not have a suitable component, **choose based on effort**:
  - **Self-build** a custom Blade/Livewire component if it's a reasonable amount of work (simple form widgets, custom cards, layout pieces). Place it under `resources/views/components/` and match the Flux design language (same spacing, colors, radius). Reuse it.
  - **Reach for a plugin** when the component is a complex beast on its own — full-featured calendars, rich-text/WYSIWYG editors, advanced data tables, charts, file uploaders, drag-and-drop kanbans. Reinventing these is overkill; pick a well-maintained package and integrate it cleanly.
- Do NOT write raw Tailwind one-offs for UI elements that could be reused — extract into a component.
- Do NOT install other general-purpose UI libraries (Flowbite, daisyUI, etc.) — stay on Flux. Specialized plugins for complex widgets are fine.

## Frontend stack boundaries
- **Livewire + Volt** is the interactivity layer. Single-file Volt components are the fastest path — prefer them.
- **Plain Blade + Tailwind** for static pages with no interactivity.
- **Filament** — install on demand ONLY when the user explicitly asks for an admin panel or heavy CRUD management. Do not reach for it for public pages, dashboards, or custom flows — it is opinionated and fights non-CRUD use cases.
- **Vue / React / Inertia** — do not use unless the user explicitly asks.

## Output back to the user
- Data/reports → files in the workspace, reference by path. The user can retrieve them from the container.
- Interactive things → Livewire route, give the user the URL.
- Do NOT paste large file contents or long tool outputs into chat — files are cheaper and persistent.

## Dependencies
- Install freely with `composer`, `npm`, `apt-get`, `pip`, `uv`. Sudo is available without password.
- Isolate sideproject deps (Python venv, separate `package.json`) to avoid conflicts with the Laravel app.
- When adding a composer/npm package to the Laravel app, explain briefly why it's needed.
