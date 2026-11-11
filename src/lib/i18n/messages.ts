import "server-only";

import type { Locale } from "./config";
import type { Messages } from "./types";

import azAppointments from "./messages/az/appointments.json";
import azAuth from "./messages/az/auth.json";
import azClients from "./messages/az/clients.json";
import azCommon from "./messages/az/common.json";
import azOrders from "./messages/az/orders.json";
import azOverview from "./messages/az/overview.json";
import azServices from "./messages/az/services.json";
import azSettings from "./messages/az/settings.json";
import azShell from "./messages/az/shell.json";
import azStats from "./messages/az/stats.json";
import azStatus from "./messages/az/status.json";
import enAppointments from "./messages/en/appointments.json";
import enAuth from "./messages/en/auth.json";
import enClients from "./messages/en/clients.json";
import enCommon from "./messages/en/common.json";
import enOrders from "./messages/en/orders.json";
import enOverview from "./messages/en/overview.json";
import enServices from "./messages/en/services.json";
import enSettings from "./messages/en/settings.json";
import enShell from "./messages/en/shell.json";
import enStats from "./messages/en/stats.json";
import enStatus from "./messages/en/status.json";
import ruAppointments from "./messages/ru/appointments.json";
import ruAuth from "./messages/ru/auth.json";
import ruClients from "./messages/ru/clients.json";
import ruCommon from "./messages/ru/common.json";
import ruOrders from "./messages/ru/orders.json";
import ruOverview from "./messages/ru/overview.json";
import ruServices from "./messages/ru/services.json";
import ruSettings from "./messages/ru/settings.json";
import ruShell from "./messages/ru/shell.json";
import ruStats from "./messages/ru/stats.json";
import ruStatus from "./messages/ru/status.json";

/**
 * Every namespace for every locale. Typed as `Messages` (inferred from the az files), so a ru/en
 * file that is missing a key fails `tsc`. Server-only: the [locale] layout hands the current
 * locale's messages to the client <I18nProvider>, so client bundles never ship all 3 languages.
 */
const MESSAGES: Record<Locale, Messages> = {
  az: {
    common: azCommon,
    status: azStatus,
    shell: azShell,
    auth: azAuth,
    overview: azOverview,
    appointments: azAppointments,
    orders: azOrders,
    clients: azClients,
    stats: azStats,
    services: azServices,
    settings: azSettings,
  },
  ru: {
    common: ruCommon,
    status: ruStatus,
    shell: ruShell,
    auth: ruAuth,
    overview: ruOverview,
    appointments: ruAppointments,
    orders: ruOrders,
    clients: ruClients,
    stats: ruStats,
    services: ruServices,
    settings: ruSettings,
  },
  en: {
    common: enCommon,
    status: enStatus,
    shell: enShell,
    auth: enAuth,
    overview: enOverview,
    appointments: enAppointments,
    orders: enOrders,
    clients: enClients,
    stats: enStats,
    services: enServices,
    settings: enSettings,
  },
};

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}
