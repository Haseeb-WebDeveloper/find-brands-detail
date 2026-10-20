import { Skeleton } from "@/components/ui/skeleton";
import { DesignPage } from "@/design/page";
import { PageHeader } from "@/design/page-header";

/**
 * What a screen looks like in the moment before its data exists, after contractor-sites'
 * `components/app/shell/page-skeletons.tsx`. Every screen has TWO loading states and they must be
 * the same shape: `loading.tsx` (what a click shows) and the page's `<Suspense fallback>` (what a
 * reload shows). One definition, imported by both.
 *
 * 1. IF WE ALREADY KNOW IT, PRINT IT. A page title is not a query; only the values wait.
 * 2. TAKE THE GEOMETRY FROM THE REAL COMPONENT. These render the same `DesignPage` and `PageHeader`
 *    the real pages do, so the title lands where it will stay.
 */

/**
 * A stack of bars that fades towards the bottom. Six identical grey bars read as a broken table; a
 * stack that dims reads as "there is more below this".
 */
function FadingRows({ count = 6, step = 0.13 }: { count?: number; step?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full rounded-field" style={{ opacity: 1 - i * step }} />
      ))}
    </div>
  );
}

/**
 * Just the rows, for a `<Suspense fallback>` INSIDE a page that has already drawn its own
 * `DesignPage` and `PageHeader` — wrapping those twice would draw a second title.
 */
export function RowsLoading({ count = 6 }: { count?: number }) {
  return <FadingRows count={count} />;
}

/** A whole list screen: its real title, then rows. For `loading.tsx`. */
export function ListPageLoading({ title }: { title: string }) {
  return (
    <DesignPage>
      <PageHeader title={title} />
      <FadingRows />
    </DesignPage>
  );
}

/** A detail screen whose title depends on the record: a grey title, then rows. */
export function DetailPageLoading() {
  return (
    <DesignPage>
      <PageHeader title={<Skeleton className="inline-block h-[1em] w-56 rounded-sm align-text-bottom" />} />
      <FadingRows count={5} step={0.16} />
    </DesignPage>
  );
}
