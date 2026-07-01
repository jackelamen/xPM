---
name: xPortal
description: White-label client portal for agencies — project status, deliverables, billing, and communication in one branded workspace.
colors:
  # Light theme (default) — bold editorial: true white canvas, near-black ink,
  # electric indigo used decisively. Dark values noted in prose; the .dark
  # class swaps the full palette via CSS vars in globals.css.
  canvas: "#ffffff"
  surface: "#f8f8fb"
  surface-raised: "#efeff4"
  accent-indigo: "#5b48ee"
  accent-emerald: "#059669"
  ink: "#16161d"
  ink-soft: "#4d4d59"
  ink-muted: "#6e6e7a"
  line: "#e4e4ec"
  state-warning: "#b45309"
  state-error: "#be123c"
  state-dispute: "#7e22ce"
typography:
  headline:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  title:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  micro:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent-emerald}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-emerald}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
  button-destructive:
    backgroundColor: "{colors.state-error-strong}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  input:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  input-focus:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
  kpi-card:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.md}"
    padding: "12px"
  chip:
    backgroundColor: "transparent"
    rounded: "{rounded.full}"
    padding: "2px 8px"
---

# Design System: xPortal

## 1. Overview

**Creative North Star: "The Mission Control Room"**

xPortal is built on the premise that every screen is a dashboard of consequence. The operator is in command; the client is always informed. Information density is deliberate — not sparse for the sake of breathing room, not cluttered for the sake of completeness, but precisely calibrated to what each user needs at this moment. Status reads at a glance. Actions are never ambiguous. The system disappears into the task.

The palette is Void-dark: a near-black with a faint blue tint (`#0b0f19`) that reads as depth, not darkness. Surfaces lift in discrete tonal steps — Secondary (`#111827`) floats above Void, Raised (`#1f2937`) above Secondary — creating a layered depth that feels structural, not decorative. Two accent colors carry deliberate semantic weight: Electric Blue for interactive state and navigation focus; Emerald for confirmation, progress, and success. They are never decorative. They are signal.

This system explicitly rejects: generic SaaS dashboard aesthetics (Asana/Jira flatness, no identity); cookie-cutter agency presentation (warm cream, big serif heroes, stock-photo softness); startup-landing-page decoration (gradient text, glassmorphism, hero metrics for their own sake); and corporate intranet density (grey, bureaucratic, premium-absent). xPortal should feel like the tool was made specifically for professionals who run or receive high-stakes project work — not a template someone installed.

**Key Characteristics:**
- Void-dark base with structural tonal layering — depth comes from surface steps, not shadows
- Two-accent semantic vocabulary: blue = interactive/navigation, emerald = progress/success/confirmation
- Information-first layout: status is always visible without scrolling
- Flat-by-default elevation — borders and tonal backgrounds carry structure, not box-shadows
- System font stack: no display font, zero ego, full legibility at density
- Per-client branding via CSS custom property override — accent color cascades into every surface that carries brand signal

## 2. Colors: The Void Palette

A deep, tinted-dark palette where light carries information — the two accent colors are the brightest things on any screen, which makes them reliable signals.

### Primary
- **Electric Blue** (`#3b82f6`): Interactive accent. Navigation active state, links, focus indicators, unread badges, version labels. Never used for decoration or background fill.

### Secondary
- **Confirmation Emerald** (`#10b981`): Progress and success accent. Primary action buttons ("Approve", "Save branding", "Create"), progress bars, KPI-good state, milestone completion. Signals forward motion and positive confirmation.

### Tertiary
- **Caution Amber** (`#fbbf24`): Warning state. Stale review chips, file request badges, "waiting on you" indicators. Uses tinted backgrounds (`amber-400/15`) rather than solid fill.
- **Alert Rose** (`#f87171` / `#ef4444`): Error and destructive state. Revision requests, invoice disputes, destructive actions, "never active" client chips.

### Neutral
- **Void** (`#0b0f19`): Page background. The darkest layer — canvas for everything above it.
- **Surface** (`#111827`): Card and panel background. Floats one step above Void.
- **Surface Raised** (`#1f2937`): Input backgrounds, nested cards, KPI cards, version history panels. Two steps above Void.
- **Ink** (`#f3f4f6`): Primary text. Headings, values, active nav items.
- **Ink Soft** (`#9ca3af`): Secondary text. Labels, descriptions, nav items at rest.
- **Ink Muted** (`#6b7280`): Tertiary text. Timestamps, version notes, placeholder text. Meets 4.5:1 against Surface Raised — do not go dimmer than this.
- **Line** (`#374151`): Borders and dividers. Separates surfaces without weight.

### Named Rules
**The Signal Rule.** Electric Blue and Confirmation Emerald appear only on interactive elements, state indicators, and progress — never as decorative color. Their scarcity is what makes them readable as signal. A blue element means "you can do something here or this needs your attention." An emerald element means "this is progressing or complete." Never use either for decoration.

