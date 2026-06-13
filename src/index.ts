/* ---------- types ---------- */

export interface RingConfig {
  color?: string;
  style?: string;
  width?: number;
  offset?: number;
  inputColor?: string;
  inputStyle?: string;
}

export interface BadgeConfig {
  bg?: string;
  color?: string;
  size?: number;
  weight?: number;
  radius?: number;
  padding?: string;
  shadow?: string;
  inputBg?: string;
  inputColor?: string;
  inputBorder?: string;
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
  ring: { color: "#0284c7", style: "dashed", width: 2, offset: -2, inputColor: "#059669", inputStyle: "dashed" },
  badge: {
    bg: "#f97316",
    color: "white",
    size: 11,
    weight: 800,
    radius: 4,
    padding: "2px 6px",
    shadow: "0 2px 4px rgba(0,0,0,0.3)",
    inputBg: "#059669",
    inputColor: "white",
    inputBorder: "none",
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

/**
 * Checks whether an element is effectively visible to the user.
 *
 * An element is considered visible when ALL of the following are true:
 * - It (or an ancestor) is not `display: none` — detected via `offsetParent`
 *   (with special handling for `position: fixed/sticky` elements whose
 *   `offsetParent` is always `null`).
 * - Its computed `visibility` is not `hidden`.
 * - Its bounding rect intersects with the viewport (not completely off-screen).
 * - It has non-zero dimensions (width > 0 and height > 0).
 * - It is not fully clipped by an ancestor with `overflow: hidden/clip`
 *   (e.g. collapsed sub-menus using `max-height: 0; overflow: hidden`).
 */
function isVisible(el: HTMLElement): boolean {
  const s = getComputedStyle(el);
  if (s.visibility === "hidden" || s.display === "none") return false;
  if (!el.offsetParent && s.position !== "fixed" && s.position !== "sticky") return false;

  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;

  /* Element must intersect the viewport */
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) return false;

  /* Check if clipped by an ancestor with overflow: hidden/clip.
     This catches collapsed containers like `.nav-sub { max-height: 0;
     overflow: hidden }` where children still report their natural
     bounding rect but are visually clipped to zero height. */
  if (isClippedByAncestor(el, r)) return false;

  return true;
}

/**
 * Walks up the DOM tree from `el` to check if any ancestor with
 * `overflow: hidden` or `overflow: clip` fully clips the element's
 * bounding rect. Returns `true` if the element is fully hidden.
 */
function isClippedByAncestor(el: HTMLElement, elRect: DOMRect): boolean {
  let node = el.parentElement;
  while (node && node !== document.documentElement) {
    const st = getComputedStyle(node);
    const ov = st.overflow + st.overflowX + st.overflowY;
    if (ov.includes("hidden") || ov.includes("clip")) {
      const pr = node.getBoundingClientRect();
      /* Element is fully outside the ancestor's clipping rect */
      if (
        elRect.bottom <= pr.top ||
        elRect.top >= pr.bottom ||
        elRect.right <= pr.left ||
        elRect.left >= pr.right
      ) return true;
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * Computes the badge's `top` and `left` coordinates (for `position: fixed`)
 * given the target element's bounding rect and the user's position config.
 *
 * The position config may specify any combination of `top`, `bottom`, `right`,
 * `left` offsets. The logic anchors the badge to the corresponding edge of the
 * element's rect:
 *
 * - `top` present  → badge.top  = rect.top  + offset
 * - `bottom` present (no `top`) → badge.top  = rect.bottom + offset
 * - `right` present → badge.left = rect.right + offset
 * - `left` present (no `right`) → badge.left = rect.left  + offset
 *
 * Falls back to top-right (`{ top: 0, right: 0 }`) when no axes are specified.
 */
function computeBadgePos(
  rect: DOMRect,
  pos: CustomPosition,
): { top: number; left: number } {
  return {
    top: pos.top != null ? rect.top + pos.top : (pos.bottom != null ? rect.bottom + pos.bottom : rect.top),
    left: pos.right != null ? rect.right + pos.right : (pos.left != null ? rect.left + pos.left : rect.right)
  };
}

/* ---------- class ---------- */

export default class Beidou {
  private _key: string;
  private _keys: string;
  private _context = "root";
  private _active = false;
  private _position: CustomPosition = {};
  private _badgeMap = new Map<HTMLElement, HTMLElement>();

  /* buffer for multi-character key sequences */
  private _buf = "";
  private _bufTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: BeidouConfig = {}) {
    const cfg = this._resolve(opts);
    this._key = cfg.key;
    this._keys = cfg.keys;
    this._position = cfg.position;

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
  }) {
    if (document.getElementById("ko-fn")) return;

    const fn = document.createElement("style");
    fn.id = "ko-fn";
    fn.textContent = `
[data-ko-ctx]:not([data-ko-ctx="root"]){display:none}
[data-ko-ctx].is-open{display:block}
[data-ko-key]{outline:var(--ko-ring-w) var(--ko-ring-s) var(--ko-ring-c)!important;outline-offset:var(--ko-ring-o)}
input[data-ko-key],textarea[data-ko-key],select[data-ko-key]{outline:var(--ko-ring-w) var(--ko-input-ring-s) var(--ko-input-ring)!important;outline-offset:var(--ko-ring-o)}
.ko-badge{position:fixed;top:var(--ko-bt);left:var(--ko-bl);background:var(--ko-badge-bg);color:var(--ko-badge-fg);font-size:var(--ko-badge-size);font-weight:var(--ko-badge-w);font-family:system-ui,-apple-system,sans-serif;padding:var(--ko-badge-p);border-radius:var(--ko-badge-rad);box-shadow:var(--ko-badge-sh);pointer-events:none;z-index:99999;line-height:1}
.ko-badge-input{background:var(--ko-input-bg);color:var(--ko-input-fg);border:var(--ko-input-border)}
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
--ko-input-bg:${cfg.badge.inputBg};
--ko-input-fg:${cfg.badge.inputColor};
--ko-input-border:${cfg.badge.inputBorder};
--ko-input-ring:${cfg.ring.inputColor};
--ko-input-ring-s:${cfg.ring.inputStyle};
}`;
    document.head.appendChild(vars);
  }

  /* ---------- lifecycle ---------- */

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === this._key || e.code === this._key) {
      if (this._active) { this._active = false; this._clearBuf(); this._clearKeys(); return; }
      e.preventDefault();
      (document.activeElement as HTMLElement | null)?.blur();
      this._active = true;
      this._clearBuf();
      this._assignKeys();
      return;
    }

    if (!this._active) return;

    /* allow normal typing when focused on editable elements */
    const ae = document.activeElement as HTMLElement | null;
    if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.tagName === "SELECT" || ae.isContentEditable)) return;

    const letter = e.key.toUpperCase();
    /* ignore modifier-only keys */
    if (letter.length !== 1 || letter < " " || letter > "~") return;

    e.preventDefault();
    this._buf += letter;

    /* cancel any pending buffer timeout */
    if (this._bufTimer) clearTimeout(this._bufTimer);

    const keys = Array.from(document.querySelectorAll<HTMLElement>("[data-ko-key]"));
    const exact = keys.find(el => el.getAttribute("data-ko-key") === this._buf);
    const longer = keys.some(el => (el.getAttribute("data-ko-key") || "").startsWith(this._buf) && el.getAttribute("data-ko-key") !== this._buf);

    if (longer) {
      this._bufTimer = setTimeout(() => {
        if (exact) this._executeTarget(exact);
        this._clearBuf();
      }, exact ? 250 : 500);
    } else if (exact) {
      this._executeTarget(exact);
      this._clearBuf();
    } else {
      this._clearBuf();
    }
  };

  private _executeTarget(el: HTMLElement) {
    if (el.hasAttribute("data-ko-target")) {
      this.open(el.getAttribute("data-ko-target")!);
    } else if (el.hasAttribute("data-ko-back")) {
      this.reset();
    } else if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") {
      this._active = false;
      this._clearKeys();
      this._clearBuf();
      (el as HTMLInputElement).focus();
      /* Don't call reset() here — the element might be inside a sub-context
         (e.g. a slide panel). Calling reset() would close the sub-context
         and remove the element from view. Instead, keep the current context
         open so the user can interact with the focused field. */
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
      'button,a,[data-ko-target],[data-ko-back],[role="button"],[onclick],input,textarea,select'
    )) return;

    this._active = false;
    this._clearBuf();
    this._clearKeys();
    this.reset();
  };

  private _onScroll = () => this._posBadges();

  private _listen() {
    window.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("click", this._onClick);
    window.addEventListener("scroll", this._onScroll, { passive: true });
    window.addEventListener("resize", this._onScroll, { passive: true });
  }

  private _unlisten() {
    window.removeEventListener("keydown", this._onKeyDown);
    document.removeEventListener("click", this._onClick);
    window.removeEventListener("scroll", this._onScroll);
    window.removeEventListener("resize", this._onScroll);
  }

  /* ---------- key management ---------- */

  private _clearKeys() {
    document.querySelectorAll<HTMLElement>("[data-ko-key]").forEach(el => {
      el.removeAttribute("data-ko-key");
    });
    document.querySelectorAll<HTMLElement>(".ko-badge").forEach(el => el.remove());
    this._badgeMap.clear();
  }

  /**
   * Repositions all badge DOM elements to follow their target elements.
   * Uses `position: fixed` coordinates computed from each element's
   * bounding rect and the user's position config.
   *
   * Also hides badges for elements that are no longer visible.
   */
  private _posBadges() {
    if (!this._active) return;
    const p = this._position;

    this._badgeMap.forEach((badge, el) => {
      const vis = isVisible(el);

      if (!vis) {
        /* Hide the badge by moving it off-screen */
        badge.style.setProperty("--ko-bt", "-9999px");
        badge.style.setProperty("--ko-bl", "-9999px");
        return;
      }

      const r = el.getBoundingClientRect();
      const { top, left } = computeBadgePos(r, p);
      badge.style.setProperty("--ko-bt", top + "px");
      badge.style.setProperty("--ko-bl", left + "px");
    });
  }

  /**
   * Assigns keyboard shortcut keys to all visible interactive elements
   * within the active context. Only elements that pass the `isVisible()`
   * check receive a key assignment — hidden, collapsed, or off-screen
   * elements are skipped.
   */
  private _assignKeys() {
    this._clearKeys();
    this._clearBuf();
    if (!this._active) return;

    const ctx = document.querySelector(`[data-ko-ctx="${CSS.escape(this._context)}"]`);
    if (!ctx) return;

    const all = ctx.querySelectorAll<HTMLElement>(
      'button,a[href],[data-ko-target],[data-ko-back],[role="button"],[onclick],input:not([type="hidden"]):not([type="file"]),textarea,select'
    );
    const els = Array.from(all).filter(el => {
      if (el.closest("[data-ko-ctx]") !== ctx) return false;
      if (!isVisible(el)) return false;

      /* Exclude container elements that only block event propagation */
      const onclickAttr = el.getAttribute("onclick");
      if (onclickAttr) {
        const clean = onclickAttr.replace(/\s+/g, "");
        if (clean === "event.stopPropagation()" || clean === "event.stopPropagation();") {
          return false;
        }
      }
      return true;
    });

    let i = 0;
    for (const el of els) {
      if (el.hasAttribute("data-ko-skip")) continue;
      const key = keyAtIndex(i, this._keys);
      el.setAttribute("data-ko-key", key);

      const badge = document.createElement("span");
      badge.className = "ko-badge";
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") {
        badge.classList.add("ko-badge-input");
      }
      badge.textContent = key;
      document.body.appendChild(badge);
      this._badgeMap.set(el, badge);

      i++;
    }
    requestAnimationFrame(() => this._posBadges());
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
