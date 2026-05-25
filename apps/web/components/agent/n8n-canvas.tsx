"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

const STYLE_ID = "wekala-n8n-brand-overrides";

type Props = {
  /** Wekala's currently-active workspace name. We rewrite n8n's "Personal"
   *  project label to match it so the iframe breadcrumb stays consistent
   *  with the sidebar workspace switcher. */
  workspaceName: string;
};

export function N8nCanvas({ workspaceName }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  // Hold the latest name in a ref so the MutationObserver / polling
  // closures always see the current value without re-binding the effect.
  const workspaceNameRef = useRef(workspaceName);
  workspaceNameRef.current = workspaceName;

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    let observer: MutationObserver | null = null;
    let readyTimer: ReturnType<typeof setTimeout> | null = null;

    const HIDE_BY_LABEL = new Set(["Evaluations"]);
    const TAB_ANCESTOR_SELECTOR = 'a, button, li, [role="tab"], [class*="tab" i], [class*="Tab"]';

    // Promo rows we hide inside n8n's node creator panel. Each entry is a
    // visible text label; we walk up the DOM from the matched text node to
    // find the surrounding clickable row container and hide that.
    // Prefix-matched rows to hide inside n8n's node creator panel. We use
    // prefix matching so the rule survives n8n appending verified-badges or
    // version suffixes to the visible label.
    const HIDE_ROW_BY_PREFIX = [
      "AI Templates",
      // Cloud-only entries n8n injects via its dynamic-credentials module —
      // not real node types, so NODES_EXCLUDE can't reach them.
      "Eden AI Chat Model",
      "Baseten Chat Model",
    ];

    const hideRowByLabel = (doc: Document) => {
      try {
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
          const t = node as Text;
          const text = (t.nodeValue ?? "").trim();
          const matches = text && HIDE_ROW_BY_PREFIX.some((p) => text.startsWith(p));
          if (matches) {
            let el: HTMLElement | null = t.parentElement;
            // Climb up to 10 levels to find a row-shaped ancestor and hide it.
            // n8n's node creator wraps each entry several divs deep; a depth
            // of 5–7 occasionally misses, so 10 gives generous headroom.
            for (let depth = 0; depth < 10 && el; depth += 1) {
              const role = el.getAttribute("role") ?? "";
              const tag = el.tagName;
              const isRow =
                tag === "LI" ||
                tag === "A" ||
                tag === "BUTTON" ||
                role === "button" ||
                role === "listitem" ||
                role === "option" ||
                /item|row|entry|nodeItem|node-item/i.test(el.className ?? "");
              if (isRow) {
                el.style.display = "none";
                break;
              }
              el = el.parentElement;
            }
          }
          node = walker.nextNode();
        }
      } catch {
        // ignore
      }
    };

    const hideByLabel = (doc: Document) => {
      try {
        const byHref = doc.querySelectorAll('a[href*="/evaluation"]');
        for (const el of Array.from(byHref)) {
          const tab = (el.closest(TAB_ANCESTOR_SELECTOR) ?? el) as HTMLElement;
          tab.style.display = "none";
        }
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
        const toHide: HTMLElement[] = [];
        let node = walker.nextNode();
        while (node) {
          const el = node as HTMLElement;
          if (el.childElementCount === 0) {
            const text = (el.textContent ?? "").trim();
            if (HIDE_BY_LABEL.has(text)) {
              const tab = (el.closest(TAB_ANCESTOR_SELECTOR) ?? el) as HTMLElement;
              toHide.push(tab);
            }
          }
          node = walker.nextNode();
        }
        for (const el of toHide) el.style.display = "none";
      } catch {
        // ignore
      }
    };

    // Greeting strings n8n renders with the n8n owner's first name —
    // "Mojahid, let's set up a credential", "Mojahid, let's set up a
    // workflow", etc. We rewrite the whole sentence to a neutral one so
    // the Wekala user never sees the n8n owner's name.
    const GREETING_PATTERNS: { match: RegExp; replacement: string }[] = [
      {
        match: /^[\w\s'-]+,\s+let's set up a credential$/i,
        replacement: "Set up your first credential",
      },
      {
        match: /^[\w\s'-]+,\s+let's set up a workflow$/i,
        replacement: "Create your first workflow",
      },
      { match: /^[\w\s'-]+,\s+let's create your first/i, replacement: "Let's create your first" },
      { match: /^Hi\s+[\w\s'-]+!$/i, replacement: "Welcome" },
    ];

    /**
     * For per-user n8n personal projects, the breadcrumb often renders as
     * just the project icon with no text label (n8n auto-collapses the
     * label when the user has only one project). Inject the Wekala
     * workspace name in front of the first "/" separator that has no
     * meaningful text before it, so the breadcrumb reads
     *   "<workspaceName> / <workflow>"
     * consistent with what Personal-named projects show.
     */
    const injectWorkspaceLabel = (doc: Document) => {
      try {
        const target = workspaceNameRef.current?.trim();
        if (!target) return;
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
          const t = node as Text;
          const trimmed = (t.nodeValue ?? "").trim();
          if (trimmed !== "/" || !t.parentElement) {
            node = walker.nextNode();
            continue;
          }
          const parent = t.parentElement;
          // Already injected here? Skip.
          if (parent.querySelector('[data-wekala-ws="1"]')) {
            node = walker.nextNode();
            continue;
          }
          // Climb up to 4 ancestors and check if the breadcrumb already
          // contains the workspace name (n8n's responsive layout puts it
          // inside the project button, which isn't a direct sibling of
          // the "/" separator — so checking only siblings caused
          // duplicate injections on wider screens).
          let ancestor: HTMLElement | null = parent;
          let alreadyHasName = false;
          for (let depth = 0; depth < 4 && ancestor; depth += 1) {
            if ((ancestor.textContent ?? "").includes(target)) {
              alreadyHasName = true;
              break;
            }
            ancestor = ancestor.parentElement;
          }
          if (!alreadyHasName) {
            const span = doc.createElement("span");
            span.setAttribute("data-wekala-ws", "1");
            span.textContent = `${target} `;
            span.style.cssText =
              "font-size: 13px; font-weight: 500; color: rgb(64, 64, 64); margin: 0 6px 0 6px;";
            parent.insertBefore(span, t);
          }
          node = walker.nextNode();
        }
      } catch {
        // ignore
      }
    };

    /**
     * Replace any visible "Personal" label (n8n's default name for the
     * implicit personal project) with Wekala's current workspace name,
     * plus rewrite any greeting strings that leak the n8n owner's name.
     * Uses text-node walking so we mutate only the leaf text without
     * disturbing surrounding markup or event listeners.
     */
    const rewriteLabels = (doc: Document) => {
      try {
        const target = workspaceNameRef.current?.trim();
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
        const updates: { node: Text; newValue: string }[] = [];
        let node = walker.nextNode();
        while (node) {
          const t = node as Text;
          const v = t.nodeValue ?? "";
          const trimmed = v.trim();
          if (!trimmed) {
            node = walker.nextNode();
            continue;
          }
          if (trimmed === "Personal" && target && trimmed !== target) {
            updates.push({ node: t, newValue: v.replace(/\bPersonal\b/g, target) });
            node = walker.nextNode();
            continue;
          }
          // Each per-user n8n workspace shows as "<FirstName> <LastName>'s"
          // in the project switcher. Rewrite any "X's" / "X's workspace"
          // label to the Wekala workspace name so the breadcrumb reads
          // consistently with the Wekala app shell.
          if (
            target &&
            trimmed !== target &&
            /^[\p{L}\p{N}\s'-]+'s(\s+workspace)?$/iu.test(trimmed)
          ) {
            updates.push({ node: t, newValue: target });
            node = walker.nextNode();
            continue;
          }
          for (const { match, replacement } of GREETING_PATTERNS) {
            if (match.test(trimmed)) {
              updates.push({ node: t, newValue: replacement });
              break;
            }
          }
          node = walker.nextNode();
        }
        for (const { node: t, newValue } of updates) {
          t.nodeValue = newValue;
        }
      } catch {
        // ignore
      }
    };

    // Walk all <button> / <a> elements and force-recolor any whose text
    // matches a known orange action. n8n's primary-button class detection
    // is unreliable across pages (empty-state buttons use bespoke classes),
    // so we re-apply the brand color inline as a last resort.
    const BLACK_BUTTON_LABELS = new Set([
      "Add first credential",
      "Create data table",
      "Create credential",
      "Add credential",
      "Create workflow",
      "Register instance",
      "Sign in",
      "Continue",
      "Create",
      "Save",
      "Add",
      "Confirm",
      "Next",
    ]);

    // Icon-only buttons we want to remove from n8n's toolbars. We match by
    // accessible name (aria-label / title) since they have no visible text.
    const HIDE_BY_ARIA_LABEL = [
      "Create folder",
      "Add folder",
      "New folder",
      // Canvas right-toolbar search icon (workflow-wide search)
      "Search",
      "Search workflow",
      "Find nodes",
    ];

    const hideByAriaLabel = (doc: Document) => {
      try {
        for (const label of HIDE_BY_ARIA_LABEL) {
          const sel = `[aria-label="${label}"], [title="${label}"]`;
          for (const el of Array.from(doc.querySelectorAll(sel))) {
            (el as HTMLElement).style.display = "none";
          }
        }
      } catch {
        // ignore
      }
    };

    const recolorButtons = (doc: Document) => {
      try {
        const btns = doc.querySelectorAll('button, a[role="button"]');
        for (const el of Array.from(btns)) {
          const text = (el.textContent ?? "").trim();
          if (BLACK_BUTTON_LABELS.has(text)) {
            const html = el as HTMLElement;
            html.style.setProperty("background-color", "#0a0a0a", "important");
            html.style.setProperty("background", "#0a0a0a", "important");
            html.style.setProperty("border-color", "#0a0a0a", "important");
            html.style.setProperty("color", "#ffffff", "important");
          }
        }
      } catch {
        // ignore
      }
    };

    const inject = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        if (!doc.getElementById(STYLE_ID)) {
          const style = doc.createElement("style");
          style.id = STYLE_ID;
          style.textContent = WEKALA_BRAND_CSS;
          // Insert at the START of <head> so our overrides win the cascade
          // before n8n's own stylesheets define orange brand colors.
          if (doc.head.firstChild) {
            doc.head.insertBefore(style, doc.head.firstChild);
          } else {
            doc.head.appendChild(style);
          }
        }
        hideByLabel(doc);
        hideByAriaLabel(doc);
        hideRowByLabel(doc);
        rewriteLabels(doc);
        injectWorkspaceLabel(doc);
        recolorButtons(doc);
      } catch {
        // Cross-origin (shouldn't happen with the same-origin proxy)
      }
    };

    const startPolling = () => {
      if (interval) clearInterval(interval);
      let ticks = 0;
      interval = setInterval(() => {
        inject();
        ticks++;
        if (ticks > 12 && interval) {
          clearInterval(interval);
          interval = null;
        }
      }, 500);
    };

    const startObserver = () => {
      if (observer) observer.disconnect();
      try {
        const doc = iframe.contentDocument;
        if (!doc || !doc.body) return;
        let scheduled = false;
        observer = new MutationObserver(() => {
          // Run on the next animation frame instead of a timeout debounce
          // — this fires BEFORE the browser paints the next frame, so n8n's
          // orange button never reaches the screen between render and our
          // recolor pass.
          if (scheduled) return;
          scheduled = true;
          const win = iframe.contentWindow ?? window;
          win.requestAnimationFrame(() => {
            scheduled = false;
            inject();
          });
        });
        observer.observe(doc.body, { childList: true, subtree: true });
      } catch {
        // ignore
      }
    };

    const onLoad = () => {
      inject();
      startPolling();
      startObserver();
      // Reveal the iframe after the first inject + a tiny grace window so the
      // text rewrite ("Personal" → workspace name) has time to land. Without
      // this, n8n's HTML renders the raw label for ~200ms before our walker
      // swaps it — visible as a flash on every navigation.
      if (readyTimer) clearTimeout(readyTimer);
      readyTimer = setTimeout(() => setReady(true), 120);
    };

    iframe.addEventListener("load", onLoad);
    // First-mount injection if the iframe already loaded
    onLoad();

    return () => {
      iframe.removeEventListener("load", onLoad);
      if (interval) clearInterval(interval);
      if (observer) observer.disconnect();
      if (readyTimer) clearTimeout(readyTimer);
    };
  }, []);

  // When the Wekala workspace name changes, the closures pick it up via the
  // ref. Trigger a fresh rewrite pass so the iframe breadcrumb updates
  // without forcing a full iframe reload (which would lose canvas state).
  useEffect(() => {
    const iframe = ref.current;
    const doc = iframe?.contentDocument;
    if (!doc) return;
    try {
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      const target = workspaceName.trim();
      while (node) {
        const t = node as Text;
        const v = t.nodeValue ?? "";
        // Replace BOTH the literal "Personal" and any previously-rewritten
        // workspace name. We do the latter by matching anything that sits
        // in a known breadcrumb slot — for safety here we only rewrite
        // "Personal".
        if (v.trim() === "Personal" && target) {
          t.nodeValue = v.replace(/\bPersonal\b/g, target);
        }
        node = walker.nextNode();
      }
    } catch {
      // ignore
    }
  }, [workspaceName]);

  return (
    <div className="relative size-full bg-white">
      <iframe
        ref={ref}
        title="Agent canvas"
        src="/n8n/workflow/new"
        className={cn(
          "absolute inset-0 size-full border-0 transition-opacity duration-150",
          ready ? "opacity-100" : "opacity-0"
        )}
        allow="clipboard-read; clipboard-write"
      />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <span className="size-2 animate-pulse rounded-full bg-neutral-400" />
            Loading canvas…
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * CSS injected into the n8n iframe to white-label it as Wekala.
 *
 * Strategy:
 *   - Override n8n's design tokens (--prim-color-primary, --color-primary,
 *     and Element Plus's --el-color-primary*) to neutral-950 / 900 so
 *     orange UI becomes black.
 *   - Hide any DOM element n8n exposes that brands itself (the wordmark,
 *     the "About n8n" item, the Help menu that links to docs.n8n.io, the
 *     "Templates" tab that links out to n8n's template library).
 *   - Hide n8n's logo at the top of the sidebar entirely. We only keep
 *     icons that map to functionality (the canvas + nav).
 *
 * Selectors target both `data-test-id` attributes (most stable) and class
 * fragments; some are sledgehammer because n8n's classnames are hashed.
 */
const WEKALA_BRAND_CSS = `
/* ---------- 0. Wekala node icons — render larger than n8n default ---------- */
/* Our model SVGs read small at n8n's stock 22-32px icon size; scale up by ~35%
   so the brand logo is legible in the palette and on canvas. transform:scale
   keeps the parent's reserved box intact so layout doesn't shift. */
img[src*="wekala-"],
img[src$="/wekala-qwen35-2b.svg"],
img[src$="/wekala-qwen35-4b.svg"],
img[src$="/wekala-llama32.svg"],
img[src$="/wekala-phi4-mini.svg"],
img[src$="/wekala-glm4.svg"],
img[src$="/wekala-deepseek-r1.svg"],
img[src$="/wekala-gemma4.svg"],
img[src$="/wekala-aya-expanse.svg"],
img[src$="/wekala-bge-m3.svg"] {
  transform: scale(1.35);
  transform-origin: center center;
}

/* ---------- 1. Brand color overrides (orange -> black) ---------- */
:root,
:root[data-theme="light"],
:root[data-theme="dark"] {
  --prim-color-primary: #0a0a0a !important;
  --prim-color-primary-shade-1: #262626 !important;
  --prim-color-primary-shade-2: #404040 !important;
  --prim-color-primary-tint-1: #525252 !important;
  --prim-color-primary-tint-2: #737373 !important;
  --prim-color-primary-tint-3: #a3a3a3 !important;
  --color-primary: #0a0a0a !important;
  --color-primary-shade-1: #262626 !important;
  --color-primary-shade-2: #404040 !important;
  --color-primary-tint-1: #525252 !important;
  --color-primary-tint-2: #737373 !important;
  --color-primary-tint-3: #a3a3a3 !important;
  --color-primary-h: 0 !important;
  --color-primary-s: 0% !important;
  --color-primary-l: 4% !important;
  --color-primary-hsl: 0, 0%, 4% !important;

  --el-color-primary: #0a0a0a !important;
  --el-color-primary-light-3: #404040 !important;
  --el-color-primary-light-5: #525252 !important;
  --el-color-primary-light-7: #737373 !important;
  --el-color-primary-light-8: #a3a3a3 !important;
  --el-color-primary-light-9: #f5f5f5 !important;
  --el-color-primary-dark-2: #000000 !important;

  --color-foreground-base: #0a0a0a !important;
  --color-text-link: #0a0a0a !important;
  --color-action-button: #0a0a0a !important;
  --color-button-primary-background: #0a0a0a !important;
  --color-button-primary-hover-background: #262626 !important;
  --color-button-primary-focus-background: #262626 !important;
  --color-success: #0a0a0a !important;
}

/* Aggressive primary-button recolor — catches every flavor of primary
   button n8n uses (Create workflow, Execute step, Add first credential,
   Sign in, plus any inline-styled orange). */
button.el-button--primary,
.el-button.el-button--primary,
.button.primary,
[class*="Button"][class*="primary"],
[class*="button"][class*="primary"]:not([class*="secondary"]):not([class*="tertiary"]):not([class*="outline"]),
[data-test-id="resources-list-add"],
[data-test-id="execute-workflow-button"],
[data-test-id="ndv-execute-button"],
[data-test-id="signin-form-submit-button"],
[data-test-id="add-credential-button"],
[data-test-id="empty-shared-credentials-action-button"],
.action-button {
  background-color: #0a0a0a !important;
  background: #0a0a0a !important;
  border-color: #0a0a0a !important;
  color: #ffffff !important;
}
button.el-button--primary:hover,
button.el-button--primary:focus,
[data-test-id="resources-list-add"]:hover,
[data-test-id="execute-workflow-button"]:hover,
[data-test-id="ndv-execute-button"]:hover {
  background-color: #262626 !important;
  background: #262626 !important;
  border-color: #262626 !important;
  color: #ffffff !important;
}

/* Catch-all for any element whose inline style hardcodes n8n's orange
   (most common shades). Last-resort sweep. */
[style*="rgb(255, 109, 90)"],
[style*="#ff6d5a"],
[style*="#FF6D5A"] {
  background-color: #0a0a0a !important;
  background: #0a0a0a !important;
  color: #ffffff !important;
}

a, .el-link {
  color: #0a0a0a !important;
}

/* Input focus ring / border — n8n + Element Plus default to the brand
   colour, which on some pages reads as a purple-ish accent. Force the
   focus state to neutral-950 across all input flavors AND any custom
   wrapper that listens for :focus-within. */
.el-input__wrapper.is-focus,
.el-input__wrapper:focus-within,
.el-textarea__inner:focus,
.el-textarea .el-textarea__inner:focus,
textarea:focus,
select:focus,
[contenteditable="true"]:focus,
[class*="input-container" i]:focus-within,
[class*="inputContainer"]:focus-within {
  box-shadow: 0 0 0 1px #0a0a0a inset !important;
  border-color: #0a0a0a !important;
  outline-color: #0a0a0a !important;
}

/* Node-creator search input — the user specifically asked for no focus
   border here. Strip all focus chrome and let the static container
   border do the visual work. */
input[placeholder*="Search nodes" i],
input[placeholder*="Search nodes" i]:focus,
[class*="nodeCreator" i] input,
[class*="nodeCreator" i] input:focus,
[class*="node-creator" i] input,
[class*="node-creator" i] input:focus {
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
}
[class*="nodeCreator" i] [class*="search" i],
[class*="nodeCreator" i] [class*="search" i]:focus-within,
[class*="node-creator" i] [class*="search" i],
[class*="node-creator" i] [class*="search" i]:focus-within {
  border-color: #e5e5e5 !important;
  box-shadow: none !important;
  outline: none !important;
}

/* Element Plus radio + checkbox active state */
.el-radio__input.is-checked .el-radio__inner,
.el-checkbox__input.is-checked .el-checkbox__inner {
  background: #0a0a0a !important;
  border-color: #0a0a0a !important;
}
.el-radio__input.is-checked + .el-radio__label,
.el-checkbox__input.is-checked + .el-checkbox__label {
  color: #0a0a0a !important;
}

/* Tab underline color (Workflows / Credentials / Executions / Data tables,
   plus Editor / Executions inside the workflow). Catch every variant of
   "active bar" / "indicator" n8n uses across its tab components. */
.el-tabs__active-bar,
.tabs__active-bar,
[class*="active-bar" i],
[class*="ActiveBar"],
[class*="tab-indicator" i],
[class*="TabIndicator"] {
  background-color: #0a0a0a !important;
  background: #0a0a0a !important;
}
.el-tabs__item.is-active,
[role="tab"][aria-selected="true"],
[role="tab"].is-active,
.is-active[role="tab"] {
  color: #0a0a0a !important;
  border-color: #0a0a0a !important;
}

/* Empty-state CTA buttons across n8n's various blank-slate panels.
   Anything that looks like a primary call-to-action inside a dashed
   container gets force-blackened. */
[class*="empty" i] button,
[class*="Empty"] button,
[class*="empty-state" i] [class*="button" i]:not([class*="secondary" i]):not([class*="tertiary" i]):not([class*="outline" i]):not([class*="text" i]),
.empty-state button {
  background-color: #0a0a0a !important;
  background: #0a0a0a !important;
  border-color: #0a0a0a !important;
  color: #ffffff !important;
}

/* Wildcard: any element with "primary" class that LOOKS like a clickable
   action (button or anchor). Excludes utility classes like "primary-text"
   that just style text in the primary color. */
button[class*="primary" i]:not([class*="secondary"]):not([class*="tertiary"]):not([class*="outline"]):not([class*="text" i]):not([class*="link" i]),
a[class*="primary" i][class*="button" i]:not([class*="secondary"]):not([class*="tertiary"]):not([class*="outline"]) {
  background-color: #0a0a0a !important;
  background: #0a0a0a !important;
  border-color: #0a0a0a !important;
  color: #ffffff !important;
}

/* ---------- 2. Hide the entire n8n sidebar ---------- */
#sidebar,
[data-test-id="main-sidebar"],
[class*="MainSidebar"],
[class*="main-sidebar"],
aside.main-sidebar,
nav[class*="sidebar"] {
  display: none !important;
}

[class*="LayoutWithSidebar"] > main,
[class*="layoutWithSidebar"] > main,
.main-panel {
  margin-left: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
}

/* ---------- 3. Hide n8n-branded affordances ---------- */
[data-test-id="logo"],
[class*="LogoContainer"],
[class*="logo-text"],
[class*="logoText"],
.logo,
.n8n-logo,
[data-test-id="menu-item-help"],
[data-test-id="menu-item-about"],
[data-test-id="menu-item-cloud-admin"],
a[href*="docs.n8n.io"],
a[href*="n8n.io"],
a[href*="community.n8n.io"],
[class*="update-banner"],
[class*="updateAvailable"],
[data-test-id="update-banner"],
.auth-page img[src*="logo"],
.auth-page svg[class*="logo"],
.auth-page [class*="logo"] {
  display: none !important;
}

.el-dropdown-menu__item.is-disabled,
li.el-dropdown-menu__item[aria-disabled="true"] {
  display: none !important;
}

/* ---------- 4. Hide n8n-specific nav tabs ---------- */
/* Top-level tab strip on Personal/Project pages:
   Workflows | Credentials | Executions | Data tables — keep first two only. */
[role="tab"][aria-controls*="executions"],
[role="tab"][aria-controls*="data-tables"],
[data-test-id="tab-executions"],
[data-test-id="tab-data-tables"],
[data-test-id="tab-folder-executions"],
[data-test-id="tab-folder-data-tables"],
a[href*="/executions"][role="tab"],
a[href*="/data-tables"][role="tab"] {
  display: none !important;
}

/* Top-of-canvas tab strip in the workflow editor:
   Editor | Executions | Evaluations — keep Editor only. */
[data-test-id="tab-workflow-executions"],
[data-test-id="workflow-tab-executions"],
[data-test-id="workflow-tab-evaluations"],
[data-test-id="tab-test-definitions"],
a[href*="/executions"][role="tab"],
a[href*="/evaluation"][role="tab"] {
  display: none !important;
}

/* ---------- 5. Hide dynamic-name greetings + "Personal" project label ---------- */
/* The "<First name>, let's set up a credential" heading on empty
   credentials, and similar "Hi <name>" hellos. */
[data-test-id="empty-shared-credentials-heading"],
[data-test-id="empty-shared-workflows-heading"],
[class*="EmptyState"] h1,
[class*="emptyState"] h1,
[class*="empty-state"] h1 {
  display: none !important;
}

/* The "Personal" page title strip. We hide the whole header so the n8n
   user's name and project name never leak into the UI. */
[data-test-id="resources-list-heading"],
[data-test-id="project-name"],
[data-test-id="project-header"],
[class*="ProjectHeader"],
[class*="projectHeader"],
.project-header {
  display: none !important;
}

/* ---------- 6. Hide feedback / upsell affordances inside node config ---------- */
/* "I wish this node would..." link at the bottom of the parameters panel */
[data-test-id="parameter-wishlist"],
[data-test-id="node-wishlist"],
[class*="nodeWishlist"],
[class*="WishList"],
.node-wishlist,
button[class*="wishlist"],
a[class*="wishlist"] {
  display: none !important;
}

/* Settings-tab-only "Send feedback" buttons */
[data-test-id="ndv-feedback"],
[class*="feedback-button"] {
  display: none !important;
}

/* ---------- 7. Page chrome ---------- */
body {
  background: #fafafa !important;
}
`;
