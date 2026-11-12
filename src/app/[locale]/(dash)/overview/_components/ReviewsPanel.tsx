"use client";

import { ChevronDown, ChevronUp, CircleCheck, MessageSquareReply, Star } from "lucide-react";
import { useState } from "react";

import { AsyncView, Button, Dialog, EmptyState, Panel, Pill, Skeleton, Textarea, useToast } from "@/components/ui";
import { errorCode, useApiMutation, type QueryResult } from "@/lib/api/hooks";
import type { OverviewData, Review } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatFixed, formatNumber, formatRelative } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { useNow } from "./now";

const VISIBLE = 3;
/**
 * Stacked (phones, and the narrow 1280px+ column next to the charts) the newest two keep the page
 * short; the third only shows when the cards sit side by side (panel ≥ 36rem, tablets). "Show all (N)"
 * unfolds every latest review in place, so each one can still be read and answered (there is no
 * separate reviews page to link to).
 */
const STACKED_VISIBLE = 2;
const ONLY_SIDE_BY_SIDE = "@max-xl:hidden";
const TONES = ["bg-soft-mint", "bg-soft-peach", "bg-soft-lilac"] as const;

/** The latest reviews with a quick reply. Text on the soft fills is text-fg / text-fg-tertiary only. */
export function ReviewsPanel({ query, className }: { query: QueryResult<OverviewData>; className?: string }) {
  const t = useT("overview");
  const locale = useLocale();
  const [replying, setReplying] = useState<Review | null>(null);
  const [showAll, setShowAll] = useState(false);
  const partner = query.data?.partner;

  const rating =
    partner && partner.reviewsCount > 0 && query.data && query.data.latestReviews.length > 0 ? (
      <span className="inline-flex items-center gap-1 rounded-chip bg-surface-muted px-2.5 py-1 text-meta font-semibold text-fg">
        <span className="sr-only">{t.plural("reviews.average", partner.reviewsCount, { rating: formatFixed(partner.rating, 1, locale) })}</span>
        <Star aria-hidden="true" size={14} strokeWidth={1.8} className="fill-warning text-warning-text" />
        <span aria-hidden="true" className="tabular">
          {formatFixed(partner.rating, 1, locale)} <span className="font-normal text-fg-secondary">· {t.plural("reviews.count", partner.reviewsCount)}</span>
        </span>
      </span>
    ) : null;

  return (
    // No icon tile: in the 1280px+ row it sits next to the two charts (which have none), and without it the
    // rating fits on the title's row in the narrow column.
    <Panel title={t("reviews.title")} actions={rating} className={className} bodyClassName="@container">
      <AsyncView
        query={query}
        compact
        isEmpty={(data) => data.latestReviews.length === 0}
        loading={
          <div className="grid gap-2 @xl:grid-cols-3">
            {Array.from({ length: VISIBLE }, (_, i) => (
              <Skeleton key={i} className={cn("h-32 rounded-card", i >= STACKED_VISIBLE && ONLY_SIDE_BY_SIDE)} />
            ))}
          </div>
        }
        empty={<EmptyState compact pet="ginger" title={t("reviews.emptyTitle")} description={t("reviews.emptyBody")} />}
      >
        {(data) => {
          const count = data.latestReviews.length;
          const shown = showAll ? data.latestReviews : data.latestReviews.slice(0, VISIBLE);
          return (
            <>
              {/* Stacked in a narrow column or on phones; three across when the panel spans a tablet row. */}
              <ul className="grid gap-2 @xl:grid-cols-3">
                {shown.map((review, i) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    index={i}
                    className={!showAll && i >= STACKED_VISIBLE ? ONLY_SIDE_BY_SIDE : undefined}
                    onReply={() => setReplying(review)}
                  />
                ))}
              </ul>
              {count > STACKED_VISIBLE ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-expanded={showAll}
                  rightIcon={showAll ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                  onClick={() => setShowAll((v) => !v)}
                  // Side by side all three are already visible, so with three or fewer the toggle has nothing to unfold there.
                  className={cn("mt-1 text-fg-secondary", !showAll && count <= VISIBLE && "@xl:hidden")}
                >
                  {showAll ? t("schedule.showLess") : t("schedule.showAll", { count })}
                </Button>
              ) : null}
            </>
          );
        }}
      </AsyncView>
      {replying ? <ReplyDialog key={replying.id} review={replying} onClose={() => setReplying(null)} /> : null}
    </Panel>
  );
}

