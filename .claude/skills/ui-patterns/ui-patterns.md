# UI Patterns

Concrete class recipes for this project. Decisions and rationale live in the Design System
rules of the agent guidelines (`CLAUDE.md` / `AGENTS.md`).

## Card surface

```html
<div class="rounded-xl bg-white ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-white/10">
```

## Buttons

- **CTA (one-off):** `bg-primary-600 hover:bg-primary-500 text-white font-medium shadow-sm`
- **Primary, persistent:** `bg-primary-100 text-primary-800 hover:bg-primary-200
  dark:bg-primary-500/15 dark:text-primary-200 dark:hover:bg-primary-500/25`
- **Secondary:** `bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800
  dark:text-gray-300 dark:hover:bg-gray-700`
- **Outline / ghost:** transparent with `ring-1 ring-gray-200`
- **Destructive:** `bg-red-600 hover:bg-red-500 text-white`, only behind a confirmation

## Icon boxes

- **Prominent** (beside a stat number), 40×40 box, SVG 20×20:
  `flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-500/10`
- **Inline** (beside an h3), 28×28 box, SVG 16×16:
  `flex h-7 w-7 items-center justify-center rounded-md bg-primary-50 dark:bg-primary-500/10`

## Field groups

Related values read as one object: segments in a shared frame, hairline dividers, a caption
above each value. Tint the whole group when its state is the message.

```html
<div class="flex w-fit divide-x overflow-hidden rounded-lg ring-1 ring-gray-200">
  <div class="min-w-[100px] px-4 py-2.5">
    <p class="text-[10px] font-medium uppercase tracking-wide text-gray-500">Stock</p>
    <p class="mt-0.5 text-sm font-medium text-gray-900">Sold out</p>
  </div>
</div>
```

## Floating bars

```css
border-radius: 9999px;
background-color: rgb(255 255 255 / 0.8);          /* dark: rgb(17 24 39 / 0.8) */
backdrop-filter: blur(28px) saturate(180%);
box-shadow: 0 0 0 1px rgb(0 0 0 / .08),            /* dark: rgb(255 255 255 / .12) */
            0 4px 12px -2px rgb(0 0 0 / .26),
            0 28px 64px -12px rgb(0 0 0 / .62);
```

A hairline holds the edge, the shadows do the lifting — on a dark page the shadow has
nothing left to darken, so the edge keeps the bar from sinking into the rows.

## Tabs (underline)

```html
<button class="flex items-center gap-1.5 border-b-2 border-transparent px-4 py-2.5 text-sm
               font-medium text-gray-500 hover:text-gray-700
               dark:text-gray-400 dark:hover:text-gray-300"
        :class="active && 'border-primary-500 text-primary-600 dark:text-primary-400'">
```

Icon leads, label follows, a count or status icon trails in grey.

## Typography

- h1 `text-2xl font-bold tracking-tight` (lg `text-3xl`), h2 `text-base font-semibold`
- Body `text-sm text-gray-700 dark:text-gray-300`
- Muted `text-xs text-gray-500 dark:text-gray-400`
- Caption above a value `text-[10px] font-medium uppercase tracking-wide text-gray-500`

## Badges & pills

`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium`, status colours from
Tailwind's named palette. Micro pills: `px-1.5 py-0.5 text-[10px] font-medium rounded`.

## Dividers

Between sections `border-b border-gray-200 dark:border-white/10`, inside compact lists
`divide-y divide-gray-100 dark:divide-white/10`.
