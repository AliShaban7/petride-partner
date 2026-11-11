/**
 * Mock "partner extras" for the Services & Settings pages: everything those pages edit that the
 * shared PartnerApi contract (src/lib/api/partner-api.ts) does not cover yet:
 *   - profile fields beyond phone/email (name, localized address, categories, logo)
 *   - opening-hours extras (24/7, breaks, dated exceptions) on top of `PartnerProfile.hours`
 *   - PetRide integration extras (ride pickup buffer)
 *   - notification preferences, team members, device sessions, password change (mock)
 *   - service display order and prices kept while "show price in the app" is off
 *
 * It behaves like the main mock (same latency and ?mock=error / slow switches, in memory, re-seeded
 * on a full reload) and is read through `useApiQuery([EXTRAS_TAG], …)`, so invalidation works the
 * same way. When the Supabase backend lands these move into PartnerApi (see the page group's
 * open issues) and this file goes away.
 */
import { PARTNERS } from "@/lib/api/mock/catalog";
import { isDemoPartnerId, latency } from "@/lib/api/mock/store";
import { ApiError, type ClockTime, type ID, type ISODate, type IsoWeekday, type LocalizedText, type OpeningHoursDay, type ServiceCategory } from "@/lib/api/types";
import { accountForPartner, DEMO_PASSWORD } from "@/lib/auth/accounts";
import type { Locale } from "@/lib/i18n/config";

export const EXTRAS_TAG = "partner-extras";

// ---- Types -------------------------------------------------------------------------------------------

export type TeamRole = "owner" | "manager" | "staff";

export type TeamMember = {
  id: ID;
  name: string;
  email: string;
  role: TeamRole;
  status: "active" | "invited";
  /** The signed-in user. */
  isYou: boolean;
  invitedAt?: ISODate;
  lastActiveAt?: ISODate;
};

export type HoursBreak = { from: ClockTime; to: ClockTime };

export type HoursException = {
  id: ID;
  /** Local date `2026-12-31`. */
  date: string;
  closed: boolean;
  from: ClockTime;
  to: ClockTime;
  note: string;
};

export type NotificationEvent = "newRequest" | "rideArriving" | "newOrder" | "newReview";
export type NotificationChannels = { panel: boolean; email: boolean };

export type NotificationPrefs = {
  events: Record<NotificationEvent, NotificationChannels>;
  /** Sound in the dashboard when a new request / order comes in. */
  sound: boolean;
  dailySummary: boolean;
  dailySummaryTime: ClockTime;
  summaryEmail: string;
};

export type DeviceSession = {
  id: ID;
  device: "desktop" | "phone" | "tablet";
  /** "Chrome · macOS" — filled from the browser for the current session. */
  client: string;
  place: string;
  lastActiveAt: ISODate;
  current: boolean;
};

export type PartnerExtras = {
  profile: {
    name: string;
    address: LocalizedText;
    categories: ServiceCategory[];
    /** Data URL of the uploaded logo (mock; Supabase Storage later). */
    logoDataUrl: string | null;
    /** Set when name / address / categories changed: PetRide checks them before the app shows them. */
    reviewPendingAt: ISODate | null;
  };
  hours: {
    alwaysOpen: boolean;
    /** The regular week, kept while 24/7 is on (PartnerProfile.hours then holds 00:00–23:59). */
    weekly: OpeningHoursDay[] | null;
    breaks: Partial<Record<IsoWeekday, HoursBreak[]>>;
    exceptions: HoursException[];
  };
  integration: {
    /** Minutes before the visit the PetRide driver should drop the pet off. */
    pickupBufferMin: number;
  };
  notifications: NotificationPrefs;
  /** Language of e-mails and the daily summary. */
  emailLocale: Locale;
  team: TeamMember[];
  sessions: DeviceSession[];
  services: {
    /** Display order in the app (service ids). */
    order: ID[];
    /** Last price of services whose price is hidden ("Priced on site"), so it isn't lost. */
    hiddenPrices: Record<ID, number>;
  };
  passwordChangedAt: ISODate | null;
};

export type ProfileExtrasPatch = Partial<Pick<PartnerExtras["profile"], "name" | "address" | "categories" | "logoDataUrl">>;

// ---- Store -------------------------------------------------------------------------------------------

