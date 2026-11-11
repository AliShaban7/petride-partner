/**
 * Period model for the statistics page: a preset (7 / 30 / 90 days ending today) or a custom
 * range of local calendar days, the same-length period right before it, and the chart buckets.
 *
 * All windows are `[start, end)` in epoch ms on local-day boundaries, exactly like the API's stats
 * (`periodWindow` in lib/api/mock/stats.ts): "7d" = the last 7 calendar days including today.
 * The page keeps the period in the URL: `?period=30d`, `?period=custom&from=2026-10-01&to=2026-10-31`,
 * `&compare=0` to hide the comparison.
 */

export const PRESETS = ["7d", "30d", "90d"] as const;
export type PresetPeriod = (typeof PRESETS)[number];
export type PeriodKind = PresetPeriod | "custom";

export const PRESET_DAYS: Record<PresetPeriod, number> = { "7d": 7, "30d": 30, "90d": 90 };
export const DEFAULT_PERIOD: PresetPeriod = "30d";
/** Longest custom range (a year, leap day included). */
export const MAX_CUSTOM_DAYS = 366;
/** Up to this many days the charts show one point per day; longer periods use 7-day buckets. */
export const DAILY_BUCKETS_UP_TO = 31;

export type StatsRange = {
  kind: PeriodKind;
  /** First local day, inclusive (`2026-10-13`). */
  from: string;
  /** Last local day, inclusive. */
  to: string;
  days: number;
  /** Local midnight of `from`. */
  start: number;
  /** Local midnight after `to` (exclusive). */
  end: number;
};

export type Bucket = {
  /** Local date the bucket starts on (`2026-10-13`). */
  key: string;
  start: number;
  end: number;
  /** 1 for daily buckets; 7 (or fewer for the last one) for weekly buckets. */
  days: number;
};

// ---- Local-day helpers ---------------------------------------------------------------------------

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local midnight of `ms`, moved by `days` (DST-safe: calendar arithmetic, not 24 h steps). */
export function dayStart(ms: number, days = 0): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}

/** `2026-11-14` for a local time. */
export function localDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local midnight of a `YYYY-MM-DD` string, or null when it isn't a real date. */
export function parseDay(value: string | null | undefined): number | null {
  const m = value ? DAY_RE.exec(value) : null;
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const date = new Date(y, mo, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null;
  return date.getTime();
}

/** Whole calendar days between two local midnights. */
export function daysBetween(start: number, end: number): number {
  return Math.round((end - start) / 86_400_000);
}

// ---- Ranges --------------------------------------------------------------------------------------

function make(kind: PeriodKind, start: number, end: number): StatsRange {
  return { kind, start, end, from: localDay(start), to: localDay(dayStart(end, -1)), days: daysBetween(start, end) };
}

/** The last `n` days including `today` (a `YYYY-MM-DD` local day). */
export function presetRange(kind: PresetPeriod, today: string): StatsRange {
  const end = dayStart(parseDay(today) ?? Date.now(), 1);
  return make(kind, dayStart(end, -PRESET_DAYS[kind]), end);
}

export type CustomRangeError = "invalid" | "order" | "future" | "tooLong";

/** Validates a custom range of local days (inclusive). */
export function customRange(from: string, to: string, today: string): StatsRange | CustomRangeError {
  const start = parseDay(from);
  const last = parseDay(to);
  const todayMs = parseDay(today);
  if (start === null || last === null || todayMs === null) return "invalid";
  if (start > last) return "order";
  if (last > todayMs) return "future";
  const end = dayStart(last, 1);
  if (daysBetween(start, end) > MAX_CUSTOM_DAYS) return "tooLong";
  return make("custom", start, end);
}

/** The period of the same length right before `range`. */
export function previousRange(range: StatsRange): StatsRange {
  return make(range.kind, dayStart(range.start, -range.days), range.start);
}

export function isPreset(value: string | null | undefined): value is PresetPeriod {
  return (PRESETS as readonly string[]).includes(value ?? "");
}

export type RangeState = { range: StatsRange; compare: boolean };

/** Reads `?period`, `?from`, `?to`, `?compare`; anything invalid falls back to the default period. */
export function rangeFromSearch(params: Pick<URLSearchParams, "get">, today: string): RangeState {
  const compare = params.get("compare") !== "0";
  const period = params.get("period");
  if (period === "custom") {
    const result = customRange(params.get("from") ?? "", params.get("to") ?? "", today);
    if (typeof result !== "string") return { range: result, compare };
  }
  return { range: presetRange(isPreset(period) ? period : DEFAULT_PERIOD, today), compare };
}

/** Query params for a range (merge into the current URL; `undefined` removes a param). */
export function rangeToQuery(range: StatsRange, compare: boolean): Record<string, string | undefined> {
  return {
    period: range.kind === DEFAULT_PERIOD ? undefined : range.kind,
    from: range.kind === "custom" ? range.from : undefined,
    to: range.kind === "custom" ? range.to : undefined,
    compare: compare ? undefined : "0",
  };
}

// ---- Buckets -------------------------------------------------------------------------------------

export function bucketDays(range: StatsRange): 1 | 7 {
  return range.days <= DAILY_BUCKETS_UP_TO ? 1 : 7;
}

/**
 * Chart buckets counted from the start of the range (not calendar weeks), so the current and the
 * previous period always have the same number of buckets and line up point by point.
 */
export function makeBuckets(range: StatsRange): Bucket[] {
  const size = bucketDays(range);
  const out: Bucket[] = [];
  for (let start = range.start; start < range.end; ) {
    const end = Math.min(dayStart(start, size), range.end);
    out.push({ key: localDay(start), start, end, days: daysBetween(start, end) });
    start = end;
  }
  return out;
}

/** Index of the bucket that contains `ms`, or -1 (buckets must be sorted and contiguous). */
export function bucketIndex(buckets: readonly Bucket[], ms: number): number {
  if (!buckets.length || ms < buckets[0].start || ms >= buckets[buckets.length - 1].end) return -1;
  let lo = 0;
  let hi = buckets.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ms < buckets[mid].start) hi = mid - 1;
    else if (ms >= buckets[mid].end) lo = mid + 1;
    else return mid;
  }
  return -1;
}