**The Ink Floor Rule.** `ink-muted` (`#6b7280`) is the minimum text contrast allowed on any surface. Against `surface-raised` (#1f2937) this meets WCAG AA. Going dimmer is prohibited.

**The Per-Client Override.** Each client's `accent_color` overrides `--color-accent` via CSS custom property at the portal layout root. All `bg-accent`, `text-accent`, and `border-accent` utilities will reflect the client's brand automatically. Emerald (`accent-2`) remains the operator's confirmation color and is not client-overridable.

## 3. Typography

**Body / UI Font:** System UI stack (`system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`)
**No display font.** One family, multiple weights. The tool disappears; the information speaks.

**Character:** A tightly-tuned system font stack with no typographic ego — the kind of choice that signals "we care about legibility, not ornament." Weight and size carry the entire hierarchy. The one concession to brand expression: the admin mark uses `tracking-widest` uppercase at `text-xs`, which reads as a deliberate label, not a hero headline.

### Hierarchy
- **Headline** (600, 1.25rem/20px, 1.3 lh): Section headings on project pages, admin page titles. `text-wrap: balance` applied.
- **Title** (500, 1rem/16px, 1.4 lh): Card titles, project names, deliverable names in context.
- **Body** (400, 0.875rem/14px, 1.5 lh): The workhorse. All descriptive text, messages, feedback, meeting details. Max 65–75ch on prose blocks.
- **Label** (500, 0.75rem/12px, 1.4 lh): Status tags, nav items, button text, KPI names, form labels.
- **Micro** (400, 0.6875rem/11px, 1.4 lh): Timestamps, version numbers, chip content, file metadata. Never used for actionable text.

### Named Rules
**The No-Display Rule.** No serif, script, or display typeface anywhere in the product. Product UI typography is weight contrast and size contrast only. Display fonts belong on brand surfaces; xPortal is a tool.

**The Admin Mark Exception.** The single `tracking-widest uppercase text-xs` instance in the admin header is a deliberate label-as-brand-mark — not a section eyebrow. It appears once in the entire UI. Do not replicate this pattern as a section heading device.

## 4. Elevation

xPortal is **flat-by-default**. There are no `box-shadow` values in the design system. Depth is conveyed entirely through tonal surface layering (Void → Surface → Surface Raised) and `border: 1px solid {colors.line}`. The three-step background ramp creates all necessary visual hierarchy without any shadow.

**The Flat Rule.** If you reach for a box-shadow, stop. Use a surface step-up instead: promote the element from `bg-surface` to `bg-surface-raised`, or add `border-line`. Shadows appear only on externally-constrained components (browser-native dropdowns, `<dialog>` modals placed above the app shell).

**The Tonal Ramp.** Void (`#0b0f19`) → Surface (`#111827`) → Surface Raised (`#1f2937`). That is the complete depth vocabulary. Nested cards use Surface Raised against a Surface parent. Never use Surface against Surface (same-tone nesting reads as flat clutter).

## 5. Components

### Buttons
Tactile and unambiguous. Every button communicates its consequence through color.

- **Shape:** Gently rounded (8px radius). Nothing pill-shaped except chips.
- **Primary (Confirm / Advance):** Emerald background (`#10b981`), white text, `px-4 py-2`, 500 weight. Used for "Save", "Approve", "Create", "Send". Hover: 0.9 opacity.
- **Ghost / Secondary:** Transparent background, `border border-line`, `text-ink-soft`, hover shifts to `bg-surface-raised text-ink`. Used for "Cancel", "View history", secondary actions.
- **Destructive:** `bg-rose-500`, white text. Used for "Request revisions", "Dispute", "Remove". Requires one extra click to confirm on high-consequence actions.
- **Disabled:** 50% opacity, no pointer events. No color change — the opacity signal is universal.
- **All buttons:** 150ms `ease` transition on background, border, color, opacity.

### Chips / Status Badges
The semantic color vocabulary at small scale.

- **Style:** `rounded-full`, `text-[11px]`, tinted background at 15% opacity (`bg-amber-400/15`, `bg-accent/15`), matching text color. Never solid-fill at full opacity.
- **Health chips (KPI):** Border-colored (not background-colored) card borders: `border-accent-2/40` (good), `border-amber-400/40` (close), `border-rose-500/40` (off). The border carries the health signal; the interior stays neutral.
- **Status text (Deliverables):** Plain colored text, no chip container — `text-amber-400` (Pending), `text-accent-2` (Approved), `text-rose-400` (Revisions Requested). The color is the affordance; a container would add noise.

### Cards / Containers
- **Corner Style:** 12px radius (`rounded-xl`) for section containers and panels; 8px (`rounded-lg`) for items within a list.
- **Background:** `bg-surface` (`#111827`) for outer panels; `bg-surface-raised` (`#1f2937`) for nested items (deliverables, KPI cards, version history).
- **Shadow Strategy:** None. Border (`border border-line`) defines the edge.
- **Internal Padding:** `p-4` (16px) for list items; `p-5` (20px) for section panels.
- **The Nesting Rule.** Surface against Void is the only valid nesting — never Surface against Surface. Raised items live inside Surface containers.

### Inputs / Fields
- **Style:** `bg-surface-raised`, `border border-line`, 8px radius, `px-3 py-2` (12px / 8px).
- **Focus:** `focus:border-accent-2` (Emerald border, no glow, no shadow). Keyboard users get the ring from the border shift.
- **Placeholder:** Uses `text-ink-muted` (`#6b7280`) — meets 4.5:1 against `surface-raised`. Non-negotiable.
- **Textarea:** Same treatment; `resize-none` by default; explicit row count.
- **Error state:** Border shifts to `border-rose-500`. Error text below in `text-rose-400 text-xs`.

### Navigation

**Client sidebar (desktop):** 240px fixed left panel, `border-r border-line`. Nav items: `rounded-lg px-3 py-2`, icon (16px) + label, `text-ink-soft hover:bg-surface-raised hover:text-ink`. Active state via URL match adds `bg-surface-raised text-ink`. Unread badge: `bg-accent rounded-full px-1.5 text-xs` floating at the item's right edge.

**Client top bar (mobile):** Icon-only nav, 18px icons, `p-2 rounded-lg`. Brand mark left, icons right. Collapses the label; preserves every destination.

**Admin header:** Top bar, `border-b border-line`, `px-6 py-4`. Brand mark left (Emerald Building2 icon + `text-xs font-semibold uppercase tracking-widest text-accent-2`). Operator name + sign-out right. Minimal — operators are always one click from the client list.

### Signature Components

**PhaseStatusBar:** A horizontal array of pill segments, one per project phase. Each pill is `h-2.5 rounded-full` colored by status: Emerald (done), Electric Blue (active, with `animate-pulse`), Rose (blocked), Surface Raised (upcoming). Phase label below in proportional weight: bold ink (active) → ink-soft (done) → ink-muted (upcoming). Progress meter below: 4px track `bg-surface-raised`, fill `bg-accent`, percentage label right.

**KpiGrid:** `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`. Each card: `bg-surface-raised rounded-lg p-3`, border colored by health (Emerald/Amber/Rose at 40% opacity). KPI value in `text-xl font-semibold` with health color. Name in `text-xs text-ink-soft` with trend icon. Target in `text-xs text-ink-muted`.

**Timeline (Gantt):** Phase bars spanning date columns, colored by status. Diamond SVG markers for milestones. Amber vertical rule for today. Month labels in `text-xs text-ink-muted` above the grid. No gridlines below the header — the bar fills convey position.

## 6. Do's and Don'ts

### Do:
- **Do** use `ink-muted` (`#6b7280`) as the absolute minimum for any displayed text. Going dimmer fails WCAG AA.
- **Do** step up surface levels for depth: Void → Surface → Surface Raised. That is the entire elevation vocabulary.
- **Do** reserve Electric Blue for interactive and informational state only. It means "action" or "attention." Decorative blue breaks the semantic contract.
- **Do** reserve Confirmation Emerald for forward motion: approvals, progress, saves, completions. It means "good."
- **Do** use `rounded-xl` (12px) for section containers and `rounded-lg` (8px) for individual item cards. Never mix the two on the same nesting level.
- **Do** override `--color-accent` at the portal layout root for per-client branding. Every `bg-accent` / `text-accent` utility cascades automatically.
- **Do** match button text to the specific action: "Approve deliverable", "Save branding", "Send digests now" — never generic "Submit" or "OK."
- **Do** apply `text-wrap: balance` to `h1–h3` elements to prevent widow lines.

### Don't:
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on cards or list items. This is the most common pattern to creep in and the hardest to un-see. Use tinted backgrounds or full borders instead.
- **Don't** use gradient text (`background-clip: text` + gradient). Emphasis via weight or size only.
- **Don't** add `box-shadow` to cards, inputs, or panels. The flat system is intentional; shadows read as inconsistency.
- **Don't** build a generic SaaS dashboard: flat, overcrowded, no identity. xPortal has a point of view on every screen.
- **Don't** introduce warm-tinted backgrounds, big serif headers, or stock-photo-adjacent softness. xPortal is a precision tool, not a brochure.
- **Don't** use gradient fills, glassmorphism, hero-metric layouts (big number + gradient accent), or identical repeating card grids. These are the exact patterns that signal "AI made this" — and they are prohibited.
- **Don't** add `tracking-widest uppercase` eyebrows above section headings. The only sanctioned use is the admin brand mark. Section cadence is heading weight and size contrast alone.
- **Don't** use Electric Blue for decoration, non-interactive text, or backgrounds. Blue means interactive or informational — its rarity makes it trustworthy.
- **Don't** use a display or serif typeface anywhere in the product UI. The system font stack is the only font.
- **Don't** nest Surface-on-Surface. Surface cards must sit on Void or Surface Raised must sit on Surface — the tonal step is what makes the card readable.
