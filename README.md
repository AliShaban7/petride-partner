# PetRide Partner

Web dashboard for PetRide partners: vet clinics, grooming salons, pet hotels and pet shops. Partners use it to follow appointments and orders that come in from the PetRide app, the PetRide rides that bring pets in and take them home, their clients and pets, and their statistics. The site works at every width, from a 360px phone up to a desktop.

It is the companion to the PetRide mobile app, which lives in a separate repository. Everything here runs on a mock API with demo data until the Supabase backend is connected.

## Run it

```bash
npm install
npm run dev            # http://localhost:3100 (the port is set in package.json)
npm run lint           # ESLint (next/core-web-vitals + typescript + react-hooks 7)
npm run typecheck      # tsc --noEmit
npm run i18n:check     # az/ru/en message files have the same keys and placeholders
npm run build && npm start
```

### Demo logins (mock auth)

| Partner | Email | Password | What you see |
|---|---|---|---|
| IDEA Animal Care Center (vet, salon, hotel; real partner, mock data) | `idea@petride.az` | `petride123` | Appointments come first in the nav. Live PetRide rides and vaccine alerts. |
| PawPaw Pet Shop (demo partner) | `shop@petride.az` | `petride123` | Orders come first in the nav. PetRide courier delivery. |

The login page has "fill" buttons for both accounts. The partner card at the bottom of the sidebar (the "More" sheet on phones) switches between the two demo partners without logging out.

### Dev switches for the mock API

Add one of these to any URL. Each one also works when stored in `localStorage["petride.mock"]`:

- `?mock=empty`: every list comes back empty, to check empty states.
- `?mock=error`: every call fails with `ApiError("network")`, to check error states.
- `?mock=slow`: 2–3 s of latency, to check skeletons.
- `?mock=fast`: no latency.

`/az/ui-kit` is a reference page for the design system. It uses live mock data and is not linked from the nav.

## Stack

- Next.js 16 (App Router, Turbopack, `src/`, TypeScript strict). **Cache Components is turned off** in `next.config.ts` on purpose. Every dashboard route is behind a session cookie and shows per-partner data, so a prerendered shell gains nothing. With it off, `cookies()` and `params` can be read without Suspense rules.
- `src/proxy.ts` replaces `middleware.ts`, which Next 16 renamed. It handles the locale prefix and route protection.
- Tailwind CSS 4 with a CSS-first config. All tokens are declared in `@theme` in `src/app/globals.css`.
- Recharts 3, lucide-react, clsx + tailwind-merge (`cn()`), date-fns.
- Fonts come from `next/font/google`:
  - **Inter** is the UI font.
  - **Baloo 2** is the chunky rounded display face. It has the Azerbaijani ə/Ə but no Cyrillic.
  - **Nunito** is the Cyrillic display face. On Russian pages `:root:lang(ru)` swaps it in.

## Structure

```
src/
  proxy.ts                      locale redirect (/ → /az) + auth guard (→ /{locale}/login?next=…)
  app/
    globals.css                 design tokens (@theme), base styles, focus ring, reduced motion
    icon.svg                    favicon
    [locale]/                   root layout: <html lang>, fonts, I18nProvider, ToastProvider
      (auth)/login/             login page (SoftBackground + PeekingPaws, demo hints, error state)
      (dash)/layout.tsx         session check → SessionProvider → PartnerApiProvider → AppShell
      (dash)/{overview,appointments,orders,clients,stats,services,settings}/page.tsx
      (dash)/ui-kit/            design-system reference page
      (dash)/loading.tsx, error.tsx
  components/
    ui/                         design system (import from "@/components/ui")
    illustrations/              PawMark, PawArt, PeekingPaws, PawPeek, CornerPaw, SoftBackground, BrandTile
    shell/                      AppShell, Sidebar, TopBar, BottomTabBar, MoreSheet, menus, nav config
  lib/
    api/                        PartnerApi contract, mock implementation, hooks, Supabase stub
    auth/                       demo accounts, cookie session, server actions (login/logout/switch)
    i18n/                       locales, typed t(), providers, messages/{az,ru,en}/<namespace>.json
    format/                     money, numbers, dates, durations, phones per locale
    status.ts                   status → pill tone map (one place for status colours)
    cn.ts                       class-name merge helper
```

## Routing and responsive shell

- Every URL starts with `/az`, `/ru` or `/en`. Azerbaijani is the default. A bare URL is redirected using the `NEXT_LOCALE` cookie or the browser's `Accept-Language`.
- The language switcher keeps you on the same page and query, and remembers the choice in a cookie.
- **1024px and wider:** a dark teal sidebar with labels. You can collapse it to an icon rail, and the choice is saved in localStorage.
- **640–1023px:** an icon rail. The ☰ button in the top bar opens the full sidebar as an overlay; Esc or a click on the backdrop closes it.
- **Below 640px:** a top bar plus a bottom tab bar with 5 items (four key sections and "More"). "More" opens a sheet with the remaining sections, the language, the demo partner switch and log out.
- The partner type sets the navigation:
  - Clinics, salons and hotels lead with **Appointments**, followed by **PetRide rides** (the `/orders` route shows the rides to and from them).
  - Pet shops lead with **Orders**.
  - Sections a partner doesn't have are hidden (see `components/shell/nav.ts`).

## Data layer and where Supabase plugs in

