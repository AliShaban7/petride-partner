<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# PetRide Partner: rules for page builders

Read `README.md` first for what the app is, how to run it and the demo logins. This file covers how to build a page. Several agents build pages **in parallel**, so the ownership rules below matter.

## 1. Ownership: what you may edit

| Page group | Your files (create anything inside) | Your messages |
|---|---|---|
| Overview | `src/app/[locale]/(dash)/overview/**` | `src/lib/i18n/messages/{az,ru,en}/overview.json` |
| Appointments | `…/(dash)/appointments/**` | `…/appointments.json` |
| Orders | `…/(dash)/orders/**` | `…/orders.json` |
| Clients (& pets) | `…/(dash)/clients/**` | `…/clients.json` |
| Statistics | `…/(dash)/stats/**` | `…/stats.json` |
| Services & prices | `…/(dash)/services/**` | `…/services.json` |
| Settings | `…/(dash)/settings/**` | `…/settings.json` |

- **Never edit another group's folder or messages file.** Every namespace above is already registered in `src/lib/i18n/types.ts` and `src/lib/i18n/messages.ts`, so you don't touch those files either.
- **Shared foundation is read-only** for page builders:
  - `src/components/{ui,shell,illustrations}`
  - `src/lib/**`
  - `src/app/globals.css`
  - the `[locale]` and `(dash)` layouts
  - the `common`, `status`, `shell` and `auth` namespaces
- Page-specific components go in your folder, e.g. `…/appointments/_components/RequestCard.tsx`. Folders that start with `_` are not routes.
- If the foundation is missing something:
  - **Small gap:** wrap it locally.
  - **Real gap:** list it under "open issues" in your report. Don't patch shared files.

## 2. Page pattern

The page is a Server Component that sets the metadata and renders one Client Component view:

```tsx
// src/app/[locale]/(dash)/appointments/page.tsx
import type { Metadata } from "next";
import { getT, localeFromParams } from "@/lib/i18n/server";
import { AppointmentsView } from "./AppointmentsView";

type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getT(await localeFromParams(params), "appointments");
  return { title: t("meta.title"), description: t("meta.description") };
}
export default function Page() {
  return <AppointmentsView />;
}
```

```tsx
// AppointmentsView.tsx
"use client";
import { PageHeader, Panel, AsyncView, ResponsiveTable, StatusPill } from "@/components/ui";
import { useApiQuery, useApiMutation } from "@/lib/api/hooks";
import { useLocale, useT } from "@/lib/i18n/client";
```

