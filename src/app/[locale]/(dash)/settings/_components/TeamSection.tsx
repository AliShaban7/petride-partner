"use client";

import { Crown, MailPlus, MoreHorizontal, RotateCw, ShieldCheck, Trash2, UserPlus, UsersRound } from "lucide-react";
import { useId, useRef, useState } from "react";

import { EMAIL_RE, extrasApi, useExtras, useExtrasMutation, useMinuteNow, type TeamMember, type TeamRole } from "@/components/services-settings";
import {
  Avatar,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  Menu,
  Panel,
  Pill,
  ResponsiveTable,
  Select,
  SkeletonRows,
  useToast,
  type Column,
} from "@/components/ui";
import { ApiError } from "@/lib/api/types";
import { errorCode } from "@/lib/api/hooks";
import { formatRelative } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { ChoiceCard } from "./shared";

const ROLES: TeamRole[] = ["owner", "manager", "staff"];
type InviteRole = Exclude<TeamRole, "owner">;

/** Team members with roles; invite by e-mail (mock), change role, resend or cancel invites, remove. */
export function TeamSection() {
  const t = useT("settings");
  const tc = useT("common");
  const locale = useLocale();
  const { toast } = useToast();
  const extrasQ = useExtras();
  const now = useMinuteNow();
  const [inviteOpen, setInviteOpen] = useState(false);
  // The target stays set while the dialog closes, so its title doesn't flip mid-animation.
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);

  const changeRole = useExtrasMutation((partnerId, id: string, role: InviteRole) => extrasApi.updateMemberRole(partnerId, id, role));
  const remove = useExtrasMutation((partnerId, id: string) => extrasApi.removeMember(partnerId, id));
  const resend = useExtrasMutation((partnerId, id: string) => extrasApi.resendInvite(partnerId, id));

  const onRole = async (member: TeamMember, role: InviteRole) => {
    const previous = member.role as InviteRole;
    try {
      await changeRole.mutateAsync(member.id, role);
    } catch (err) {
      toast({ tone: "error", title: t("team.toast.failed"), description: tc.dynamic(`errors.${errorCode(err)}`) });
      return;
    }
    toast({
      title: t("team.toast.roleChanged", { name: member.name || member.email, role: t(`team.roles.${role}.title`) }),
      action: { label: t("team.undo"), onClick: () => void changeRole.mutate(member.id, previous) },
    });
  };

  const onRemove = async () => {
    const target = removeTarget;
    if (!target) return;
    try {
      await remove.mutateAsync(target.id);
      setRemoveOpen(false);
      toast({ title: target.status === "invited" ? t("team.toast.inviteCancelled", { email: target.email }) : t("team.toast.removed", { name: target.name || target.email }) });
    } catch (err) {
      toast({ tone: "error", title: t("team.toast.failed"), description: tc.dynamic(`errors.${errorCode(err)}`) });
    }
  };

  const onResend = async (member: TeamMember) => {
    const ok = await resend.mutate(member.id);
    toast(ok ? { title: t("team.toast.resent", { email: member.email }), description: t("team.demoNote") } : { tone: "error", title: t("team.toast.failed") });
  };

  const columns: Column<TeamMember>[] = [
    {
      id: "member",
      header: t("team.columns.member"),
      rowHeader: true,
      mobile: "title",
      cell: (m) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={m.name || m.email} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-fg">
              {m.name || m.email}
              {m.isYou ? <span className="font-normal text-fg-secondary"> · {t("team.you")}</span> : null}
            </span>
            <span className="block truncate text-meta font-normal text-fg-secondary">{m.email}</span>
          </span>
        </span>
      ),
    },
    {
      id: "role",
      header: t("team.columns.role"),
      mobile: "meta",
      cell: (m) =>
        m.role === "owner" ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-fg">
            <Crown aria-hidden="true" size={14} />
            {t("team.roles.owner.title")}
          </span>
        ) : (
          <Select
            label={t("team.roleFor", { name: m.name || m.email })}
            hideLabel
            value={m.role}
            disabled={changeRole.isPending}
            onChange={(e) => onRole(m, e.target.value as InviteRole)}
            options={(["manager", "staff"] as const).map((r) => ({ value: r, label: t(`team.roles.${r}.title`) }))}
            wrapperClassName="min-w-[9.5rem]"
          />
        ),
    },
    {
      id: "status",
      header: t("team.columns.status"),
      mobile: "badge",
      cell: (m) => (m.status === "active" ? <Pill tone="success">{t("team.status.active")}</Pill> : <Pill tone="warning">{t("team.status.invited")}</Pill>),
    },
    {
      id: "activity",
      header: t("team.columns.activity"),
      mobile: "meta",
      cell: (m) => (
        <span className="text-fg-secondary">
          {!now
            ? "…"
            : m.isYou
              ? t("team.activeNow")
              : m.status === "invited" && m.invitedAt
                ? t("team.invitedAgo", { time: formatRelative(m.invitedAt, locale, now) })
                : m.lastActiveAt
                  ? formatRelative(m.lastActiveAt, locale, now)
                  : "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("team.columns.actions"),
      align: "end",
      mobile: "footer",
      className: "w-16",
      cell: (m) =>
        m.role === "owner" ? null : (
          <Menu
            label={t("team.actions", { name: m.name || m.email })}
            items={[
              ...(m.status === "invited"
                ? [{ id: "resend", label: t("team.resend"), icon: <RotateCw aria-hidden="true" size={16} />, onSelect: () => void onResend(m) }]
                : []),
              {
                id: "remove",
                label: m.status === "invited" ? t("team.cancelInvite") : t("team.remove"),
                icon: <Trash2 aria-hidden="true" size={16} />,
                tone: "danger" as const,
                onSelect: () => {
                  setRemoveTarget(m);
                  setRemoveOpen(true);
                },
              },
            ]}
            trigger={(props) => <IconButton {...props} label={t("team.actions", { name: m.name || m.email })} icon={<MoreHorizontal size={20} />} />}
          />
        ),
    },
  ];

  return (
    <div className="space-y-section">
      <Panel
        title={t("team.title")}
        description={t("team.description")}
        icon={<UsersRound size={20} />}
        actions={
          <Button leftIcon={<UserPlus aria-hidden="true" size={18} />} onClick={() => setInviteOpen(true)} disabled={!extrasQ.data}>
            {t("team.invite")}
          </Button>
        }
      >
        {extrasQ.data === undefined ? (
          extrasQ.error ? (
            <ErrorState error={extrasQ.error} onRetry={extrasQ.refetch} compact />
          ) : (
            <div aria-busy="true">
              <span className="sr-only">{tc("states.loading")}</span>
              <SkeletonRows rows={3} />
            </div>
          )
        ) : (
          <>
            <ResponsiveTable caption={t("team.caption")} columns={columns} rows={extrasQ.data.team} getRowId={(m) => m.id} />
            {extrasQ.data.team.length <= 1 ? (
              <EmptyState
                compact
                pet="golden"
                title={t("team.aloneTitle")}
                description={t("team.aloneBody")}
                action={
                  <Button variant="secondary" size="sm" leftIcon={<MailPlus aria-hidden="true" size={16} />} onClick={() => setInviteOpen(true)}>
                    {t("team.invite")}
                  </Button>
                }
              />
            ) : null}
          </>
        )}
      </Panel>

      <Panel title={t("team.rolesTitle")} description={t("team.rolesDescription")} icon={<ShieldCheck size={20} />}>
        <ul className="grid gap-3 md:grid-cols-3">
          {ROLES.map((role, i) => (
            <li key={role} className="animate-fade-up rounded-card bg-surface-muted p-4" style={{ animationDelay: `${i * 60}ms` }}>
              <p className="flex items-center gap-2 font-semibold text-fg">
                {role === "owner" ? <Crown aria-hidden="true" size={16} /> : null}
                {t(`team.roles.${role}.title`)}
              </p>
              <p className="mt-1 text-meta text-fg-secondary">{t(`team.roles.${role}.body`)}</p>
            </li>
          ))}
        </ul>
      </Panel>

      {inviteOpen && extrasQ.data ? <InviteDialog team={extrasQ.data.team} onClose={() => setInviteOpen(false)} /> : null}

      <ConfirmDialog
        open={removeOpen && removeTarget !== null}
        onClose={() => setRemoveOpen(false)}
        onConfirm={onRemove}
        tone="danger"
        loading={remove.isPending}
        title={
          removeTarget?.status === "invited"
            ? t("team.cancelTitle", { email: removeTarget.email })
            : t("team.removeTitle", { name: removeTarget?.name || removeTarget?.email || "" })
        }
        description={removeTarget?.status === "invited" ? t("team.cancelBody") : t("team.removeBody")}
        confirmLabel={removeTarget?.status === "invited" ? t("team.cancelInvite") : t("team.remove")}
      />
    </div>
  );
}

