import type { Metadata } from "next";
import { Suspense } from "react";
import { AppPage } from "@/components/app/app-page";
import { RowsLoading } from "@/components/app/shell/page-skeletons";
import { Empty } from "@/design/empty";
import { ListGroup, ListRow, Pill } from "@/design/list";
import { PageHeader } from "@/design/page-header";
import { Section } from "@/design/rows";
import { requireMember } from "@/lib/auth/scope";
import { formatShortDate } from "@/lib/format";
import { USAGE_DAYS, readUsage } from "@/lib/usage/scoped";
import { configuredKeys } from "@/lib/ai/models";
import type { KeyDay } from "@/lib/usage/rules";

export const metadata: Metadata = { title: "AI usage" };

const BRANDS_SHOWN = 50;
const LOCALE = "en-US";
const n = (value: number) => value.toLocaleString(LOCALE);
/** "10:42 UTC": days and times are UTC, the clock the providers' daily limits run on. */
const utcTime = (iso: string) => `${new Date(iso).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" })} UTC`;

function keyDayDetail(d: KeyDay): string {
  const parts = [`${n(d.calls)} calls`];
  if (d.requestsLeft !== null) parts.push(`${n(d.requestsLeft)}${d.requestsLimit !== null ? ` of ${n(d.requestsLimit)}` : ""} requests left`);
  if (d.firstLimitAt) {
    parts.push(`limit at ${utcTime(d.firstLimitAt)} after ${n(d.tokensBeforeLimit ?? 0)} tokens${d.firstLimitKind ? ` (${d.firstLimitKind})` : ""}`);
  }
  return parts.join(" · ");
}

async function Usage() {
  const scope = await requireMember();
  const { keyDays, brands, perBrand, limitHits } = await readUsage(scope);
  // Every key this deployment has, used or not: a key added on Vercel shows here after the redeploy.
  const keys = configuredKeys();
  const calledToday = new Set(keyDays.filter((d) => d.day === keyDays[0]?.day).map((d) => d.provider));
  const keysSet = (
    <Section title="Keys set up" summary={`${keys.length} in the order they're tried`}>
      <ListGroup>
        {keys.length > 0 ? (
          keys.map((k, i) => (
            <ListRow key={k} first={i === 0} title={k} trailing={<span className="text-footnote text-label-secondary">{calledToday.has(k) ? "Used today" : "Not used today"}</span>} />
          ))
        ) : (
          <ListRow first title="No AI key is set up" />
        )}
      </ListGroup>
    </Section>
  );
  if (keyDays.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        {keysSet}
        <Empty icon="report" title={`No AI calls in the last ${USAGE_DAYS} days`} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {keysSet}
      <Section title="Per brand" summary={perBrand ? `Over ${n(perBrand.brands)} brands with an answer` : "No brand has an answer yet"}>
        {perBrand ? (
          <ListGroup>
            <ListRow first title="Tokens per brand, on average" trailing={<span className="text-callout tabular-nums">{n(perBrand.tokens)}</span>} />
            <ListRow title="AI calls per brand, on average" trailing={<span className="text-callout tabular-nums">{perBrand.calls}</span>} />
          </ListGroup>
        ) : null}
      </Section>

      <Section title="Keys by day" summary={`Last ${USAGE_DAYS} days, UTC`}>
        <ListGroup>
          {keyDays.map((d, i) => (
            <ListRow
              key={`${d.day}|${d.provider}`}
              first={i === 0}
              title={`${formatShortDate(`${d.day}T12:00:00Z`)} · ${d.provider}`}
              detail={keyDayDetail(d)}
              trailing={
                <span className="flex items-center gap-2">
                  {d.limitHits > 0 ? <Pill tone="red">Hit its limit</Pill> : null}
                  <span className="text-callout tabular-nums">{n(d.tokens)} tokens</span>
                </span>
              }
            />
          ))}
        </ListGroup>
      </Section>

      <Section title="Brands" summary={brands.length > BRANDS_SHOWN ? `The latest ${BRANDS_SHOWN} of ${n(brands.length)}` : `${n(brands.length)} researched`}>
        {brands.length > 0 ? (
          <ListGroup>
            {brands.slice(0, BRANDS_SHOWN).map((b, i) => (
              <ListRow
                key={b.brandId}
                first={i === 0}
                href={`/brands/${b.brandId}`}
                title={b.brandName}
                detail={`${formatShortDate(b.firstAt)} · ${n(b.calls)} calls`}
                trailing={
                  <span className="flex items-center gap-2">
                    {b.limitHits > 0 ? <Pill tone="orange">{b.limitHits === 1 ? "1 refused" : `${b.limitHits} refused`}</Pill> : null}
                    <span className="text-callout tabular-nums">{n(b.tokens)} tokens</span>
                  </span>
                }
              />
            ))}
          </ListGroup>
        ) : null}
      </Section>

      <Section title="Limit hits" summary={limitHits.length > 0 ? "Most recent first" : "None in this time"}>
        {limitHits.length > 0 ? (
          <ListGroup>
            {limitHits.map((h, i) => (
              <ListRow
                key={`${h.at}|${h.provider}|${i}`}
                first={i === 0}
                title={`${h.provider}${h.kind ? ` · ${h.kind}` : ""}`}
                detail={`${formatShortDate(h.at)}, ${utcTime(h.at)}${h.brandName ? ` · ${h.brandName}` : ""}`}
              />
            ))}
          </ListGroup>
        ) : null}
      </Section>
    </div>
  );
}

export default function UsagePage() {
  return (
    <AppPage>
      <PageHeader back={{ href: "/", label: "Batches" }} title="AI usage" />
      <Suspense fallback={<RowsLoading />}>
        <Usage />
      </Suspense>
    </AppPage>
  );
}
