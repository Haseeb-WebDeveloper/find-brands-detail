import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppPage } from "@/components/app/app-page";
import { ResearchLog } from "@/components/app/research/research-log";
import { CampaignCards } from "@/components/app/research/campaign-cards";
import { PageHeader } from "@/design/page-header";
import { ListGroup, ListRow, Pill } from "@/design/list";
import { requireMember, scopeCan } from "@/lib/auth/scope";
import { brandTopic } from "@/lib/realtime/channels";
import { LiveRefresh } from "@/components/app/live-refresh";
import { RetryButton } from "./retry-button";
import { getBrandDetail } from "@/lib/brands/scoped";
import { progressText, progressTone } from "@/lib/brands/progress";
import { RowsLoading } from "@/components/app/shell/page-skeletons";

export const metadata: Metadata = { title: "Brand" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TONE = { proven: "green", review: "orange", rejected: "red" } as const;
const LABEL = { proven: "Proven", review: "Needs a look", rejected: "Rejected" } as const;

async function Brand({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, scope] = await Promise.all([params, requireMember()]);
  if (!UUID.test(id)) notFound();
  const brand = await getBrandDetail(scope, id);
  if (!brand) notFound();

  const live = brand.pages.filter((p) => p.source === "live");
  const archived = brand.pages.filter((p) => p.source === "archive");

  return (
    <>
      <PageHeader
        title={brand.name}
        back={{ href: `/batches/${brand.batchId}`, label: "Batch" }}
        actions={
          <div className="flex items-center gap-2">
            <Pill tone={progressTone(brand)}>{progressText(brand)}</Pill>
            {scopeCan(scope, "batches:write") && brand.status !== "queued" && brand.status !== "researching" ? (
              <RetryButton brandId={brand.id} />
            ) : null}
          </div>
        }
      />
      <LiveRefresh topic={brandTopic(brand.id)} />
      <div className="flex flex-col gap-8 pb-10">

      <section className="flex flex-col gap-2">
        <h2 className="text-headline text-label">Website</h2>
        {brand.website.candidates.length === 0 ? (
          <p className="text-callout text-label-secondary">No website checked yet.</p>
        ) : (
          <ListGroup>
            {brand.website.candidates.map((c, i) => (
              <ListRow
                key={c.id}
                first={i === 0}
                title={
                  <span className="flex items-center gap-2">
                    {c.id === brand.website.selectedCandidateId ? <Pill tone="blue">Chosen</Pill> : null}
                    <Link href={c.value} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                      {c.value.replace(/^https?:\/\//, "")}
                    </Link>
                  </span>
                }
                detail={`${c.reason} · ${c.source}${c.evidence.archivedAt ? ` · archive copy from ${String(c.evidence.archivedAt).slice(0, 4)}` : ""}`}
                trailing={<Pill tone={TONE[c.score]}>{LABEL[c.score]}</Pill>}
              />
            ))}
          </ListGroup>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-headline text-label">Instagram</h2>
        {brand.instagram.candidates.length === 0 ? (
          <p className="text-callout text-label-secondary">No Instagram account checked yet.</p>
        ) : (
          <ListGroup>
            {brand.instagram.candidates.map((c, i) => {
              const e = c.evidence as { followers?: number | null; name?: string | null; verified?: boolean | null; bioReached?: string | null };
              const facts = [
                e.name,
                typeof e.followers === "number" ? `${e.followers.toLocaleString("en-US")} followers` : null,
                e.verified === true ? "verified badge" : e.verified === false ? "no badge" : null,
                e.bioReached ? `bio reaches ${e.bioReached}` : null,
              ].filter(Boolean);
              return (
                <ListRow
                  key={c.id}
                  first={i === 0}
                  title={
                    <span className="flex items-center gap-2">
                      {c.id === brand.instagram.selectedCandidateId ? <Pill tone="blue">Chosen</Pill> : null}
                      <Link href={`https://www.instagram.com/${c.value}/`} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                        @{c.value}
                      </Link>
                    </span>
                  }
                  detail={`${c.reason} · ${c.source}${facts.length ? ` · ${facts.join(" · ")}` : ""}`}
                  trailing={<Pill tone={TONE[c.score]}>{LABEL[c.score]}</Pill>}
                />
              );
            })}
          </ListGroup>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-headline text-label">TikTok</h2>
        {brand.tiktok.candidates.length === 0 ? (
          <p className="text-callout text-label-secondary">No TikTok account checked yet.</p>
        ) : (
          <ListGroup>
            {brand.tiktok.candidates.map((c, i) => {
              const e = c.evidence as {
                followers?: number | null;
                name?: string | null;
                verified?: boolean | null;
                private?: boolean | null;
                bioReached?: string | null;
                sameBioAsInstagram?: boolean;
              };
              const facts = [
                e.name,
                typeof e.followers === "number" ? `${e.followers.toLocaleString("en-US")} followers` : null,
                e.verified === true ? "verified badge" : e.verified === false ? "no badge" : null,
                e.private ? "private account" : null,
                e.bioReached ? `bio reaches ${e.bioReached}` : e.sameBioAsInstagram ? "same bio link as Instagram" : null,
              ].filter(Boolean);
              return (
                <ListRow
                  key={c.id}
                  first={i === 0}
                  title={
                    <span className="flex items-center gap-2">
                      {c.id === brand.tiktok.selectedCandidateId ? <Pill tone="blue">Chosen</Pill> : null}
                      <Link href={`https://www.tiktok.com/@${c.value}`} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                        @{c.value}
                      </Link>
                    </span>
                  }
                  detail={`${c.reason} · ${c.source}${facts.length ? ` · ${facts.join(" · ")}` : ""}`}
                  trailing={<Pill tone={TONE[c.score]}>{LABEL[c.score]}</Pill>}
                />
              );
            })}
          </ListGroup>
        )}
      </section>

      {(["logo", "cover"] as const).map((field) => (
        <section key={field} className="flex flex-col gap-2">
          <h2 className="text-headline text-label">{field === "logo" ? "Logo" : "Cover"}</h2>
          {brand[field].candidates.length === 0 ? (
            <p className="text-callout text-label-secondary">No {field} image checked yet.</p>
          ) : (
            <ListGroup>
              {brand[field].candidates.map((c, i) => (
                <ListRow
                  key={c.id}
                  first={i === 0}
                  icon={
                    // A remote image at its own address: the reviewer sees exactly what will be exported.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.value}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className={field === "logo" ? "size-10 shrink-0 rounded-lg bg-fill object-cover" : "h-10 w-[3.6rem] shrink-0 rounded-lg bg-fill object-cover"}
                    />
                  }
                  title={
                    <span className="flex items-center gap-2">
                      {c.id === brand[field].selectedCandidateId ? <Pill tone="blue">Chosen</Pill> : null}
                      <Link href={c.value} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                        {c.source}
                      </Link>
                    </span>
                  }
                  detail={c.reason}
                  trailing={<Pill tone={TONE[c.score]}>{LABEL[c.score]}</Pill>}
                />
              ))}
            </ListGroup>
          )}
        </section>
      ))}

      <section className="flex flex-col gap-2">
        <h2 className="text-headline text-label">Campaigns</h2>
        <CampaignCards campaigns={brand.campaigns} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-headline text-label">Pages read</h2>
        <ListGroup>
          <ListRow first title="Brand sites" detail={`${live.length} live${archived.length ? `, ${archived.length} from the Wayback Machine` : ""}`} />
        </ListGroup>
      </section>

      <ResearchLog lines={brand.log} live={brand.status === "queued" || brand.status === "researching"} />
      </div>
    </>
  );
}

export default function BrandPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AppPage>
      <Suspense fallback={<RowsLoading count={5} />}>
        <Brand params={params} />
      </Suspense>
    </AppPage>
  );
}
