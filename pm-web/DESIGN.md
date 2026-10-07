# PrevenTech web — design language

Internal operations app (work orders, approvals, preventive maintenance) used by technicians, approvers and admins on
desktop and phones. Visual language: **Linear-style product UI**, adapted to the INL brand: dense but calm, one
chromatic accent (INL teal), hierarchy from a surface ladder + hairline borders rather than shadows, Geist type with
tight tracking on headings, light **and** dark mode from the same tokens.

Design read (tasteskill): redesign-overhaul of visuals, information architecture preserved.
Dials: `DESIGN_VARIANCE 4` · `MOTION_INTENSITY 3` · `VISUAL_DENSITY 6`.

## Tokens (src/app/globals.css, mapped in tailwind.config.ts)

| Role | Utilities | Notes |
|---|---|---|
| Canvas / text | `bg-background text-foreground` | page background |
| Lifted panel | `bg-card`, or the `panel` utility (card + border + `shadow-edge`) | cards, tables, dialogs |
| Surface ladder | `bg-surface-2` (hover rows, tab tracks, inputs disabled), `bg-surface-3` (nested, pressed) | never skip from canvas to surface-3 |
| Hairlines | `border` (default colour), `border-input` on fields | 1px, no heavy borders |
| Muted text | `text-muted-foreground` | labels, meta |
| Accent | `bg-primary text-primary-foreground`, tint `bg-primary-soft text-primary-soft-foreground`, `text-primary` | the only chromatic accent. CTAs, active nav, focus, links |
| Semantic | `success` · `warning` · `danger` · `info`, each with `-soft` (tinted bg), `-foreground` (text on tinted), `-on-solid` (text on solid) | status only, never decoration |
| Charts | `hsl(var(--chart-1..8))`, `--chart-neutral`, `--chart-grid` via `lib/chart-colors.ts` | Recharts accepts these strings directly |
| Radius | buttons/inputs `rounded-md` (8px) · cards/panels `rounded-xl` (12px) · badges pill · chips `rounded-md` | shape lock, do not mix |
| Shadows | `shadow-sm` on cards only; `shadow-lg` for popovers/dialogs | tinted, never pure black |
| Numbers | `tabular` utility (tabular-nums) on counts, money, timestamps in columns | |
| Empty canvases | `bg-grid` (subtle technical grid) | used by EmptyState / PublicShell |

**Never** hardcode Tailwind palette colours (`bg-emerald-100`, `text-slate-700`, `bg-white`, `text-white`,
`bg-black/50`…). They break dark mode. Use the tokens above. If a colour is missing, say so instead of hardcoding.

## Components (src/components/ui + common)

- `Button` variants: `default` (primary), `outline`, `secondary`, `soft` (teal tint), `ghost`, `destructive`, `link`;
  sizes `xs | sm | default | lg | icon | icon-sm`. Icon-only buttons need `aria-label`.
- `Badge` variants: `neutral | primary | success | warning | danger | info` (tinted), `*-solid`, `dashed`, `outline`.
  Document statuses go through `StatusBadge` / `PriorityBadge` / `StepStatusChip` (common/badges.tsx) and
  `PmStatusBadge` & co (pm/pm-badges.tsx). Do not re-implement status colours.
- `Card` (+Header/Title/Content), `Section` (titled detail card), `InfoList`, `PageHeader` (title + description +
  actions, optional `eyebrow` and back link), `ScopeTabs` (tabs + explanation line), `EmptyState`, `ErrorState`,
  `LoadingState`, `Skeleton` (shimmer; shape it like the content), `Tabs`, `Input/Select/Textarea`, `Segmented`,
  `Dialog`, `Sheet`, `DropdownMenu`, `Pagination`.
- Theme: `useTheme()` from `components/theme/theme-provider` (rarely needed; tokens handle it).

## Layout & typography

- Page: `PageHeader` first, then content. Max width is set by the shell; pages use `space-y-4`/`space-y-6`.
- Headings: `text-2xl font-semibold tracking-tight` (page), `text-base font-semibold` (card). No uppercase eyebrows
  above every block; small uppercase labels only inside tables/definition lists.
- Body `text-sm`, meta `text-xs text-muted-foreground`. Max line length for prose ~65ch.
- Group with borders and spacing, not cards-inside-cards. One framing move per block.
- Tables on desktop (`md:` up), cards on phones. Row hover `bg-surface-2/60`. Sticky header is fine.
- Density 6: compact paddings (`p-4 sm:p-5`), 8px gaps inside rows, 16-24px between blocks.

## Interaction & motion

- Motion 3: hover/active/focus states only (`transition-[colors…] duration-150`), tactile `active:scale-[0.98]` on
  buttons, expand/collapse with `grid-rows-[0fr→1fr]`. No scroll animations, no infinite loops.
- Never `transition-all`. Animate `transform`/`opacity`/colours only. Respect `prefers-reduced-motion` (global rule
  already disables animations; do not fight it).
- Every interactive element: visible `focus-visible:ring-2 focus-visible:ring-ring`, hover state, ≥40px tap height on
  touch, `aria-label` on icon-only buttons, `<button>` for actions and `<Link>` for navigation.
- Forms: label above control (`Field`), helper text below, inline errors (`FieldError`, `role="alert"`), correct
  `type`/`inputMode`/`autoComplete`, submit button enabled until the request starts then `loading`.
- Loading: skeletons shaped like the final layout (not spinners) for lists and detail pages.
- Copy: Bahasa Indonesia, active voice, specific button labels ("Simpan Jadwal" not "OK"), ellipsis character `…`
  for loading/placeholder text, no em-dash (use comma or period).

## Dark mode checklist

- Only tokens, never raw palette classes. `bg-card` for panels, `bg-popover` for floating UI.
- Images/photos: give a `bg-surface-2` placeholder; avoid `bg-white` wrappers.
- Charts: colours from `lib/chart-colors.ts`, grid `TONE.grid`, axis text `TONE.ink`, tooltip `bg-popover border`.
- Text on tinted backgrounds uses the matching `-foreground` token; text on solid uses `-on-solid`.