- **One `<h1>` per page.** It comes from `PageHeader`. Overview uses `size="hero"`, the friendly uppercase greeting (40px on desktops).
- Sections are `Panel`s (an `h2` inside a `<section aria-labelledby>`). Lay them out with CSS grid: `grid gap-4 sm:grid-cols-2 xl:grid-cols-4`, `lg:grid-cols-[2fr_1fr]`. Stack page blocks with `space-y-section` (16px). See **Density** below before you add anything tall.
- Don't add page padding. `AppShell`'s `<main>` already has it, with `max-w-[1440px]`.
- Anything that depends on "now" (greetings, "in 12 min", today's date) renders in Client Components. The dashboard data is client-side anyway.
- **Feature gating:** call `partnerFeatures(useSession())` from `@/components/shell` and `@/lib/auth/client`. The pet shop has no appointments and the clinic has no orders. If someone opens a route their partner doesn't have, show an `EmptyState` that explains it. Don't crash.

### URL conventions (other parts of the app link to these)

| URL | Who sends it | Expected behaviour |
|---|---|---|
| `/appointments?status=requested` | top-bar "N new requests" badge | pre-filter |
| `/orders?status=new` | top-bar "N new orders" badge | pre-filter |
| `/appointments?id=apt-123`, `/orders?id=ord-12`, `/clients?id=cl-5` | notifications | open that record (Drawer) |
| `/clients?q=…`, `/appointments?q=A-1042`, `/orders?q=S-2031` | global search | pre-fill the search |

Read these with `useSearchParams()`. Keep filters in the URL with `router.replace` so back/forward and sharing work.

## 3. Data: `@/lib/api`

```ts
const q = useApiQuery(["appointments", query], (api) => api.listAppointments(query));       // read
const confirm = useApiMutation((api, id: string) => api.confirmAppointment(id));             // write
const live = useApiQuery(["rides", "live"], (api) => api.listRides({ live: true }), { refreshMs: 15_000 });
```

- **The key:** the first element is the resource tag. After a successful mutation every query refetches by default; use `{ invalidates: ["appointments", "overview"] }` to narrow it. The rest of the key must hold every input of the fetcher.
- **What a query returns:** `QueryResult` = `{ data, error, isLoading, isRefreshing, status, refetch }`. The last data stays visible while a refetch runs.
- **What a mutation returns:** `useApiMutation` gives `{ mutate, mutateAsync, isPending, error, reset }`. `mutate` resolves to `undefined` if the call failed, and the error lands in `error`.
- **Showing errors:** use `ErrorState error={e}`, or `tc(\`errors.${errorCode(e)}\`)` with `tc = useT("common")`.
- **Types:** all of them are in `@/lib/api/types` (re-exported from `@/lib/api`).
- **Methods** (see `src/lib/api/partner-api.ts` for the docs on each):

| Area | Methods |
|---|---|
| Partner | `getPartner`, `updatePartner({ phone, email, acceptsRides, offersCourierDelivery, autoConfirm, responseWindowMin, hours })`. Saving hours sets `hoursConfirmed`. IDEA's hours are unknown, so ask the partner to confirm them. |
| Services | `listServices`, `updateService(id, { priceAZN, priceFrom, durationMin, nameI18n, descriptionI18n, species, active })`, `createService`, `archiveService`. `priceAZN: null` means "Priced on site" in the app. |
| Products (shop) | `listProducts`, `updateProduct(id, { priceAZN, stock, lowStockAt, active, nameI18n })` |
| Appointments | `listAppointments({ from, to, status[], category[], serviceId, withRide, clientId, petId, search, sort, page, pageSize })` returns `Paged<Appointment>`; `getAppointment`; `confirmAppointment`, `declineAppointment(id, reason)`, `rescheduleAppointment(id, startISO)`, `checkInAppointment`, `completeAppointment(id, { amountAZN, staffNote })`, `markNoShow`, `cancelAppointment(id, reason)`, `createAppointment`, `updateAppointmentNote` |
| Rides | `listRides({ live, from, to, direction, status[] })`, `getRide`. Status and ETA are live. `appointment.ride` and `appointment.returnRide` are embedded. |
| Clients & pets | `listClients({ search, filter: "vaccine_due" \| "rides" \| "repeat" \| "new", sort, page })`, `getClient(id)` (returns client, pets, appointments, orders, rides, reviews), `updateClientNote`, `listPets({ search, species, health[], sort })`, `getPet`, `updatePetNote` |
| Orders (shop) | `listOrders({ status[], fulfilment, search, sort, page })`, `getOrder`, `updateOrderStatus(id, "preparing" \| "ready" \| "delivered" \| "picked_up")` (setting `ready` on a courier order books the PetRide courier), `cancelOrder(id, reason)` |
| Reviews | `listReviews({ rating[], unanswered })`, `replyToReview` |
| Notifications | `listNotifications`, `markNotificationRead`, `markAllNotificationsRead` |
| Stats | `getOverview()` (partner, `kpis` for **7d**, today's agenda, pending requests, live rides, open orders, vaccine alerts, latest reviews), `getKpis(period)`, `getDailySeries(period)`, `getRevenueSeries(period, "day" \| "week")`, `getServiceMix`, `getBusyHours`, `getRideShare`, `getRepeatClients`, `getRatingStats`. A period is `"today" \| "7d" \| "30d" \| "90d"`. Every `Kpi` has `{ value, previous, delta }`, where `delta` is a ratio, or `null` when there is nothing to compare with (90d has no history before it). |

- **Mutation rules:** a transition that isn't allowed rejects with `ApiError("invalid_transition")`. Only offer the buttons that are valid for the current status.
- **Dev switches:** use `?mock=empty | error | slow` to check every state of your page.

## 4. UI kit: `@/components/ui`

Open `/az/ui-kit` to see every component working on real mock data.

| Need | Use |
|---|---|
| Page title / greeting | `PageHeader title description eyebrow actions size="page"\|"hero" descriptionOnMobile` — title and `actions` share one row from 640px; `description` is optional and small; `descriptionOnMobile={false}` hides it below 640px |
| Section | `Panel title description actions icon tone padding="none"\|"xs"\|"sm"\|"md"\|"lg"` (`tone`: white, muted, mint, peach, lilac, sand, sky, rose, softMint, softPeach, softLilac, softSand, dark). Title and `actions` share the first row; `description` runs under them. The `icon` tile is hidden while the header is narrower than 21rem (phones, three panels across), so title and "View all" fit on one row |
| Plain surface | `Card tone padding interactive` (padding: xs 12px · sm 16px · md 16px, 20px from 1024px · lg 20px, 24px from 1024px) |
| KPI | `KpiCard label icon value unit delta deltaLabel positiveIsGood tone="mint"\|"peach"\|"lilac"\|"sand"\|"sky"\|"rose" pet="golden"\|"ginger"\|"tabby"\|"cream"\|null href loading index size="md"\|"sm"\|"lg"`, with `deltaLabel={tc(\`delta.vs_${period}\`)}`. `md` (default) ≈ 130px tall; `sm` puts value and change chip on one line with the "vs …" label and `footnote` under them (≈ 90–110px); `lg` is the old big card. `deltaLabelVisible={false}` keeps the label for screen readers only (when the page header already states the comparison) |
| Change chip alone | `DeltaChip value label positiveIsGood showLabel` |
| Status | `StatusPill kind="appointment"\|"order"\|"ride"\|"health"\|"vaccine"\|"payment"\|"availability"\|"stock" status=… size="sm"\|"md"`. Generic chip: `Pill tone`. Metadata: `Tag`. Counts: `CountBadge` |
| Person / pet | `Avatar name tint species size="xs"\|"sm"\|"md"\|"lg"\|"xl" shape="circle"\|"tile" src` |
| Table / list | `ResponsiveTable caption columns rows getRowId rowHref\|onRowClick selectedId sort onSortChange defaultSort loading empty mobileCard stickyHeader`. Columns: `{ id, header, cell, sortable, sortValue, align, className, rowHeader, mobile: "title"\|"subtitle"\|"badge"\|"meta"\|"footer"\|"hidden" }`. It turns into cards under 640px. For custom tables use the `Table/THead/TBody/Tr/Th/Td/SortableTh` primitives. |
| Paging | `Pagination page pageCount total pageSize onPageChange` |
| Loading / empty / error | `AsyncView query loading empty isEmpty compact>{(data) => …}</AsyncView>`, `Skeleton`, `SkeletonRows`, `SkeletonText`, `SkeletonCard`, `EmptyState title description action pet compact`, `ErrorState error onRetry compact` |
| Tabs | `Tabs tabs value onChange label idPrefix variant="underline"\|"pills"` + `TabPanel idPrefix value`. A tab's `count` is a coral `CountBadge` by default; `countTone: "neutral"` shows a grey count (also 0) for history tabs. |
| Single choice | `SegmentedControl options value onChange label size fullWidth` (period switcher) |
| Forms | `Input label hint error leftIcon rightSlot`, `Select options placeholder`, `Textarea`, `DateInput kind="date"\|"time"\|"datetime-local"`, `SearchField label value onValueChange` (a `search` landmark named by `label`), `Switch checked onCheckedChange label description hideLabel` (32px track with a built-in 44px hit area), `Checkbox`, `Field` (custom controls) |
| Buttons | `Button variant="primary"\|"secondary"\|"ghost"\|"accent"\|"danger"\|"outline" size loading leftIcon`, `ButtonLink href`, `IconButton label icon badge` |
| Overlays | `Drawer open onClose title description footer side="auto"\|"right"\|"bottom"` (a bottom sheet on phones), `Dialog`, `ConfirmDialog tone="danger"` for destructive actions, `Menu items trigger` (row "…" actions; renders in a portal with fixed position, so table scroll boxes and drawer footers don't clip it, and flips upwards near the bottom; Esc closes only the menu, not a Drawer under it), `Popover`, `Tooltip content` |
| Feedback | `const { toast } = useToast(); toast({ title, description, tone: "success"\|"error"\|"info", action: { label, onClick } })` |
| Charts | `ChartCard title summary legend actions height loading error onRetry empty` (`height` defaults to 220), wrapping **one** Recharts chart. Also: `CHART_COLORS`, `chartAxisProps`, `chartGridProps`, `ChartTooltipContent valueFormatter labelFormatter`. `summary` is required: one plain sentence that a screen reader reads out. |
| Misc | `DetailList items`, `ProgressBar value label`, `Spinner`, `VisuallyHidden` |
| Art (`@/components/illustrations`) | `PawPeek pet size` (empty states), `CornerPaw` (corners of cards), `PeekingPaws height density`, `PawArt pet width`, `PawMark`, `SoftBackground` |

### Visual rules

- **Tokens only.** Use `bg-primary`, `text-fg-secondary`, `bg-pastel-peach`, `rounded-panel`, `shadow-card`, `font-display` and so on (see `globals.css`). No raw hex, no new fonts.
- **Coral (`bg-accent`) is a fill only, always with dark `text-fg`.** Never put white text on it.
- **On pastel fills** (`pastel-*`, `soft-*`) use only `text-fg` or `text-fg-tertiary`. `text-fg-secondary` and `text-primary` don't reach 4.5:1 there.
- Statuses always go through `StatusPill`, so the colours stay consistent (`src/lib/status.ts`). Never show a status by colour alone.
- **Motion:** use `animate-fade-up` with `style={{ animationDelay }}` to stagger entrances, and hover lifts. Keep it subtle. Reduced motion is handled globally.
- **Mobile:** no horizontal page scroll at 360px. A sideways scroller (KPI strip, Kanban board) must be `relative`, or `sr-only` text inside it escapes the clipping and widens the page. Wrap wide tables in `ResponsiveTable` or `Table`, which scroll inside themselves. Touch targets are at least 44px.
- **Accessibility:**
  - Every icon-only button needs a `label`.
  - Every table needs a `caption`.
  - Every chart needs a `summary`.
  - Every input needs a `label`.
  - Live regions are already handled for toasts.
  - Use `aria-busy` while loading (AsyncView does it for you).

### Density / no-scroll

The product owner's rule: **cut scrolling as much as possible, without losing information or actions.** The important things on a page should fit on a 1280×800 / 1440×900 screen with little or no scrolling, and phones should scroll clearly less.

- **No prose that repeats the screen.** Don't write a sentence that restates numbers already in KPI cards or lists ("Today you have 17 appointments, 8 requests…"), a description that restates the title, or helper text that says the obvious ("Updates every 10 seconds", "Here you can see…"). Keep text that tells people something they can't see. `PageHeader`/`Panel` descriptions are optional: leave them out by default.
- **Use the width.** Put filters, period switchers and the main action in `PageHeader actions` or `Panel actions` (they share the title's row). Put panels side by side on `lg`/`xl` (2–3 columns). Move secondary filters into one "Filters" `Popover`/`Drawer`, and turn stacked sections into `Tabs` or a `SegmentedControl`.
- **Cap dashboard lists** at 3–5 items with a "see all" link (`tc("actions.viewAll")`: Hamısına bax / Смотреть все / View all) to the full page; full pages keep the whole list with `Pagination`.
- **Rhythm:** `space-y-section` / `gap-4` between page blocks (not `space-y-6`/`8`), default `Panel` padding, `KpiCard` default size (`size="sm"` in strips and side panels), `ChartCard` height 160–220 (no taller than 260), `EmptyState compact` / `ErrorState compact` inside panels, cards and charts.
- **Sticky toolbars** are fine where they save scrolling back up: add `sticky-toolbar` (sticks under the top bar on every width, z-20) plus a background such as `bg-bg/90 backdrop-blur-md`.
- **Targets:** below 1024px every pressable stays ≥ 44px (the kit's `Button sm`, `IconButton sm`, `SegmentedControl`, `Pagination` and `Switch` already reach 44px with an invisible hit area). From 1024px dense desktop controls (table row actions, small icon buttons) may be 36px. Never go below `text-caption` (12px) and keep the contrast rules above.
- **Measure it.** Compare `document.documentElement.scrollHeight` before and after at 1440×900, 1280×800 and 390×844 (the foundation's `measure.mjs` does this with a pinned clock so runs are comparable).

## 5. Copy and i18n

- **Hooks:** `const t = useT("appointments")` in Client Components, `getT(locale, "appointments")` on the server. Shared text comes from `useT("common")`: actions, states, errors, periods, delta, money, species. Status labels come from the `status` namespace, and `StatusPill` handles them itself.
- **Keys** are typed against `messages/az/<ns>.json`. Add every key to **all three** files (`az`, `ru`, `en`). `tsc` fails if ru or en is missing a key that az has, and `npm run i18n:check` checks that the keys and `{{placeholders}}` match.
- **Interpolation:** `t("greeting", { name })` with `{{name}}` in the JSON.
- **Plurals:** `t.plural("visits", n)` with the keys `visits_one`, `visits_other` in az/en, and `visits_one`, `visits_few`, `visits_many`, `visits_other` in ru. `{{count}}` is filled in already formatted.
- **Keys built at runtime:** use `t.dynamic(\`filters.${id}\`)` and `t.has(key)`.
- **Voice** (the PetRide tone guide):
  - Use informal address: *sən* in az, *ты* in ru, casual *you* with contractions in en.
  - Be warm and short. Buttons are verbs.
  - Numbers, money and statuses stay businesslike and clear.
  - No emoji, and no clichés like *hər şey bir yerdə* or *Hörmətli müştəri*.
  - Russian may be up to 30% longer than Azerbaijani.
  - Never promise what isn't true: no "24/7" for IDEA, and no invented IDEA hours or prices.
- **Glossary:** booking = *sifariş* / *заказ*; appointment = *randevu* / *запись*; request = *sorğu* / *заявка*; ride = *gediş* / *поездка*; driver = *sürücü* / *водитель*; partner = *tərəfdaş* / *партнёр*; priced on site = *qiymət yerində* / *цена на месте*; vet = *baytar* / *ветеринар*.
- **Formatting** (`@/lib/format`): never format by hand. Use:
  - `formatMoney(n, locale, { decimals: 0 | 2 | "auto" })`, giving `12,80 ₼` / `₼12.80`
  - `formatNumber`, `formatPercent(ratio)`, `formatDeltaPercent`
  - `formatDate` (`14 noyabr` / `14 ноября` / `Nov 14`), `formatDayMonth`, `formatDateTime`, `formatTime`, `formatTimeRange`, `formatWeekday(Short)`, `weekdayName(isoDay)`, `formatDayLabel` (Bu gün / Sabah)
  - `formatRelative` ("5 dəq əvvəl"), `formatDuration(min)`, `formatAge`, `formatWeight`, `formatDistance`, `formatPhone` (`+994 12 565 66 55`), `phoneHref`, `initials`
  - For chart axes: `formatCompact` and `formatMoneyCompact`
- Links inside the app: `localizedHref(locale, ROUTES.orders, { status: "new" })` from `@/lib/i18n/navigation`.

## 6. Before you hand off

```bash
npm run lint && npm run typecheck && npm run i18n:check
```

Then open your page at 360px, 800px and 1280px, in az, ru and en, with `?mock=empty`, `?mock=error` and `?mock=slow`.
