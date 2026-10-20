"use client";

import { Reorder, useDragControls } from "motion/react";
import Link from "next/link";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { Checkbox } from "./checkbox";
import { cn } from "./cn";
import { Icon } from "./icon";
import { motionPresets } from "./motion";
import { usePhone } from "./use-media";

/**
 * THE TABLE: many records of one kind, compared across columns (docs/DESIGN-LANGUAGE.md 9).
 *
 *   EDGE TO EDGE, NOT A CARD (owner, 2026-10-13: a card with its own scrolling read as a
 *             third thing between the sidebar and the page). The rows sit straight on the page, their
 *             hairlines run from the sidebar to the window's edge, and the first column's words line up
 *             with the page title. The last column takes whatever width is left, so on a normal screen
 *             nothing scrolls sideways; on a narrow one the rows scroll sideways and the header follows.
 *             A quiet header row STAYS IN VIEW under the page's bar while the rows scroll.
 *
 * THE SAME TABLE ON A PHONE (owner, 2026-10-13, on trial): the first column (at its `phoneWidth`) and
 * as many others as fit, the rest a sideways slide away, tick boxes and all; no drag grips.
 * Nothing is pinned while it slides: a frozen name column was tried and took half a phone's width
 * (owner, 2026-10-13). Two lists were tried first and neither was
 * wanted; if the table does not hold up on a phone, the next step is cards, not a list.
 *
 * What the table does NOT do, by the owner's choice (2026-10-13): drag a column edge to resize it,
 * or move between cells with the arrow keys. Rows and every control in them are still reachable by
 * Tab, and the record's name is a link.
 *
 * Sorting is LINKS, not state: the page sorts on the server, the URL holds the sort, and a sorted
 * view can be bookmarked or sent. A column without a `sortHref` does not sort and does not pretend to.
 *
 * Selection belongs to the caller (which rows, and what can be done to them); the table only draws
 * the boxes. Reordering is offered only when the caller passes `reorder`, which is its claim that the
 * order on screen is a manual one; under a sort the grips are absent, not greyed.
 */

export type TableColumn<T> = {
  key: string;
  label: string;
  /** Pixels. Fixed: columns do not resize. */
  width: number;
  /** Narrower on a phone, so the first column leaves room for the next one to show. */
  phoneWidth?: number;
  /** Takes whatever width is left (a task name). Without one, the last column does. */
  grow?: boolean;
  align?: "start" | "end";
  /** Where pressing the header goes to sort by this column. Absent: it does not sort. */
  sortHref?: string;
  cell: (row: T) => ReactNode;
};

