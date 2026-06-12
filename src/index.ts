/* ---------- types ---------- */

export interface RingConfig {
  color?: string;
  style?: string;
  width?: number;
  offset?: number;
}

export interface BadgeConfig {
  bg?: string;
  color?: string;
  size?: number;
  weight?: number;
  radius?: number;
  padding?: string;
  shadow?: string;
}

export interface CustomPosition {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export type PositionPreset = "top-right" | "top-left" | "bottom-right" | "bottom-left";

export type Position = PositionPreset | CustomPosition;

export interface BeidouConfig {
  key?: string;
  keys?: string;
  ring?: RingConfig;
  badge?: BadgeConfig;
  position?: Position;
}

/* ---------- defaults ---------- */

const DEFAULTS: {
  key: string;
  keys: string;
  ring: Required<RingConfig>;
  badge: Required<BadgeConfig>;
  position: PositionPreset;
} = {
  key: "Alt",
  keys: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ring: { color: "#0284c7", style: "dashed", width: 2, offset: -2 },
  badge: {
    bg: "#f97316",
    color: "white",
    size: 11,
    weight: 800,
    radius: 4,
    padding: "2px 6px",
    shadow: "0 2px 4px rgba(0,0,0,0.3)",
  },
  position: "top-right",
};

const POSITIONS: Record<PositionPreset, CustomPosition> = {
  "top-right": { top: -8, right: -8 },
  "top-left": { top: -8, left: -8 },
  "bottom-right": { bottom: -8, right: -8 },
  "bottom-left": { bottom: -8, left: -8 },
};

/* ---------- helpers ---------- */

const px = (v: number | undefined): string => (v != null ? v + "px" : "auto");

/** Excel-style column naming: A, B, ..., Z, AA, AB, ..., AZ, BA, ... */
function keyAtIndex(index: number, chars: string): string {
  let n = index + 1;
  let result = "";
  const base = chars.length;
  while (n > 0) {
    n--;
    result = chars[n % base] + result;
    n = Math.floor(n / base);
  }
  return result;
}

/* ---------- class ---------- */

export default class KeyboardOrchestrator {
  private _key: string;
  private _keys: string;
  private _context = "root";
  private _active = false;

  /* buffer for multi-character key sequences */
  private _buf = "";
  private _bufTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: BeidouConfig = {}) {
    const cfg = this._resolve(opts);
    this._key = cfg.key;
    this._keys = cfg.keys;

    this._injectStyles(cfg);
    this._listen();
  }

  /* ---------- config ---------- */

  private _resolve(opts: BeidouConfig) {
    const ring: Required<RingConfig> = { ...DEFAULTS.ring, ...opts.ring };
    const badge: Required<BadgeConfig> = { ...DEFAULTS.badge, ...opts.badge };
    const position = this._resolvePos(opts.position ?? DEFAULTS.position);
    return { key: opts.key ?? DEFAULTS.key, keys: opts.keys ?? DEFAULTS.keys, ring, badge, position };
  }

  private _resolvePos(pos: Position): CustomPosition {
    if (typeof pos === "string") return { ...(POSITIONS[pos] ?? POSITIONS["top-right"]) };
    return { ...pos };
  }

  /* ---------- styles ---------- */

  private _injectStyles(cfg: {
    ring: Required<RingConfig>;
    badge: Required<BadgeConfig>;
    position: CustomPosition;
  }) {
    if (document.getElementById("ko-fn")) return;

    const p = cfg.position;

    const fn = document.createElement("style");
    fn.id = "ko-fn";
    fn.textContent = `
[data-ko-ctx]:not([data-ko-ctx="root"]){display:none}
[data-ko-ctx].is-open{display:block}
[data-ko-key]{position:relative!important;outline:var(--ko-ring-w) var(--ko-ring-s) var(--ko-ring-c)!important;outline-offset:var(--ko-ring-o)}
[data-ko-key]::after{content:attr(data-ko-key);position:absolute;top:var(--ko-badge-t);right:var(--ko-badge-r);bottom:var(--ko-badge-b);left:var(--ko-badge-l);background:var(--ko-badge-bg);color:var(--ko-badge-fg);font-size:var(--ko-badge-size);font-weight:var(--ko-badge-w);font-family:system-ui,sans-serif;padding:var(--ko-badge-p);border-radius:var(--ko-badge-rad);box-shadow:var(--ko-badge-sh);pointer-events:none;z-index:9999;line-height:1}
`;
    document.head.appendChild(fn);

    const vars = document.createElement("style");
    vars.id = "ko-vars";
    vars.textContent = `:root{
--ko-ring-c:${cfg.ring.color};
--ko-ring-s:${cfg.ring.style};
--ko-ring-w:${cfg.ring.width}px;
--ko-ring-o:${cfg.ring.offset}px;
--ko-badge-bg:${cfg.badge.bg};
--ko-badge-fg:${cfg.badge.color};
--ko-badge-size:${cfg.badge.size}px;
--ko-badge-w:${cfg.badge.weight};
--ko-badge-p:${cfg.badge.padding};
--ko-badge-rad:${cfg.badge.radius}px;
--ko-badge-sh:${cfg.badge.shadow};
--ko-badge-t:${px(p.top)};
--ko-badge-r:${px(p.right)};
--ko-badge-b:${px(p.bottom)};
--ko-badge-l:${px(p.left)};
}`;
    document.head.appendChild(vars);
  }