type StoredExtras = PartnerExtras & { password: string };

const stores = new Map<string, StoredExtras>();
const HOUR = 3_600_000;

function seed(partnerId: string): StoredExtras {
  if (!isDemoPartnerId(partnerId)) throw new ApiError("forbidden", `Unknown partner ${partnerId}`);
  const p = PARTNERS[partnerId];
  const account = accountForPartner(partnerId);
  const now = Date.now();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  const isShop = p.categories.includes("shop");

  const owner: TeamMember = {
    id: "tm-owner",
    name: account?.userName ?? p.shortName,
    email: p.email,
    role: "owner",
    status: "active",
    isYou: true,
    lastActiveAt: iso(0),
  };
  // IDEA is a real business: no invented staff. The demo shop gets a small demo team.
  const team: TeamMember[] = isShop
    ? [
        owner,
        { id: "tm-2", name: "Nigar Əliyeva", email: "nigar@pawpaw.demo", role: "manager", status: "active", isYou: false, lastActiveAt: iso(3 * HOUR) },
        { id: "tm-3", name: "Rauf Quliyev", email: "rauf@pawpaw.demo", role: "staff", status: "invited", isYou: false, invitedAt: iso(26 * HOUR) },
      ]
    : [owner];

  const nextNewYearsEve = (() => {
    const d = new Date(now);
    return `${d.getFullYear()}-12-31`;
  })();

  return {
    profile: {
      name: p.name,
      address: { ...p.address },
      categories: [...p.categories],
      logoDataUrl: null,
      reviewPendingAt: null,
    },
    hours: {
      alwaysOpen: false,
      weekly: null,
      breaks: {},
      // Never invent closures for IDEA; the demo shop shows how an exception looks.
      exceptions: isShop ? [{ id: "ex-1", date: nextNewYearsEve, closed: false, from: "10:00", to: "16:00", note: "Yeni il ərəfəsi" }] : [],
    },
    integration: { pickupBufferMin: 10 },
    notifications: {
      events: {
        newRequest: { panel: true, email: true },
        rideArriving: { panel: true, email: false },
        newOrder: { panel: true, email: true },
        newReview: { panel: true, email: false },
      },
      sound: true,
      dailySummary: false,
      dailySummaryTime: "08:00",
      summaryEmail: p.email,
    },
    emailLocale: "az",
    team,
    sessions: [
      { id: "ses-current", device: "desktop", client: "", place: "Bakı", lastActiveAt: iso(0), current: true },
      { id: "ses-2", device: "phone", client: "Safari · iOS", place: "Bakı", lastActiveAt: iso(2 * HOUR), current: false },
      { id: "ses-3", device: "desktop", client: "Chrome · Windows", place: "Bakı", lastActiveAt: iso(27 * HOUR), current: false },
    ],
    services: { order: [], hiddenPrices: {} },
    passwordChangedAt: null,
    password: DEMO_PASSWORD,
  };
}

function store(partnerId: string): StoredExtras {
  let s = stores.get(partnerId);
  if (!s) {
    s = seed(partnerId);
    stores.set(partnerId, s);
  }
  return s;
}

function snapshot(s: StoredExtras): PartnerExtras {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...rest } = s;
  return structuredClone(rest);
}

