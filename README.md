# 北斗 Beidou

**Keyboard navigation overlay** — press a key, see letter badges on buttons, press the letter to click. Tiny, framework-agnostic, zero dependencies.

~5 KB minified · ~2 KB gzipped

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

<script src="https://unpkg.com/@sayagodev/beidou"></script>
<script>new Beidou();</script>
```

### ESM / TypeScript

```ts
import Beidou from "@sayagodev/beidou";

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

### Vue 3

```vue
<!-- composables/useBeidou.ts -->
<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";
import Beidou from "@sayagodev/beidou";

let nav: Beidou | null = null;

export function useBeidou(config = {}) {
  onMounted(() => { nav = new Beidou(config); });
  onBeforeUnmount(() => nav?.destroy());
  return nav;
}
</script>
```

```vue
<!-- App.vue -->
<template>
  <div data-ko-ctx="root">
    <button @click="alert('Hola')">Saludar</button>
    <button data-ko-target="menu">Menú ▾</button>
    <div data-ko-ctx="menu">
      <button @click="handler">Opción</button>
      <button data-ko-back>Cerrar</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useBeidou } from "./composables/useBeidou";
useBeidou({ ring: { color: "#8b5cf6" } });
</script>
```

### Svelte 5

```svelte
<!-- +page.svelte -->
<script>
  import { onMount, onDestroy } from "svelte";
  import Beidou from "@sayagodev/beidou";

  let nav;
  onMount(() => { nav = new Beidou(); });
  onDestroy(() => nav?.destroy());
</script>

<div data-ko-ctx="root">
  <button onclick={() => alert("Hola")}>Saludar</button>
  <button data-ko-target="menu">Menú ▾</button>
  <div data-ko-ctx="menu">
    <button onclick={() => console.log("ok")}>Opción</button>
    <button data-ko-back>Cerrar</button>
  </div>
</div>
```

### Key Points for All Frameworks

| Concern | How to handle |
|---------|---------------|
| **SSR** | Only instantiate in `useEffect`/`onMounted` — never in the module scope or constructor of a server component. |
| **Destroy** | Call `nav.destroy()` in the cleanup (`useEffect` return / `onBeforeUnmount` / `onDestroy`) to remove event listeners and injected styles. |
| **Re-renders** | `data-ko-key` gets cleared on re-render. Re-press Alt to reassign. No memory leaks — event listeners live on `window`/`document`, not on DOM nodes. |
| **Dynamic content** | If you add/remove buttons after init, just press Alt again — Beidou re-queries the DOM each time. |
| **Multiple instances** | You only need one `<BeidouProvider />` / `useBeidou()` at the app root level. |

---

## How It Works

1. Press **`Alt`** (configurable) → letters A–Z appear on every `<button>`, `<a>`, `[role="button"]`, `[onclick]` inside the active context.
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
  },

  badge: {                       // letter badge
    bg: "#f97316",               // background color
    color: "white",              // text color
    size: 11,                    // font-size px
    weight: 800,                 // font-weight
    radius: 4,                   // border-radius px
    padding: "2px 6px",          // padding shorthand
    shadow: "0 2px 4px rgba(0,0,0,0.3)",
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
| `--ko-badge-t` | `-8px` | Top position |
| `--ko-badge-r` | `-8px` | Right position |
| `--ko-badge-b` | `auto` | Bottom position |
| `--ko-badge-l` | `auto` | Left position |

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
npm install @sayagodev/beidou
pnpm add @sayagodev/beidou
yarn add @sayagodev/beidou
```

Or from CDN:

```html
<script src="https://unpkg.com/@sayagodev/beidou"></script>
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

## License

MIT © sayago;dev