export function DataTable<T>({
  label,
  rows,
  rowKey,
  columns,
  sorted,
  selection,
  reorder: reorderProp,
  footer,
}: {
  /** What the table is, for screen readers ("Jobs"). */
  label: string;
  rows: T[];
  rowKey: (row: T) => string;
  columns: TableColumn<T>[];
  /** Which column the rows are sorted by, to draw its arrow. */
  sorted?: { key: string; dir: "asc" | "desc" };
  selection?: { selected: string[]; onChange: (ids: string[]) => void };
  reorder?: { onReorder: (ids: string[]) => void };
  footer?: ReactNode;
}) {
  const header = useRef<HTMLDivElement>(null);
  const phone = usePhone();
  const inset = useContext(InsetContext);
  const rowEdge = inset ? "px-0" : ROW_EDGE;
  // No grips on a phone: a row dragged inside a table that also slides sideways fights the finger,
  // and the grip's 28px is a column of the phone's narrow width spent on it.
  const reorder = phone ? undefined : reorderProp;
  const widthOf = (column: TableColumn<T>) => (phone && column.phoneWidth) || column.width;
  const ids = rows.map(rowKey);
  const byId = new Map(rows.map((row) => [rowKey(row), row]));

  // While a row is being dragged the order on screen is ours; the server's comes back on the next render.
  const [order, setOrder] = useState(ids);
  const idsKey = ids.join(",");
  // When the server's rows change, adopt their order. Adjusted during render rather than in an
  // effect (React's "adjusting state when a prop changes"), which avoids a second render pass.
  const [orderKey, setOrderKey] = useState(idsKey);
  if (orderKey !== idsKey) {
    setOrderKey(idsKey);
    setOrder(idsKey ? idsKey.split(",") : []);
  }
  const shown = reorder ? order.filter((id) => byId.has(id)) : ids;

  const template = [
    selection ? "40px" : null,
    reorder ? "28px" : null,
    ...columns.map((column, i) =>
      (columns.some((c) => c.grow) ? column.grow : i === columns.length - 1) ? `minmax(${widthOf(column)}px, 1fr)` : `${widthOf(column)}px`,
    ),
  ]
    .filter(Boolean)
    .join(" ");
  const minWidth =
    columns.reduce((sum, column) => sum + widthOf(column), 0) + (selection ? 40 : 0) + (reorder ? 28 : 0) + (inset ? 0 : 2 * EDGE);

  const selected = selection?.selected.filter((id) => ids.includes(id)) ?? [];
  const all = ids.length > 0 && selected.length === ids.length;

  const toggle = (id: string, on: boolean) =>
    selection?.onChange(on ? [...selection.selected, id] : selection.selected.filter((x) => x !== id));

  return (
    // Out to the page column's edges (it pads 16px on a phone, 32px on a desktop). `overflow-clip`, not hidden: hidden would make
    // this a scroll container and stop the header row sticking to the page.
    <div role="table" aria-label={label} className={cn("overflow-clip", inset ? "-mx-3" : "-mx-4 md:-mx-8")}>
      {/* THE HEADER STAYS IN VIEW under the page's 64px header row. It sits outside the sideways scroller so
          it can stick, and follows that scroller's position instead. */}
      <div ref={header} className="sticky top-16 z-10 overflow-hidden border-y border-separator bg-(--ds-ground)">
        <div role="row" className={cn("grid h-9 items-center", rowEdge)} style={{ gridTemplateColumns: template, minWidth }}>
          {selection ? (
            <div className="flex justify-center">
              <Checkbox
                label={all ? "Clear the selection" : "Select every row"}
                checked={all}
                indeterminate={selected.length > 0 && !all}
                onCheckedChange={(on) => selection.onChange(on ? ids : [])}
              />
            </div>
          ) : null}
          {reorder ? <span /> : null}
          {columns.map((column) => (
            <HeaderCell key={column.key} column={column} sorted={sorted} />
          ))}
        </div>
      </div>

      <div
        // Sideways only. Without `overflow-y-hidden` the browser makes this a scroller in both
        // directions and draws a vertical bar for a pixel of overflow (owner's screen, 2026-10-13).
        className="overflow-x-auto overflow-y-hidden"
        onScroll={(event) => {
          if (header.current) header.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
      >
        {/* A line under the last row too, so the table ends rather than trailing off (owner, 2026-10-15). */}
        <div style={{ minWidth }} className={cn(rows.length > 0 && !footer && "border-b border-separator")}>
          {reorder ? (
            <Reorder.Group
              as="div"
              axis="y"
              values={shown}
              onReorder={setOrder}
              role="rowgroup"
            >
              {shown.map((id, i) => (
                <DraggableRow
                  key={id}
                  id={id}
                  first={i === 0}
                  template={template}
                  edge={rowEdge}
                  onDrop={() => reorder.onReorder(order)}
                  selected={selected.includes(id)}
                  selection={selection ? (on) => toggle(id, on) : undefined}
                >
                  {columns.map((column) => (
                    <Cell key={column.key} column={column}>
                      {column.cell(byId.get(id)!)}
                    </Cell>
                  ))}
                </DraggableRow>
              ))}
            </Reorder.Group>
          ) : (
            <div role="rowgroup">
              {shown.map((id, i) => (
                <div
                  key={id}
                  role="row"
                  className={cn(
                    "grid min-h-(--ds-row) items-center",
                    rowEdge,
                    i > 0 && "border-t border-separator",
                    selected.includes(id) && "bg-[color-mix(in_oklab,var(--ds-tint)_8%,transparent)]",
                  )}
                  style={{ gridTemplateColumns: template }}
                >
                  {selection ? (
                    <div className="flex justify-center">
                      <Checkbox
                        label="Select this row"
                        checked={selected.includes(id)}
                        onCheckedChange={(on) => toggle(id, on)}
                      />
                    </div>
                  ) : null}
                  {columns.map((column) => (
                    <Cell key={column.key} column={column}>
                      {column.cell(byId.get(id)!)}
                    </Cell>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {footer ? <div className={cn("border-y border-separator", rowEdge)}>{footer}</div> : null}
    </div>
  );
}

/** The page's side padding (16 / 32) less a cell's own 12px, so a row's words line up with the page title. */
const EDGE = 20;
const ROW_EDGE = "px-1 md:px-5";

/**
 * TABLES INSIDE A RECORD (a job, a lead, a customer) sit in the column beside the details, so they
 * stop at that column instead of running out to the page edge and touching the details card (owner,
 * 2026-10-15). The page wraps its tab content in this; a list screen does not.
 */
const InsetContext = createContext(false);
export function InsetTables({ children }: { children: ReactNode }) {
  return <InsetContext.Provider value>{children}</InsetContext.Provider>;
}

function HeaderCell<T>({ column, sorted }: { column: TableColumn<T>; sorted?: { key: string; dir: "asc" | "desc" } }) {
  const here = sorted?.key === column.key ? sorted.dir : null;
  const inner = (
    <>
      <span className="truncate">{column.label}</span>
      {here ? <Icon name={here === "asc" ? "arrowUp" : "arrowDown"} weight="medium" className="size-3.5" /> : null}
    </>
  );
  const base = cn(
    "flex h-full min-w-0 items-center gap-1 px-3 text-footnote font-medium text-label-secondary",
    column.align === "end" && "justify-end",
  );
  return (
    <div role="columnheader" aria-sort={here === "asc" ? "ascending" : here === "desc" ? "descending" : undefined} className="h-full min-w-0">
      {column.sortHref ? (
        <Link href={column.sortHref} scroll={false} className={cn(base, "transition-opacity duration-100 active:opacity-70", here && "text-label")}>
          {inner}
        </Link>
      ) : (
        <span className={base}>{inner}</span>
      )}
    </div>
  );
}

function Cell<T>({ column, children }: { column: TableColumn<T>; children: ReactNode }) {
  return (
    <div
      role="cell"
      className={cn(
        "flex h-full min-w-0 items-center px-3 text-body text-label",
        column.align === "end" && "justify-end tabular-nums",
      )}
    >
      {children}
    </div>
  );
}

/**
 * A row that can be dragged into a new place: only while its grip is held, so text in the row can
 * still be selected and links still open. It follows the finger and settles on our `move` spring.
 */
function DraggableRow({
  id,
  first,
  template,
  edge,
  selected,
  selection,
  onDrop,
  children,
}: {
  id: string;
  first: boolean;
  template: string;
  edge: string;
  selected: boolean;
  selection?: (on: boolean) => void;
  onDrop: () => void;
  children: ReactNode;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      as="div"
      value={id}
      role="row"
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      transition={motionPresets.move}
      whileDrag={{ scale: 1.01, boxShadow: "var(--ds-shadow-md)", zIndex: 5 }}
      className={cn(
        "relative grid min-h-(--ds-row) items-center bg-(--ds-ground)",
        edge,
        !first && "border-t border-separator",
        selected && "bg-[color-mix(in_oklab,var(--ds-tint)_8%,var(--ds-ground))]",
      )}
      style={{ gridTemplateColumns: template }}
    >
      {selection ? (
        <div className="flex justify-center">
          <Checkbox label="Select this row" checked={selected} onCheckedChange={selection} />
        </div>
      ) : null}
      <button
        type="button"
        aria-label="Drag to reorder"
        onPointerDown={(event) => controls.start(event)}
        className="flex h-full cursor-grab touch-none items-center justify-center text-label-tertiary active:cursor-grabbing"
      >
        <Icon name="grip" className="size-4" />
      </button>
      {children}
    </Reorder.Item>
  );
}
