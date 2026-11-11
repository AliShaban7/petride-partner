"use client";

import { ArrowRight } from "lucide-react";

import { AsyncView, Avatar, ButtonLink, Drawer, SkeletonRows, SkeletonText, StatusPill } from "@/components/ui";
import { useApiQuery } from "@/lib/api/hooks";
import { formatDate, formatMoney, formatNumber, formatPhone, formatTime, phoneHref } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { ROUTES, localizedHref } from "@/lib/i18n/navigation";

import type { DirectoryMode } from "../_lib/directory";
import { useNow } from "../_lib/stores";
import { CallLink, PetLinkRow, SourcePill } from "./bits";

/**
 * Quick look at an owner (opened by `/clients?id=<clientId>` from notifications): contact, pets and
 * the latest visits, with a link to the full profile.
 */
export function OwnerQuickView({ clientId, mode, onClose, linkQuery }: { clientId: string | null; mode: DirectoryMode; onClose: () => void; linkQuery: Record<string, string> }) {
  const t = useT("clients");
  const tc = useT("common");
  const locale = useLocale();
  const now = useNow();
  const query = useApiQuery(["clients", clientId], (api) => api.getClient(clientId ?? ""), { enabled: Boolean(clientId) });
  const name = query.data?.client.fullName;
  return (
    <Drawer
      open={Boolean(clientId)}
      onClose={onClose}
      title={name ?? t("quickView.title")}
      description={query.data ? query.data.client.area : undefined}
      size="md"
      footer={
        query.data ? (
          <>
            <CallLink phone={query.data.client.phone} label={tc("actions.call")} variant="ghost" />
            <ButtonLink
              href={localizedHref(locale, `${ROUTES.clients}/owners/${query.data.client.id}`, linkQuery)}
              rightIcon={<ArrowRight aria-hidden="true" size={18} />}
            >
              {t("quickView.openProfile")}
            </ButtonLink>
          </>
        ) : undefined
      }
    >
      <AsyncView
        query={query}
        loading={
          <div className="space-y-5">
            <SkeletonText lines={2} />
            <SkeletonRows rows={3} />
          </div>
        }
      >
        {({ client, pets, appointments, orders }) => {
          const today = new Date(now);
          return (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar name={client.fullName} size="lg" />
                <div className="min-w-0 space-y-1">
                  <a href={phoneHref(client.phone)} className="block font-semibold tabular text-fg underline-offset-4 hover:underline">
                    {formatPhone(client.phone)}
                  </a>
                  <div className="flex flex-wrap items-center gap-2">
                    <SourcePill source={client.source} />
                    <StatusPill kind="health" status={client.vaccineAlert} size="sm" />
                  </div>
                </div>
              </div>

              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: mode === "visits" ? t("owners.visits") : t("owners.orders"), value: formatNumber(mode === "visits" ? client.visitsCount : client.ordersCount, locale) },
                  { label: t("owners.spent"), value: formatMoney(client.totalSpentAZN, locale, { decimals: 0 }) },
                  { label: mode === "visits" ? t("owners.lastVisit") : t("owners.lastOrder"), value: client.lastVisitAt ? formatDate(client.lastVisitAt, locale, today) : "—" },
                ].map((item) => (
                  <div key={item.label} className="rounded-card bg-surface-muted px-2 py-3">
                    <dt className="text-caption text-fg-secondary">{item.label}</dt>
                    <dd className="mt-1 font-display text-title font-extrabold tabular">{item.value}</dd>
                  </div>
                ))}
              </dl>

              <section aria-labelledby="qv-pets">
                <h3 id="qv-pets" className="mb-2 font-display text-title font-extrabold">
                  {t.plural("owner.petsCount", pets.length)}
                </h3>
                <ul className="space-y-2">
                  {pets.map((pet) => (
                    <li key={pet.id}>
                      <PetLinkRow pet={pet} href={localizedHref(locale, `${ROUTES.clients}/pets/${pet.id}`, linkQuery)} now={now} />
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="qv-recent">
                <h3 id="qv-recent" className="mb-2 font-display text-title font-extrabold">
                  {mode === "visits" ? t("quickView.recentVisits") : t("quickView.recentOrders")}
                </h3>
                {mode === "visits" ? (
                  appointments.length ? (
                    <ul className="divide-y divide-border">
                      {appointments.slice(0, 4).map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                          <span className="min-w-0">
                            <span className="block truncate text-body-sm font-semibold">
                              {a.petName} · {a.serviceName}
                            </span>
                            <span className="block text-meta text-fg-secondary">
                              {formatDate(a.start, locale, today)}, {formatTime(a.start)}
                            </span>
                          </span>
                          <StatusPill kind="appointment" status={a.status} size="sm" />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-body-sm text-fg-secondary">{t("owner.noVisits")}</p>
                  )
                ) : orders.length ? (
                  <ul className="divide-y divide-border">
                    {orders.slice(0, 4).map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="min-w-0">
                          <span className="block truncate text-body-sm font-semibold">
                            {o.code} · {formatMoney(o.totalAZN, locale)}
                          </span>
                          <span className="block text-meta text-fg-secondary">{formatDate(o.createdAt, locale, today)}</span>
                        </span>
                        <StatusPill kind="order" status={o.status} size="sm" />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-body-sm text-fg-secondary">{t("owner.noOrders")}</p>
                )}
              </section>
            </div>
          );
        }}
      </AsyncView>
    </Drawer>
  );
}
