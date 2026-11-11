"use client";

import { CircleCheck, MessageSquareReply, Star } from "lucide-react";
import { useState } from "react";

import { AsyncView, Button, Dialog, EmptyState, Panel, Pill, Skeleton, Textarea, useToast } from "@/components/ui";
import { errorCode, useApiMutation, type QueryResult } from "@/lib/api/hooks";
import type { OverviewData, Review } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatFixed, formatNumber, formatRelative } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { useNow } from "./now";

const VISIBLE = 3;
const TONES = ["bg-soft-mint", "bg-soft-peach", "bg-soft-lilac"] as const;

/** The latest reviews with a quick reply. Text on the soft fills is text-fg / text-fg-tertiary only. */
export function ReviewsPanel({ query, className }: { query: QueryResult<OverviewData>; className?: string }) {
  const t = useT("overview");
  const locale = useLocale();
  const [replying, setReplying] = useState<Review | null>(null);
  const partner = query.data?.partner;

  return (
    <Panel
      title={t("reviews.title")}
      description={
        partner && partner.reviewsCount > 0 && query.data && query.data.latestReviews.length > 0
          ? t.plural("reviews.average", partner.reviewsCount, { rating: formatFixed(partner.rating, 1, locale) })
          : undefined
      }
      icon={<Star size={20} />}
      className={className}
    >
      <AsyncView
        query={query}
        compact
        isEmpty={(data) => data.latestReviews.length === 0}
        loading={
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: VISIBLE }, (_, i) => (
              <Skeleton key={i} className="h-40 rounded-card" />
            ))}
          </div>
        }
        empty={<EmptyState compact pet="ginger" title={t("reviews.emptyTitle")} description={t("reviews.emptyBody")} />}
      >
        {(data) => (
          <ul className="grid gap-3 md:grid-cols-3">
            {data.latestReviews.slice(0, VISIBLE).map((review, i) => (
              <ReviewCard key={review.id} review={review} index={i} onReply={() => setReplying(review)} />
            ))}
          </ul>
        )}
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

function ReviewCard({ review: r, index, onReply }: { review: Review; index: number; onReply: () => void }) {
  const t = useT("overview");
  const locale = useLocale();
  const now = useNow(60_000);
  const about = [r.petName, r.serviceName].filter(Boolean).join(" · ");
  return (
    <li
      className={cn("flex animate-fade-up flex-col rounded-card p-4 transition-transform duration-200 hover:-translate-y-0.5", TONES[index % TONES.length])}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <Stars rating={r.rating} />
        {now !== null ? <span className="text-caption text-fg-tertiary">{formatRelative(r.createdAt, locale, new Date(now))}</span> : null}
      </div>
      <p className="mt-2 line-clamp-4 flex-1 text-body-sm text-fg">{r.text}</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-meta font-semibold text-fg">{r.clientName}</p>
          {about ? <p className="truncate text-caption text-fg-tertiary">{about}</p> : null}
        </div>
        {r.reply ? (
          <Pill tone="success" size="sm" icon={<CircleCheck size={12} aria-hidden="true" />}>
            {t("reviews.replied")}
          </Pill>
        ) : (
          <Button size="sm" variant="outline" leftIcon={<MessageSquareReply size={16} aria-hidden="true" />} onClick={onReply}>
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