  /* ---------- lifecycle ---------- */

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === this._key) {
      e.preventDefault();
      this._active = !this._active;
      this._clearBuf();
      this._assignKeys();
      return;
    }

    if (!this._active) return;

    const letter = e.key.toUpperCase();
    /* ignore modifier-only keys */
    if (letter.length !== 1 || letter < " " || letter > "~") return;

    e.preventDefault();
    this._buf += letter;

    /* cancel any pending buffer timeout */
    if (this._bufTimer) clearTimeout(this._bufTimer);

    /* look up buffer against assigned keys */
    const all = document.querySelectorAll<HTMLElement>("[data-ko-key]");
    const exact = Array.from(all).find(el => el.getAttribute("data-ko-key") === this._buf);
    const longer = Array.from(all).some(el => (el.getAttribute("data-ko-key") || "").startsWith(this._buf) && el.getAttribute("data-ko-key") !== this._buf);

    if (exact && !longer) {
      /* unique match — execute immediately */
      this._executeTarget(exact);
      this._clearBuf();
      return;
    }

    if (!exact && longer) {
      /* partial prefix — wait for more keys */
      this._bufTimer = setTimeout(() => this._clearBuf(), 500);
      return;
    }

    if (exact && longer) {
      /* exact match but longer keys also exist — wait briefly */
      this._bufTimer = setTimeout(() => {
        this._executeTarget(exact);
        this._clearBuf();
      }, 250);
      return;
    }

    /* no match — reset */
    this._clearBuf();
  };

  private _executeTarget(el: HTMLElement) {
    if (el.hasAttribute("data-ko-target")) {
      this.open(el.getAttribute("data-ko-target")!);
    } else if (el.hasAttribute("data-ko-back")) {
      this.reset();
    } else {
      this._active = false;
      this._clearKeys();
      el.click();
      this.reset();
    }
  }

  private _clearBuf() {
    this._buf = "";
    if (this._bufTimer) {
      clearTimeout(this._bufTimer);
      this._bufTimer = null;
    }
  }

  private _onClick = (e: MouseEvent) => {
    const t = (e.target as HTMLElement).closest("[data-ko-target]");
    if (t) {
      this.open(t.getAttribute("data-ko-target")!);
      return;
    }

    const b = (e.target as HTMLElement).closest("[data-ko-back]");
    if (b) {
      this.reset();
      return;
    }

    if ((e.target as HTMLElement).closest(
      'button,a,[data-ko-target],[data-ko-back],[role="button"],[onclick]'
    )) return;

    this._active = false;
    this._clearBuf();
    this._clearKeys();
    this.reset();
  };

  private _listen() {
    window.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("click", this._onClick);
  }

  private _unlisten() {
    window.removeEventListener("keydown", this._onKeyDown);
    document.removeEventListener("click", this._onClick);
  }

  /* ---------- key management ---------- */

  private _clearKeys() {
    document.querySelectorAll("[data-ko-key]").forEach(el => el.removeAttribute("data-ko-key"));
  }

  private _assignKeys() {
    this._clearKeys();
    this._clearBuf();
    if (!this._active) return;

    const ctx = document.querySelector(`[data-ko-ctx="${CSS.escape(this._context)}"]`);
    if (!ctx) return;

    const all = ctx.querySelectorAll<HTMLElement>(
      'button,a[href],[data-ko-target],[data-ko-back],[role="button"],[onclick]'
    );
    const els = Array.from(all).filter(el => el.closest("[data-ko-ctx]") === ctx);
    let i = 0;

    for (const el of els) {
      if (el.hasAttribute("data-ko-skip")) continue;
      el.setAttribute("data-ko-key", keyAtIndex(i, this._keys));
      i++;
    }
  }

  /* ---------- public API ---------- */

  open(id: string) {
    document.querySelectorAll("[data-ko-ctx]").forEach(el => el.classList.remove("is-open"));
    const next = document.querySelector(`[data-ko-ctx="${CSS.escape(id)}"]`);
    if (next) {
      next.classList.add("is-open");
      this._context = id;
    }
    if (this._active) this._assignKeys();
  }

  reset() {
    document.querySelectorAll("[data-ko-ctx]").forEach(el => el.classList.remove("is-open"));
    this._context = "root";
    if (this._active) this._assignKeys();
  }

  destroy() {
    this._active = false;
    this._clearKeys();
    this._clearBuf();
    this._unlisten();
    document.getElementById("ko-fn")?.remove();
    document.getElementById("ko-vars")?.remove();
  }
}
