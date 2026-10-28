# Design system

Deploy & Grow Webinar's look (approved UI Prototype V1): calm cool neutrals, a muted navy primary, a soft teal
accent, and Geist for everything. A quiet light workspace; the studio and attendee room are a separate dark world.
Motion confirms rather than decorates. Tokens live in `src/app/globals.css`.

## Tokens

| Group | Tokens | Notes |
|---|---|---|
| Surfaces | `background`, `card`, `popover`, `muted`, `accent`, `surface-2`, `sidebar` | Cool off-white (light) / slate navy (dark). Never pure white page backgrounds |
| Text | `foreground`, `muted-foreground` | Muted is for secondary lines only, never for primary actions |
| Brand | `primary` (muted navy), `teal` + `teal-subtle` (soft accent), `highlight` (amber) | One primary action per view. Teal for secondary emphasis, links and info callouts. Highlight for attention dots, unread counts and raised hands (black text) |
| Status | `live` (red), `success`, `warning`, `destructive`, each with a `*-subtle` background; `warning-text` | `live` means on air only; errors use `destructive` |
| Stage | `stage`, `stage-foreground` | Near-black navy canvas for the live room (always dark) |
| Radius | `sm` 6 · `md` 8 · `lg` 10 · `xl` 14 · `2xl` 18 px | Inputs/buttons `md`, cards `xl`, dialogs and feature panels `2xl`, pills `full` |
| Elevation | `shadow-xs`, `shadow-card`, `shadow-raise`, `shadow-elevated` | Cards get `shadow-card` + a 1px border. `raise` on hover, `elevated` for popovers and floating forms |
| Motion | `ease-soft`, `ease-out`, `ease-in-out`, `ease-spring` | Press 120 ms, tabs 180 ms, UI 220 ms, route 260 ms, modal 240 ms. `prefers-reduced-motion` turns it all off |

## Typography

Geist only (Geist Mono for codes and IDs). Utility classes in `globals.css`:

| Class | Size / line (phones) | Weight | Use |
|---|---|---|---|
| `t-display` | 56/60 (38/44) | 650 | Landing hero only |
| `t-h1` | 40/48 (30/38) | 650 | Public page titles, event title |
| `t-h2` | 28/36 (24/32) | 600 | Section titles; app page titles (`PageHeader`) |
| `t-h3` | 20/28 | 600 | Card titles |
| `t-title` | 16/24 | 600 | List item titles |
| `t-lead` | 18/28, muted | 400 | Intro paragraph under a title |
| `eyebrow` | 11/16 uppercase, tracked | 600 | Eyebrow labels (prototype `.overline`; renamed because Tailwind's `overline` draws a line) |
| Body | 14/20 in the app, 16/24 on public pages | 400 | `text-pretty` for paragraphs |
| Numbers | `tabular-nums` | | Stats, countdowns, timers |

`font-display` is a transitional alias (Geist 600) for headings that used the old serif. Remove it from each
screen as that screen is ported.

## Components

Every component and motion graphic is on the dev-only gallery at **`/dev/ui`** (`npm run dev`; 404 in production).

### Primitives (`src/components/ui/`, shadcn/Radix restyled to Deploy & Grow)

| Component | Variants / notes |
|---|---|
| `Button` | `default` (navy, the one primary action), `teal` (secondary emphasis, soft), `outline`, `secondary`, `ghost`, `link` (teal), `destructive`, `success`. Sizes `xs/sm/default/lg/icon*`; taller on phones. **`cta`** (min 180 px) marks the screen's main next step. **`loading`** shows a spinner and blocks clicks |
| `Badge` | `default` (neutral), `teal`, `success`, `warning`, `danger`, `live` (+ `PingDot`), `navy`, `sample` (marks example/simulated data; never remove it) |
| `Input`, `Textarea`, `SelectTrigger` | Shared `field-styles.ts`: card surface, soft focus ring, nudge + red glow on `aria-invalid` |
| `Card`, `Dialog`, `AlertDialog`, `Sheet`, `Popover`, menus | Calm border, `shadow-card`; overlays use the navy `scrim` with a slight blur and `shadow-elevated` |
| `Switch`, `Checkbox`, `Progress`, `Tabs` | Teal when on/checked; line tabs get an animated teal underline |
| `Toaster` | Navy toasts |

**Primary CTA rule:** one `default` button per screen. Give the main next step `cta`, and put a `NextStep` sentence
under the header when the next action isn't obvious. Teal buttons are never a second primary.

### App blocks

| Component | File | Use |
|---|---|---|
| `PageHeader` | `src/components/page-header.tsx` | Breadcrumbs (`crumbs`), title + one line of context, actions, optional `nextStep`. Stacks on phones |
| `StatCard` | `src/components/stat-card.tsx` | One metric. `tone="live"` turns red only when the value is above 0. Optional `spark` and `delta` (real data only) |
| `EmptyState` | `src/components/empty-state.tsx` | Soft teal tile (or `art`), one sentence, one next step. Every list needs one |
| `Callout` | `src/components/blocks/callout.tsx` | `info` / `warn` / `danger` (role=alert) / `success` message with optional action |
| `KeyValue`, `Ticks`, `Breadcrumbs` | `src/components/blocks/lists.tsx` | Detail lists, check-mark feature lists, breadcrumb trail |
| `SectionCard`, `SettingRow`, `Advanced`, `NextStep`, `UsageMeter`, `cardInteractive` | `src/components/blocks/surfaces.tsx` | Card with head/body, setting with control, collapsible advanced options (`<details>`), next-step line, plan usage bar, hover lift for clickable cards |
| `ChoiceCard`, `Segmented`, `WizardSteps`, `WizardProgress` | `src/components/blocks/choices.tsx` | Selectable cards (native radio/checkbox), segmented toggle, wizard step list and progress bar |
| `SuccessBurst` | `src/components/blocks/success-burst.tsx` | Success moment for publish / upgrade |

### Motion graphics (`src/components/motion-graphics/`)

Original SVG scenes ported from the approved prototype. Timings are built by `Timeline` (`timeline.ts`) into
`@keyframes` once at module load and hoisted with React's `<style precedence>`; no `innerHTML`, no per-frame
JavaScript, only transform / opacity / stroke-dashoffset. `MotionScene` runs a scene only while it is on screen and
the tab is visible; under `prefers-reduced-motion` each scene shows its composed still frame. Styles:
`src/app/motion-graphics.css`.

| Scene | File | Where it goes |
|---|---|---|
| `HeroScene` (10 s) | `hero.tsx` | Landing hero |
| `JourneyScene` (10 s) | `journey.tsx` | How it works |
| `FeatureDemo kind=registration/poll/engagement/recording/conversion` (8 s) | `feature-demos.tsx` | Features page, landing feature grid |
| `LifecycleScene` (8 s, plays twice) | `lifecycle.tsx` | Dashboard empty states (`EmptyState art`) |
| `WizardScene step data` (5 s, plays once per step) | `wizard-scene.tsx` | Beside the create-webinar wizard; shows what the host typed as plain text |
| `Sparkline`, `PublishArt` | `small.tsx` | Stat cards, publish success |

Import each scene from its own file (no barrel), so client components don't pull in the larger scenes.
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
