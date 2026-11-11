/**
 * Message types. The Azerbaijani files are the source of truth: every key used by `t()` is
 * type-checked against them, and src/lib/i18n/messages.ts fails to compile if a ru/en file is
 * missing a key. (Type-only imports: nothing here ends up in a bundle.)
 */
import type appointments from "./messages/az/appointments.json";
import type auth from "./messages/az/auth.json";
import type clients from "./messages/az/clients.json";
import type common from "./messages/az/common.json";
import type orders from "./messages/az/orders.json";
import type overview from "./messages/az/overview.json";
import type services from "./messages/az/services.json";
import type settings from "./messages/az/settings.json";
import type shell from "./messages/az/shell.json";
import type stats from "./messages/az/stats.json";
import type status from "./messages/az/status.json";

export type Messages = {
  common: typeof common;
  status: typeof status;
  shell: typeof shell;
  auth: typeof auth;
  overview: typeof overview;
  appointments: typeof appointments;
  orders: typeof orders;
  clients: typeof clients;
  stats: typeof stats;
  services: typeof services;
  settings: typeof settings;
};

export type Namespace = keyof Messages;

/** Dot-paths to every string leaf of a message tree: "actions.save" | "title" | … */
export type MessageKey<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends readonly unknown[]
      ? never
      : T[K] extends object
        ? `${K}.${MessageKey<T[K]>}`
        : never;
}[keyof T & string];

type PluralSuffix = "zero" | "one" | "two" | "few" | "many" | "other";
/** "visits_one" | "visits_other" → "visits". */
export type PluralBase<K extends string> = K extends `${infer B}_${PluralSuffix}` ? B : never;

export type Vars = Record<string, string | number>;

export type Translator<NS extends Namespace> = {
  /** Plain lookup with `{{var}}` interpolation. */
  (key: MessageKey<Messages[NS]>, vars?: Vars): string;
  /** Plural lookup: picks `<key>_one|_few|_many|_other` for `count` (Intl.PluralRules) and sets `{{count}}`. */
  plural(key: PluralBase<MessageKey<Messages[NS]>>, count: number, vars?: Vars): string;
  /** True when the key exists (for data-driven keys, e.g. `status.${value}`). */
  has(key: string): boolean;
  /** Untyped lookup for keys built at runtime. Falls back to the key itself. */
  dynamic(key: string, vars?: Vars): string;
};
