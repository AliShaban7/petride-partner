/**
 * Locale-aware formatting for money, numbers, dates and durations — the same rules as the mobile
 * app (src/i18n/format.ts): AZ/RU `12,80 ₼`, EN `₼12.80`; dates `14 noyabr` / `14 ноября` / `Nov 14`;
 * 24-hour times everywhere. Pure functions, safe on the server and the client.
 *
 * Times are shown in the viewer's local time zone (partners are in Baku, UTC+4). Anything that
 * depends on "now" should render on the client to avoid hydration mismatches.
 */
import type { Locale } from "@/lib/i18n/config";

export const NBSP = " ";
const MINUS = "−";
const THIN = " ";

// ---- Numbers -------------------------------------------------------------------------------------

function group(intPart: string, sep: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

function decimal(n: number, digits: number, locale: Locale): string {
  const [i, d] = Math.abs(n).toFixed(digits).split(".");
  const sign = n < 0 && Number(Math.abs(n).toFixed(digits)) !== 0 ? MINUS : "";
  if (locale === "en") return sign + group(i, ",") + (d ? "." + d : "");
  return sign + group(i, NBSP) + (d ? "," + d : "");
}

/** `1 234` (az/ru, non-breaking space) / `1,234` (en). `digits` fixed decimals (default 0). */
export function formatNumber(n: number, locale: Locale, digits = 0): string {
  return decimal(n, digits, locale);
}

/** At most one decimal, trailing zero dropped: `24`, `3,5` / `3.5`. */
export function formatDecimal(n: number, locale: Locale): string {
  const rounded = Math.round(n * 10) / 10;
  return decimal(rounded, Number.isInteger(rounded) ? 0 : 1, locale);
}

/** Exactly `digits` decimals: rating `4,9` / `4.9`. */
export function formatFixed(n: number, digits: number, locale: Locale): string {
  return decimal(n, digits, locale);
}

/** Short big numbers for chart axes: `12,5 min` / `12,5 тыс.` / `12.5K`. Below 10 000 → full number. */
export function formatCompact(n: number, locale: Locale): string {
  const abs = Math.abs(n);
  if (abs < 10_000) return formatNumber(n, locale);
  const units: Record<Locale, [string, string]> = {
    az: [`${NBSP}min`, `${NBSP}mln`],
    ru: [`${NBSP}тыс.`, `${NBSP}млн`],
    en: ["K", "M"],
  };
  const [k, m] = units[locale];
  return abs >= 1_000_000 ? formatDecimal(n / 1_000_000, locale) + m : formatDecimal(n / 1000, locale) + k;
}

/**
 * Money in manat. AZ/RU `12,80 ₼`, EN `₼12.80`.
 * `decimals: 0` for KPI totals (`1 235 ₼`); `"auto"` drops `,00` on whole amounts (`35 ₼`, `12,50 ₼`).
 */
export function formatMoney(amountAZN: number, locale: Locale, options: { decimals?: 0 | 2 | "auto" } = {}): string {
  const mode = options.decimals ?? 2;
  const digits = mode === "auto" ? (Number.isInteger(Math.round(amountAZN * 100) / 100) ? 0 : 2) : mode;
  const num = decimal(amountAZN, digits, locale);
  if (locale === "en") return num.startsWith(MINUS) ? `${MINUS}₼${num.slice(1)}` : `₼${num}`;
  return `${num}${NBSP}₼`;
}

/** Compact money for chart axes: `12,5 min ₼` / `₼12.5K`. */
export function formatMoneyCompact(amountAZN: number, locale: Locale): string {
  const num = formatCompact(amountAZN, locale);
  return locale === "en" ? `₼${num}` : `${num}${NBSP}₼`;
}

/** Share 0–1 as a percentage: `42%` (az/en) / `42 %` (ru). */
export function formatPercent(ratio: number, locale: Locale, digits = 0): string {
  const num = decimal(ratio * 100, digits, locale);
  return locale === "ru" ? `${num}${NBSP}%` : `${num}%`;
}

/**
 * Signed change in percent points for delta chips: `+12%`, `−4%`, `0%`.
 * Input is a ratio (0.12 = +12%). Pair it with an arrow icon AND words for screen readers.
 */
export function formatDeltaPercent(ratio: number, locale: Locale): string {
  const pct = Math.round(ratio * 100);
  const sign = pct > 0 ? "+" : pct < 0 ? MINUS : "";
  const num = decimal(Math.abs(pct), 0, locale);
  return locale === "ru" ? `${sign}${num}${NBSP}%` : `${sign}${num}%`;
}

/** AZ `1,4 km`, RU `1,4 км`, EN `1.4 km`. */
export function formatDistance(km: number, locale: Locale): string {
  const digits = km < 10 && !Number.isInteger(km) ? 1 : 0;
  return `${decimal(km, digits, locale)}${NBSP}${locale === "ru" ? "км" : "km"}`;
}

/** `24 kq` / `24 кг` / `24 kg`. */
export function formatWeight(kg: number, locale: Locale): string {
  const unit = locale === "az" ? "kq" : locale === "ru" ? "кг" : "kg";
  return `${formatDecimal(kg, locale)}${NBSP}${unit}`;
}

// ---- Dates ---------------------------------------------------------------------------------------

/** Accepts a Date, an ISO string or epoch ms. Date-only ISO strings are read as local dates. */
export type DateInput = Date | string | number;

export function toDate(value: DateInput): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

const MONTHS_GENITIVE: Record<Locale, string[]> = {
  az: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"],
  ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

const MONTHS_NOMINATIVE: Record<Locale, string[]> = {
  az: ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"],
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

// Indexed by Date#getDay() (0 = Sunday). Short forms match the app (Book2.dc.html).
const WEEKDAYS_SHORT: Record<Locale, string[]> = {
  az: ["Bz", "B.e", "Ç.a", "Ç", "C.a", "Cü", "Şn"],
  ru: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

const WEEKDAYS_LONG: Record<Locale, string[]> = {
  az: ["Bazar", "Bazar ertəsi", "Çərşənbə axşamı", "Çərşənbə", "Cümə axşamı", "Cümə", "Şənbə"],
  ru: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

/** `14 noyabr` / `14 ноября` / `Nov 14`. */
export function formatDayMonth(value: DateInput, locale: Locale): string {
  const date = toDate(value);
  const d = date.getDate();
  const m = MONTHS_GENITIVE[locale][date.getMonth()];
  return (locale === "en" ? `${m} ${d}` : `${d} ${m}`).replace(/ /g, NBSP);
}

/** `14 noyabr`, with the year when it isn't the current one: `2 mart 2027` / `Mar 2, 2027`. */
export function formatDate(value: DateInput, locale: Locale, today: Date = new Date()): string {
  const date = toDate(value);
  const dayMonth = formatDayMonth(date, locale);
  if (date.getFullYear() === today.getFullYear()) return dayMonth;
  return locale === "en" ? `${dayMonth},${NBSP}${date.getFullYear()}` : `${dayMonth}${NBSP}${date.getFullYear()}`;
}

/** Always with the year: `14 noyabr 2026` / `Nov 14, 2026`. */
export function formatDateLong(value: DateInput, locale: Locale): string {
  const date = toDate(value);
  const dayMonth = formatDayMonth(date, locale);
  return locale === "en" ? `${dayMonth},${NBSP}${date.getFullYear()}` : `${dayMonth}${NBSP}${date.getFullYear()}`;
}

/** Numeric `14.11.2026` (az/ru) / `14/11/2026` (en) for dense tables. */
export function formatDateNumeric(value: DateInput, locale: Locale): string {
  const date = toDate(value);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return locale === "en" ? `${dd}/${mm}/${date.getFullYear()}` : `${dd}.${mm}.${date.getFullYear()}`;
}

/** `Noyabr 2026` / `Ноябрь 2026` / `November 2026`. */
export function formatMonthYear(value: DateInput, locale: Locale): string {
  const date = toDate(value);
  return `${MONTHS_NOMINATIVE[locale][date.getMonth()]}${NBSP}${date.getFullYear()}`;
}

/** Month name for chart axes: `noy` / `ноя` / `Nov`. */
export function formatMonthShort(value: DateInput, locale: Locale): string {
  const name = MONTHS_NOMINATIVE[locale][toDate(value).getMonth()];
  return locale === "en" ? name.slice(0, 3) : name.slice(0, 3).toLowerCase();
}

/** `B.e` / `Пн` / `Mon`. */
export function formatWeekdayShort(value: DateInput, locale: Locale): string {
  return WEEKDAYS_SHORT[locale][toDate(value).getDay()];
}

/** `Bazar ertəsi` / `Понедельник` / `Monday`. */
export function formatWeekday(value: DateInput, locale: Locale): string {
  return WEEKDAYS_LONG[locale][toDate(value).getDay()];
}

/** Weekday names by ISO day (1 = Monday … 7 = Sunday) — for opening hours and heatmaps. */
export function weekdayName(isoDay: number, locale: Locale, short = false): string {
  const index = isoDay % 7; // 7 → 0 (Sunday)
  return (short ? WEEKDAYS_SHORT : WEEKDAYS_LONG)[locale][index];
}

/** 24-hour `09:45` in all three languages. */
export function formatTime(value: DateInput): string {
  const date = toDate(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** `11:00–12:30`. */
export function formatTimeRange(start: DateInput, end: DateInput): string {
  return `${formatTime(start)}–${formatTime(end)}`;
}

/** `14 noyabr, 11:00` / `14 ноября, 11:00` / `Nov 14, 11:00`. */
export function formatDateTime(value: DateInput, locale: Locale, today: Date = new Date()): string {
  return `${formatDate(value, locale, today)}, ${formatTime(value)}`;
}

/** `Şənbə, 14 noyabr` / `Суббота, 14 ноября` / `Saturday, Nov 14` (app ServiceDetail style). */
export function formatWeekdayDate(value: DateInput, locale: Locale): string {
  return `${formatWeekday(value, locale)}, ${formatDayMonth(value, locale)}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const DAY_WORDS: Record<Locale, { today: string; tomorrow: string; yesterday: string }> = {
  az: { today: "Bu gün", tomorrow: "Sabah", yesterday: "Dünən" },
  ru: { today: "Сегодня", tomorrow: "Завтра", yesterday: "Вчера" },
  en: { today: "Today", tomorrow: "Tomorrow", yesterday: "Yesterday" },
};

/** `Bu gün` / `Sabah` / `Dünən`, otherwise `14 noyabr`. For agenda group headers. */
export function formatDayLabel(value: DateInput, locale: Locale, now: Date = new Date()): string {
  const date = toDate(value);
  const words = DAY_WORDS[locale];
  if (sameDay(date, now)) return words.today;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (sameDay(date, tomorrow)) return words.tomorrow;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(date, yesterday)) return words.yesterday;
  return formatDate(date, locale, now);
}

// ---- Durations & relative time ------------------------------------------------------------------

const RU_FORMS = (n: number, one: string, few: string, many: string) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

/** Minutes → `45 dəq`, `1 saat 30 dəq`, `2 gün` / `1 ч 30 мин` / `1 h 30 min`. */
export function formatDuration(minutes: number, locale: Locale): string {
  const m = Math.max(0, Math.round(minutes));
  const units = {
    az: { min: "dəq", h: "saat", d: "gün" },
    ru: { min: "мин", h: "ч", d: "дн." },
    en: { min: "min", h: "h", d: "d" },
  }[locale];
  if (m >= 1440 && m % 1440 === 0) {
    const days = m / 1440;
    if (locale === "en") return `${days}${NBSP}${days === 1 ? "day" : "days"}`;
    if (locale === "ru") return `${days}${NBSP}${RU_FORMS(days, "день", "дня", "дней")}`;
    return `${days}${NBSP}${units.d}`;
  }
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}${NBSP}${units.min}`;
  if (rest === 0) return `${h}${NBSP}${units.h}`;
  return `${h}${NBSP}${units.h} ${rest}${NBSP}${units.min}`;
}

/** `5 dəq əvvəl` / `5 мин назад` / `5 min ago`; future: `5 dəq sonra` / `через 5 мин` / `in 5 min`. */
export function formatRelative(value: DateInput, locale: Locale, now: Date = new Date()): string {
  const date = toDate(value);
  const diffMin = Math.round((date.getTime() - now.getTime()) / 60_000);
  const abs = Math.abs(diffMin);
  const future = diffMin > 0;
  if (abs < 1) return { az: "indicə", ru: "только что", en: "just now" }[locale];

  let amount: string;
  if (abs < 60) {
    amount = `${abs}${NBSP}${{ az: "dəq", ru: "мин", en: "min" }[locale]}`;
  } else if (abs < 60 * 24) {
    const h = Math.round(abs / 60);
    amount = `${h}${NBSP}${{ az: "saat", ru: "ч", en: "h" }[locale]}`;
  } else {
    const d = Math.round(abs / (60 * 24));
    if (d === 1 && !future) return DAY_WORDS[locale].yesterday.toLowerCase();
    if (d === 1 && future) return DAY_WORDS[locale].tomorrow.toLowerCase();
    if (d > 6) return formatDate(date, locale, now);
    amount =
      locale === "ru"
        ? `${d}${NBSP}${RU_FORMS(d, "день", "дня", "дней")}`
        : locale === "en"
          ? `${d}${NBSP}${d === 1 ? "day" : "days"}`
          : `${d}${NBSP}gün`;
  }
  if (locale === "az") return future ? `${amount} sonra` : `${amount} əvvəl`;
  if (locale === "ru") return future ? `через ${amount}` : `${amount} назад`;
  return future ? `in ${amount}` : `${amount} ago`;
}

/** Whole minutes from now until `value` (negative when in the past). */
export function minutesUntil(value: DateInput, now: Date = new Date()): number {
  return Math.round((toDate(value).getTime() - now.getTime()) / 60_000);
}

// ---- People & phones -----------------------------------------------------------------------------

/** E.164 `+994125656655` → `+994 12 565 66 55` (AZ numbers); others are returned unchanged. */
export function formatPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.startsWith("994") && digits.length === 12) {
    const n = digits.slice(3);
    return `+994${NBSP}${n.slice(0, 2)}${NBSP}${n.slice(2, 5)}${NBSP}${n.slice(5, 7)}${NBSP}${n.slice(7, 9)}`;
  }
  return e164;
}

/** `tel:` href for a phone number. */
export function phoneHref(e164: string): string {
  return `tel:${e164.replace(/[^\d+]/g, "")}`;
}

/** Initials for avatars: "Leyla Məmmədova" → "LM", "Bella" → "B". */
export function initials(name: string, max = 2): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max)
    .map((part) => part[0]?.toLocaleUpperCase() ?? "")
    .join("");
}

/** Pet age from a birth date: `3 yaş` / `3 года` / `3 yrs`, or months under a year. */
export function formatAge(birthDate: DateInput, locale: Locale, now: Date = new Date()): string {
  const born = toDate(birthDate);
  let months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) months -= 1;
  months = Math.max(0, months);
  if (months < 12) {
    if (locale === "az") return `${months}${NBSP}ay`;
    if (locale === "ru") return `${months}${NBSP}${RU_FORMS(months, "месяц", "месяца", "месяцев")}`;
    return `${months}${NBSP}${months === 1 ? "mo" : "mos"}`;
  }
  const years = Math.floor(months / 12);
  if (locale === "az") return `${years}${NBSP}yaş`;
  if (locale === "ru") return `${years}${NBSP}${RU_FORMS(years, "год", "года", "лет")}`;
  return `${years}${NBSP}${years === 1 ? "yr" : "yrs"}`;
}

export { THIN };