function InviteDialog({ team, onClose }: { team: TeamMember[]; onClose: () => void }) {
  const t = useT("settings");
  const tc = useT("common");
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<InviteRole>("staff");
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const invite = useExtrasMutation((partnerId, input: { email: string; name: string; role: InviteRole }) => extrasApi.inviteMember(partnerId, input));

  const submit = async () => {
    const value = email.trim().toLowerCase();
    const problem = !EMAIL_RE.test(value)
      ? t("team.errors.email")
      : team.some((m) => m.email.toLowerCase() === value)
        ? t("team.errors.duplicate")
        : null;
    setError(problem);
    if (problem) {
      emailRef.current?.focus();
      return;
    }
    try {
      await invite.mutateAsync({ email: value, name, role });
      toast({ title: t("team.toast.invited", { email: value }), description: t("team.demoNote") });
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === "conflict") setError(t("team.errors.duplicate"));
      else toast({ tone: "error", title: t("team.toast.failed"), description: tc.dynamic(`errors.${errorCode(err)}`) });
    }
  };

  return (
    <Dialog
      open
      onClose={invite.isPending ? () => {} : onClose}
      hideClose={invite.isPending}
      initialFocusRef={emailRef}
      title={t("team.inviteTitle")}
      description={t("team.inviteDescription")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={invite.isPending}>
            {tc("actions.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={invite.isPending} leftIcon={<MailPlus aria-hidden="true" size={18} />}>
            {t("team.sendInvite")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="space-y-5 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input
          ref={emailRef}
          label={t("team.email")}
          type="email"
          autoComplete="off"
          required
          value={email}
          error={error ?? undefined}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input label={t("team.name")} hint={t("team.nameHint")} value={name} maxLength={60} autoComplete="off" onChange={(e) => setName(e.target.value)} />
        <fieldset className="space-y-2">
          <legend className="mb-2 text-body-sm font-semibold text-fg">{t("team.columns.role")}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["manager", "staff"] as const).map((r) => (
              <ChoiceCard key={r} checked={role === r}>
                <label className="flex w-full cursor-pointer items-start gap-3">
                  <input
                    type="radio"
                    name={`${formId}-role`}
                    value={r}
                    checked={role === r}
                    onChange={() => setRole(r)}
                    className="mt-1 size-4 shrink-0 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-fg">{t(`team.roles.${r}.title`)}</span>
                    <span className="mt-0.5 block text-meta text-fg-secondary">{t(`team.roles.${r}.body`)}</span>
                  </span>
                </label>
              </ChoiceCard>
            ))}
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