- `src/lib/api/partner-api.ts` defines the `PartnerApi` interface. One instance serves one partner and one UI locale.
- `src/lib/api/mock/` is the in-memory implementation. It is a deterministic seeded generator covering 90 days of history and the next 14 days, with Azerbaijani and Russian names and realistic breeds.
  - It shares the mobile app's seed: Leyla Məmmədova (`user-leyla`) with Bella the Golden Retriever and Kitty Antonelli the tabby, the same vaccines, driver Anar Həsənov (Toyota Prius 10-AA-123) and Kitty's grooming ride `ride-1001`.
  - The "now" scenarios are relative to the current time. Bella is in the car to IDEA, about 24 min away. A driver is on the way, another is at a client's door, a pet is going home, and there are fresh requests and new shop orders.
  - Calls take 200–600 ms. Mutations change the live records: accept, decline, reschedule, check in, complete, no-show, cancel, order status, prices, hours, review replies and notes.
- `src/lib/api/index.ts` → `createPartnerApi()` picks the backend: `NEXT_PUBLIC_PARTNER_API=mock` (the default) or `supabase`.
- `src/lib/api/supabase.ts` is the stub where the Supabase implementation goes. Its header lists the tables, RLS and the Realtime plan. To build it:
  1. Implement every `PartnerApi` method against Supabase, returning the same shapes as the mock.
  2. Resolve localized fields for `locale`.
  3. Throw `ApiError` codes.
  4. Replace `src/lib/auth` with Supabase Auth (`@supabase/ssr`), keeping `getSession()`, `requireSession()` and the `Session` type.
  5. Call `invalidate(tag)` from Realtime subscriptions (rides, appointments, orders).
- **App ↔ partner mapping:**
  - An app `ServiceRequest` becomes a partner `Appointment`. `toServiceRequestStatus()` maps the partner status back to what the app shows: requested→pending, confirmed / checked_in / completed / no_show→confirmed, declined, cancelled.
  - App ride statuses (`searching | onway | arrived | intrip | completed | cancelled`) are reused as they are, plus `scheduled` for rides booked ahead.
  - **Prices:** a service with `priceAZN: null` shows "Qiymət yerində / Priced on site" in the app. When the partner sets a price on the Services page, that price replaces "Priced on site".
- **IDEA facts:** these come from the app seed (name, address, phone, the six services). Hours are **not** known: the mock ships editable defaults with `hoursConfirmed: false`, and the partner confirms the real hours in Settings. Service prices and all generated numbers are demo data, and the top bar says so.

## Accessibility

- Text and background pairs pass WCAG AA. The ratios are in the comments in `globals.css`.
- Coral is used only as a fill, with dark text on it.
- A status is never shown by colour alone: `StatusPill` always has text and an icon.
- There are visible focus rings, a skip link, semantic tables with captions, `aria-sort`, and modal focus traps with Esc.
- `prefers-reduced-motion` stops every looping animation.

## Screenshots

Captured from the dev server with the mock API (`?mock=fast`), headless Brave, with CSS animations switched off just before each capture so no entrance animation is caught half-way. Desktop is 1440 px wide, mobile 390 px; both are full-page. All files are in `docs/screenshots/`.

| Page | Desktop | Mobile |
|---|---|---|
| Overview, clinic (IDEA) | `docs/screenshots/overview-clinic-desktop.jpg` | `docs/screenshots/overview-clinic-mobile.jpg` |
| Overview, pet shop (PawPaw) | `docs/screenshots/overview-shop-desktop.jpg` | `docs/screenshots/overview-shop-mobile.jpg` |
| Overview, Russian | `docs/screenshots/overview-ru-desktop.jpg` | `docs/screenshots/overview-ru-mobile.jpg` |
| Appointments | `docs/screenshots/appointments-desktop.jpg` | `docs/screenshots/appointments-mobile.jpg` |
| Appointments, English | `docs/screenshots/appointments-en-desktop.jpg` | `docs/screenshots/appointments-en-mobile.jpg` |
| Orders, pet shop | `docs/screenshots/orders-shop-desktop.jpg` | `docs/screenshots/orders-shop-mobile.jpg` |
| PetRide rides, clinic | `docs/screenshots/rides-clinic-desktop.jpg` | `docs/screenshots/rides-clinic-mobile.jpg` |
| Statistics, clinic | `docs/screenshots/stats-clinic-desktop.jpg` | `docs/screenshots/stats-clinic-mobile.jpg` |
| Statistics, pet shop | `docs/screenshots/stats-shop-desktop.jpg` | `docs/screenshots/stats-shop-mobile.jpg` |
| Clients | `docs/screenshots/clients-desktop.jpg` | `docs/screenshots/clients-mobile.jpg` |
| Pet profile (Bella) | `docs/screenshots/pet-profile-desktop.jpg` | `docs/screenshots/pet-profile-mobile.jpg` |
| Services & prices | `docs/screenshots/services-desktop.jpg` | `docs/screenshots/services-mobile.jpg` |
| Settings | `docs/screenshots/settings-desktop.jpg` | `docs/screenshots/settings-mobile.jpg` |
| Login | `docs/screenshots/login-desktop.jpg` | `docs/screenshots/login-mobile.jpg` |
| Empty state (`?mock=empty`) | `docs/screenshots/overview-empty-desktop.jpg` | |
| Error state (`?mock=error`) | `docs/screenshots/appointments-error-desktop.jpg` | |

Demo logins for trying it yourself: `idea@petride.az` / `petride123` (clinic) and `shop@petride.az` / `petride123` (pet shop). See "Demo logins" above.
