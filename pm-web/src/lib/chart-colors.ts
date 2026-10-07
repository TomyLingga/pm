/**
 * Chart colours as CSS-variable references, so charts follow the light / dark tokens in globals.css.
 * Tones match the status badges (components/common/badges.tsx, components/pm/pm-badges.tsx).
 */

const tone = (name: string) => `hsl(var(--${name}))`;

export const TONE = {
  neutral: tone("chart-neutral"),
  primary: tone("chart-1"),
  info: tone("chart-2"),
  violet: tone("chart-3"),
  warning: tone("chart-4"),
  success: tone("chart-5"),
  danger: tone("chart-6"),
  indigo: tone("chart-7"),
  orange: tone("chart-8"),
  grid: tone("chart-grid"),
  ink: "hsl(var(--muted-foreground))",
};

/** Work Order statuses. */
export const WO_STATUS_COLORS: Record<string, string> = {
  submitted: TONE.neutral,
  received: TONE.info,
  in_progress: TONE.warning,
  completed: TONE.primary,
  closed: TONE.success,
  cancelled: TONE.danger,
  converted: TONE.indigo,
};

/** Form Request statuses. */
export const SR_STATUS_COLORS: Record<string, string> = {
  draft: TONE.neutral,
  waiting_superior: TONE.info,
  waiting_executor: TONE.indigo,
  in_progress: TONE.warning,
  completed: TONE.success,
  rejected: TONE.danger,
  cancelled: TONE.neutral,
  converted: TONE.violet,
};

/** PM task statuses. */
export const PM_STATUS_COLORS: Record<string, string> = {
  scheduled: TONE.neutral,
  due: TONE.warning,
  in_progress: TONE.info,
  completed: TONE.success,
  overdue: TONE.danger,
  skipped: TONE.neutral,
};

export const PRIORITY_COLORS: Record<string, string> = {
  high: TONE.danger,
  medium: TONE.warning,
  low: TONE.neutral,
};

/** PM compliance buckets. */
export const COMPLIANCE_COLORS = {
  on_time: TONE.success,
  late: TONE.orange,
  skipped: TONE.neutral,
  open_overdue: TONE.danger,
};

/** Series colours for generic multi-series charts (trend, SLA). */
export const SERIES_COLORS = {
  primary: TONE.primary,
  secondary: TONE.info,
  tertiary: TONE.violet,
  muted: TONE.neutral,
};

/** Palette for categorical data without a fixed mapping (WO categories). */
export const CATEGORY_PALETTE = [
  TONE.primary,
  TONE.info,
  TONE.violet,
  TONE.warning,
  TONE.success,
  TONE.indigo,
  TONE.orange,
  TONE.danger,
  TONE.neutral,
];

export function colorFor(map: Record<string, string>, key: string, fallback = TONE.neutral): string {
  return map[key] ?? fallback;
}