async function run<T>(partnerId: string, fn: (s: StoredExtras) => T): Promise<T> {
  await latency();
  return fn(store(partnerId));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Mock API for the extras (all async, all reject with ApiError like PartnerApi). */
export const extrasApi = {
  get: (partnerId: string) => run(partnerId, snapshot),

  updateProfile: (partnerId: string, patch: ProfileExtrasPatch) =>
    run(partnerId, (s) => {
      const p = s.profile;
      const reviewed =
        (patch.name !== undefined && patch.name !== p.name) ||
        (patch.address !== undefined && JSON.stringify(patch.address) !== JSON.stringify(p.address)) ||
        (patch.categories !== undefined && [...patch.categories].sort().join() !== [...p.categories].sort().join());
      if (patch.name !== undefined) {
        if (!patch.name.trim()) throw new ApiError("validation", "Name is required");
        p.name = patch.name.trim();
      }
      if (patch.address) p.address = { ...patch.address };
      if (patch.categories) {
        if (patch.categories.length === 0) throw new ApiError("validation", "Pick at least one category");
        p.categories = [...patch.categories];
      }
      if (patch.logoDataUrl !== undefined) p.logoDataUrl = patch.logoDataUrl;
      if (reviewed) p.reviewPendingAt = new Date().toISOString();
      return snapshot(s);
    }),

  updateHours: (partnerId: string, hours: PartnerExtras["hours"]) =>
    run(partnerId, (s) => {
      s.hours = structuredClone(hours);
      return snapshot(s);
    }),

  updateIntegration: (partnerId: string, integration: PartnerExtras["integration"]) =>
    run(partnerId, (s) => {
      s.integration = { ...integration };
      return snapshot(s);
    }),

  updateNotifications: (partnerId: string, prefs: NotificationPrefs, emailLocale?: Locale) =>
    run(partnerId, (s) => {
      if (prefs.dailySummary && !EMAIL_RE.test(prefs.summaryEmail)) throw new ApiError("validation", "Invalid e-mail");
      s.notifications = structuredClone(prefs);
      if (emailLocale) s.emailLocale = emailLocale;
      return snapshot(s);
    }),

  updateEmailLocale: (partnerId: string, emailLocale: Locale) =>
    run(partnerId, (s) => {
      s.emailLocale = emailLocale;
      return snapshot(s);
    }),

  updateServicesMeta: (partnerId: string, meta: PartnerExtras["services"]) =>
    run(partnerId, (s) => {
      s.services = structuredClone(meta);
      return snapshot(s);
    }),

  inviteMember: (partnerId: string, input: { email: string; name: string; role: Exclude<TeamRole, "owner"> }) =>
    run(partnerId, (s) => {
      const email = input.email.trim().toLowerCase();
      if (!EMAIL_RE.test(email)) throw new ApiError("validation", "Invalid e-mail");
      if (s.team.some((m) => m.email.toLowerCase() === email)) throw new ApiError("conflict", "Already in the team");
      const member: TeamMember = {
        id: `tm-${Date.now().toString(36)}`,
        name: input.name.trim(),
        email,
        role: input.role,
        status: "invited",
        isYou: false,
        invitedAt: new Date().toISOString(),
      };
      s.team.push(member);
      return structuredClone(member);
    }),

  resendInvite: (partnerId: string, id: ID) =>
    run(partnerId, (s) => {
      const m = s.team.find((x) => x.id === id);
      if (!m) throw new ApiError("not_found");
      if (m.status !== "invited") throw new ApiError("invalid_transition");
      m.invitedAt = new Date().toISOString();
      return structuredClone(m);
    }),

  updateMemberRole: (partnerId: string, id: ID, role: Exclude<TeamRole, "owner">) =>
    run(partnerId, (s) => {
      const m = s.team.find((x) => x.id === id);
      if (!m) throw new ApiError("not_found");
      if (m.role === "owner") throw new ApiError("forbidden", "The owner's role can't change");
      m.role = role;
      return structuredClone(m);
    }),

  removeMember: (partnerId: string, id: ID) =>
    run(partnerId, (s) => {
      const m = s.team.find((x) => x.id === id);
      if (!m) throw new ApiError("not_found");
      if (m.role === "owner" || m.isYou) throw new ApiError("forbidden", "Can't remove the owner");
      s.team = s.team.filter((x) => x.id !== id);
    }),

  /** Mock only: the demo login keeps accepting the demo password. */
  changePassword: (partnerId: string, current: string, next: string) =>
    run(partnerId, (s) => {
      if (current !== s.password) throw new ApiError("validation", "wrong_password");
      if (next.length < 8) throw new ApiError("validation", "too_short");
      s.password = next;
      s.passwordChangedAt = new Date().toISOString();
      return snapshot(s);
    }),

  revokeSession: (partnerId: string, id: ID) =>
    run(partnerId, (s) => {
      const target = s.sessions.find((x) => x.id === id);
      if (!target) throw new ApiError("not_found");
      if (target.current) throw new ApiError("forbidden", "Use log out for this device");
      s.sessions = s.sessions.filter((x) => x.id !== id);
    }),

  revokeOtherSessions: (partnerId: string) =>
    run(partnerId, (s) => {
      s.sessions = s.sessions.filter((x) => x.current);
    }),
};