function Stars({ rating }: { rating: number }) {
  const t = useT("overview");
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="sr-only">{t("reviews.stars", { rating })}</span>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          aria-hidden="true"
          size={16}
          strokeWidth={1.8}
          className={i < rating ? "fill-warning text-warning-text" : "fill-transparent text-fg-tertiary/50"}
        />
      ))}
    </span>
  );
}

function ReviewCard({ review: r, index, className, onReply }: { review: Review; index: number; className?: string; onReply: () => void }) {
  const t = useT("overview");
  const locale = useLocale();
  const now = useNow(60_000);
  const about = [r.petName, r.serviceName].filter(Boolean).join(" · ");
  return (
    <li
      className={cn("flex animate-fade-up flex-col rounded-card p-3 transition-transform duration-200 hover:-translate-y-0.5", TONES[index % TONES.length], className)}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <Stars rating={r.rating} />
        {now !== null ? <span className="text-caption text-fg-tertiary">{formatRelative(r.createdAt, locale, new Date(now))}</span> : null}
      </div>
      <p title={r.text} className="mt-1.5 line-clamp-3 flex-1 text-body-sm text-fg">
        {r.text}
      </p>
      {/*
        Who and the reply button share one row while the name keeps at least 6.5rem (the 1280px+ column,
        phones); narrower cards (three across on tablets) put the button on its own line instead of
        cutting the name to a few letters.
      */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-[1_1_6.5rem]">
          <p title={r.clientName} className="truncate text-meta font-semibold text-fg">
            {r.clientName}
          </p>
          {about ? (
            <p title={about} className="truncate text-caption text-fg-tertiary">
              {about}
            </p>
          ) : null}
        </div>
        {r.reply ? (
          <Pill tone="success" size="sm" className="shrink-0" icon={<CircleCheck size={12} aria-hidden="true" />}>
            {t("reviews.replied")}
          </Pill>
        ) : (
          <Button size="sm" variant="outline" className="shrink-0" leftIcon={<MessageSquareReply size={16} aria-hidden="true" />} onClick={onReply}>
            {t("reviews.reply")}
          </Button>
        )}
      </div>
    </li>
  );
}

const REPLY_MAX = 600;

function ReplyDialog({ review, onClose }: { review: Review; onClose: () => void }) {
  const t = useT("overview");
  const locale = useLocale();
  const tc = useT("common");
  const { toast } = useToast();
  const [text, setText] = useState("");
  const reply = useApiMutation((api, id: string, body: string) => api.replyToReview(id, body), { invalidates: ["overview", "reviews"] });
  const send = async () => {
    if (!text.trim()) return;
    const result = await reply.mutate(review.id, text.trim());
    if (result) {
      toast({ title: t("reviews.sentTitle"), tone: "success" });
      onClose();
    }
  };
  return (
    <Dialog
      open
      onClose={reply.isPending ? () => {} : onClose}
      title={t("reviews.replyTitle", { client: review.clientName })}
      description={review.text}
      size="md"
      hideClose={reply.isPending}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={reply.isPending}>
            {tc("actions.cancel")}
          </Button>
          <Button onClick={send} loading={reply.isPending} disabled={!text.trim()}>
            {t("reviews.send")}
          </Button>
        </>
      }
    >
      <Textarea
        label={t("reviews.replyLabel")}
        hint={`${t("reviews.replyHint")} ${t("reviews.counter", { count: formatNumber(text.length, locale), max: formatNumber(REPLY_MAX, locale) })}`}
        rows={4}
        maxLength={REPLY_MAX}
        value={text}
        onChange={(e) => setText(e.target.value)}
        error={reply.error ? tc(`errors.${errorCode(reply.error)}`) : undefined}
      />
    </Dialog>
  );
}
