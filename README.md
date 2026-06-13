# 北斗 Beidou

[![CI](https://github.com/sayagodev/beidou/actions/workflows/ci.yml/badge.svg)](https://github.com/sayagodev/beidou/actions/workflows/ci.yml)

**Keyboard navigation overlay** — press a key, see letter badges on visible buttons, press the letter to click. Tiny, framework-agnostic, zero runtime dependencies.

| Artifact | Size | Gzipped |
|----------|------|---------|
| `dist/index.mjs` (ESM bundlers) | ~16.0 KB | ~4.0 KB |
| `dist/index.min.mjs` (ESM minified) | ~7.7 KB | ~2.7 KB |
| `dist/index.d.ts` (TypeScript types) | ~1.9 KB | — |

Zero runtime dependencies. TypeScript types included. Minified builds available via `@sayagodev/beidou/min`.

---

## Quick Start

### Vanilla JS

```html
<div data-ko-ctx="root">
  <button onclick="alert('Hola')">Saludar</button>
  <button data-ko-target="menu">Menú ▾</button>

  <div data-ko-ctx="menu">
    <button onclick="alert('Opción 1')">Opción 1</button>
    <button data-ko-back>Cerrar</button>
  </div>
</div>

<script type="module">
  import Beidou from "https://unpkg.com/@sayagodev/beidou";
  new Beidou();
</script>
```

### ESM / TypeScript

```ts
import Beidou from "@sayagodev/beidou";
// or minified: import Beidou from "@sayagodev/beidou/min";

// Full type-safety with autocomplete:
new Beidou({
  ring: { color: "#8b5cf6", style: "solid" },
  badge: { bg: "#16a34a" },
  position: "bottom-right",
});
```

All config interfaces (`RingConfig`, `BadgeConfig`, `CustomPosition`, `Position`, `BeidouConfig`) are exported for advanced use. TypeScript will autocomplete every option.

---

## Framework Integration

### Next.js (App Router)

```tsx
// components/BeidouProvider.tsx
"use client";

import { useEffect, useRef } from "react";
import Beidou from "@sayagodev/beidou";

export default function BeidouProvider() {
  const nav = useRef<Beidou | null>(null);

  useEffect(() => {
    nav.current = new Beidou({ /* config */ });
    return () => nav.current?.destroy();
  }, []);

  return null; // just for side effects
}
```

```tsx
// app/layout.tsx
import BeidouProvider from "@/components/BeidouProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <BeidouProvider />
        {children}
      </body>
    </html>
  );
}
```

### React (Vite / CRA)

```tsx
// hooks/useBeidou.ts
import { useEffect, useRef } from "react";
import Beidou from "@sayagodev/beidou";

export function useBeidou(config = {}) {
  const nav = useRef<Beidou | null>(null);

  useEffect(() => {
    nav.current = new Beidou(config);
    return () => nav.current?.destroy();
  }, []);

  return nav;
}
```

Usage in a component:

```tsx
export default function Panel() {
  useBeidou({ position: "bottom-left" });

  return (
    <div data-ko-ctx="root">
      <button onClick={() => alert("Hola")}>Saludar</button>
      <button data-ko-target="menu">Menú ▾</button>
      <div data-ko-ctx="menu">
        <button onClick={() => console.log("opción")}>Opción</button>
        <button data-ko-back>Cerrar</button>
      </div>
    </div>
  );
}
```

> **Note:** React re-creates the DOM on re-renders. The `data-ko-key` attributes Beidou sets are lost after a re-render — that's fine, they get reassigned on the next Alt press.

### Key Points for Next.js & React

| Concern | How to handle |
|---------|---------------|
| **SSR** | Only instantiate in `useEffect` — never in the module scope or constructor of a server component. |
| **Destroy** | Call `nav.destroy()` in the `useEffect` cleanup return to remove event listeners and injected styles. |
| **Re-renders** | `data-ko-key` gets cleared on re-render. Re-press Alt to reassign. No memory leaks — event listeners live on `window`/`document`, not on DOM nodes. |
| **Dynamic content** | If you add/remove buttons after init, just press Alt again — Beidou re-queries the DOM each time. |
| **Multiple instances** | You only need one `<BeidouProvider />` / `useBeidou()` at the app root level. |

---

## How It Works

1. Press **`Alt`** (configurable) → letters A–Z appear on every **visible** `<button>`, `<a>`, `[role="button"]`, `[onclick]` inside the active context. Hidden elements (collapsed menus, `display: none`, off-screen) are automatically skipped.
2. Press the letter → triggers that element:
   - `[data-ko-target="id"]` → opens that sub-context.
   - `[data-ko-back]` → closes sub-context, returns to `root`.
   - Any other button/link → fires `.click()`.
3. Press `Alt` again → toggle off. Click empty space → closes and deactivates.

### HTML Attributes

| Attribute | Role |
|-----------|------|
| `data-ko-ctx="root"` | Top-level container (always visible) |
| `data-ko-ctx="<id>"` | Sub-context (auto-hidden, shown via `.is-open`) |
| `data-ko-target="<id>"` | Trigger that opens a sub-context |
| `data-ko-back` | Closes sub-context, returns to root |
| `data-ko-skip` | Excludes an element from getting a shortcut |

**No CSS classes needed.** Beidou injects all functional styles via `[data-ko-ctx]` and `[data-ko-key]` selectors.

---

## Configuration

All options are optional:

```js
new Beidou({
  key: "Alt",                    // activation key
  keys: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",  // symbols assigned as shortcuts

  ring: {                        // outline around focused element
    color: "#0284c7",            // any CSS color
    style: "dashed",             // solid | dashed | dotted
    width: 2,                    // px
    offset: -2,                  // outline-offset px
    inputColor: "#059669",       // ring color for inputs/textareas/selects
    inputStyle: "dashed",        // ring style for inputs/textareas/selects
  },

  badge: {                       // letter badge
    bg: "#f97316",               // background color
    color: "white",              // text color
    size: 11,                    // font-size px
    weight: 800,                 // font-weight
    radius: 4,                   // border-radius px
    padding: "2px 6px",          // padding shorthand
    shadow: "0 2px 4px rgba(0,0,0,0.3)",
    inputBg: "#059669",          // badge bg for inputs/textareas/selects
    inputColor: "white",         // badge text color for inputs
    inputBorder: "none",         // badge border for inputs
  },

  position: "top-right",         // badge position
  // "top-left" | "top-right" | "bottom-left" | "bottom-right"
  // or custom: { top: -8, right: -8 }
})
```

### Via CSS Variables

Beidou sets CSS custom properties on `:root`. Override them in your stylesheet without touching JS:

```css
:root {
  --ko-ring-c: #2563eb;
  --ko-ring-s: solid;
  --ko-badge-bg: #16a34a;
  --ko-badge-rad: 999px;
  --ko-badge-t: -12px;
  --ko-badge-r: -12px;
}
```

Per-element overrides also work:

```css
.danger-btn { --ko-ring-c: #dc2626; }
```

All available variables:

| Variable | Default | Controls |
|----------|---------|----------|
| `--ko-ring-c` | `#0284c7` | Ring color |
| `--ko-ring-s` | `dashed` | Ring style |
| `--ko-ring-w` | `2px` | Ring width |
| `--ko-ring-o` | `-2px` | Ring offset |
| `--ko-badge-bg` | `#f97316` | Badge background |
| `--ko-badge-fg` | `white` | Badge text color |
| `--ko-badge-size` | `11px` | Font size |
| `--ko-badge-w` | `800` | Font weight |
| `--ko-badge-p` | `2px 6px` | Padding |
| `--ko-badge-rad` | `4px` | Border radius |
| `--ko-badge-sh` | `…` | Box shadow |
| `--ko-input-ring` | `#059669` | Input ring color |
| `--ko-input-ring-s` | `dashed` | Input ring style |
| `--ko-input-bg` | `#059669` | Input badge background |
| `--ko-input-fg` | `white` | Input badge text color |
| `--ko-input-border` | `none` | Input badge border |

> **Note:** Badge position (`top`, `right`, `bottom`, `left` offsets) is controlled via the `position` config option in JavaScript, not CSS variables. Each badge's coordinates are computed dynamically relative to its target element's bounding rect.

---

## Public API

```js
const nav = new Beidou(opts);
nav.open("menu");     // switch to a sub-context
nav.reset();           // return to root, close all sub-contexts
nav.destroy();         // remove styles & event listeners, cleanup
```

---

## Installation

```bash
pnpm add @sayagodev/beidou
npm install @sayagodev/beidou
yarn add @sayagodev/beidou
```

Or from CDN (ESM):

```html
<script type="module">
  import Beidou from "https://unpkg.com/@sayagodev/beidou";
  new Beidou();
</script>
```

---

## Examples

### Nested Menus

```html
<div data-ko-ctx="root">
  <button data-ko-target="settings">⚙️ Settings</button>
  <div data-ko-ctx="settings">
    <button data-ko-target="profile">Profile</button>
    <button data-ko-target="security">Security</button>
    <button data-ko-back>← Back</button>
  </div>
  <div data-ko-ctx="profile">
    <button onclick="edit()">Edit</button>
    <button data-ko-back>← Back</button>
  </div>
  <div data-ko-ctx="security">
    <button onclick="changePw()">Change Password</button>
    <button data-ko-back>← Back</button>
  </div>
</div>
```

### Exclude an Element

```html
<button data-ko-skip>This won't get a shortcut</button>
```

### Custom Symbols

```js
new Beidou({
  keys: "★◆▲●♡",       // 5 custom symbols
  keys: "0123456789",    // digits instead of letters
  keys: "ABCDEF",        // only 6 keys
});
```

---

## Browser Support

All modern browsers (Chrome, Firefox, Safari, Edge). Requires `Element.closest()` and `CSS.escape()` — no transpilation needed.

---

## Development

```bash
git clone https://github.com/sayagodev/beidou.git
cd beidou
pnpm install     # reproducible install (CI uses --frozen-lockfile)
pnpm run build   # dist/index.{mjs,min.mjs} + .d.ts
pnpm run typecheck
pnpm run demo    # build + serve index.html at http://localhost:8765
```

Open `index.html` in the browser after building (or use `pnpm run demo`). Press **Alt** to toggle shortcut badges.

---

## License

MIT © sayago;dev
