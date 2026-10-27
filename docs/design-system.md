# Design system

Onstage's look: warm ivory neutrals, one deep-teal accent, an editorial serif for moments and a clean sans for
work. Calm, generous spacing; motion that confirms rather than decorates. Tokens live in `src/app/globals.css`.

## Tokens

| Group | Tokens | Notes |
|---|---|---|
| Surfaces | `background`, `card`, `popover`, `muted`, `accent`, `sidebar` | Warm ivory (light) / warm charcoal (dark). Never pure white page backgrounds |
| Text | `foreground`, `muted-foreground` | Muted is for secondary lines only, never for primary actions |
| Brand | `primary` (teal), `highlight` (amber) | One primary action per view. Highlight is for badges and unread counts |
| Status | `live` (red), `success`, `warning`, `destructive` | `live` means on air only; errors use `destructive` |
| Stage | `stage` | Near-black canvas for the live room (always dark) |
| Radius | `--radius` 0.75rem → `rounded-md/lg/xl/2xl` | Inputs/buttons `md`, cards `xl`, feature panels `2xl`, pills `full` |
| Elevation | `shadow-card`, `shadow-elevated` | Cards get `shadow-card` + a 1px border. `elevated` for floating forms |
| Motion | `ease-soft`, `ease-spring` | 150–300 ms for UI feedback, ≤ 400 ms for entrances. `prefers-reduced-motion` turns it all off |

## Typography

| Use | Style |
|---|---|
| Marketing and event moments (landing hero, registration title, auth headings, onboarding card) | `font-display` (Instrument Serif), large, tight leading |
| App page titles | `PageHeader`: Geist, `text-2xl`/`28px`, `font-semibold`, `tracking-tight` |
| Body | Geist 14–16 px; `text-pretty` for paragraphs, `text-balance` for headings |
| Numbers (stats, countdowns, timers) | `tabular-nums` so they don't jitter |

Rule of thumb: the serif is for things people *feel* (a webinar's name, a welcome); the sans is for things people
*do* (dashboards, forms, controls).

## Components

Primitives are shadcn/Radix in `src/components/ui/`. App-level building blocks:

| Component | File | Use |
|---|---|---|
| `PageHeader` | `src/components/page-header.tsx` | Title + one line of context + actions. Stacks on phones |
| `StatCard` | `src/components/stat-card.tsx` | One metric. `tone="live"` turns red only when the value is above 0 |
| `EmptyState` | `src/components/empty-state.tsx` | Icon tile, one sentence, one next step. Every list needs one |
| `OnboardingChecklist` | `src/components/dashboard/onboarding-checklist.tsx` | First-run steps derived from real data |
| `Reveal` | `src/components/motion.tsx` | Scroll-in entrance for sections |
| `CopyButton` | `src/components/copy-button.tsx` | Copy a link with toast feedback |
| `Dock`, `MobilePanelNav` | `src/components/room/dock.tsx` | Room controls; panels move to a labeled bottom nav under 640 px |
| `MobileRegisterBar` | `src/components/register/mobile-register-bar.tsx` | Sticky "Save my seat" until the visitor reaches or uses the form |

## States every screen needs

- **Loading:** a `Skeleton` with the same shape as the content (no spinners for whole pages).
- **Empty:** `EmptyState` with the single most useful next action.
- **Error:** inline `role="alert"` message next to what failed, in plain language, with what to do next.
- **Success:** confirm in place (toast for small actions, a success panel for big ones like registering).

## Layout and responsiveness

- Breakpoints: phone < 640 px (`sm`), tablet 640–1023 px, desktop ≥ 1024 px (`lg`).
- Page gutters: 16 px on phones, 24 px from `sm`. App content max width `max-w-6xl`.
- Touch targets: at least 44 × 44 px (`size-11`) for anything tapped during a live session.
- Grids that contain scrollable rows (tab strips, tables) need `min-w-0` on their children, or the row
  stretches the page on phones.
- Fixed bottom bars add `env(safe-area-inset-bottom)` so they clear the iPhone home indicator.
