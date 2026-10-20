"use client";

import { MotionConfig } from "motion/react";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "./cn";
import { designInter } from "./fonts";

/**
 * Where popups are drawn. Menus, popovers, dialogs and sheets render through a portal, and a portal
 * to <body> leaves `[data-design]` behind: no tokens, no font, the dark palette lost. (The roofing
 * template hit exactly this and its overlays fell back to the default blue.) So the root keeps a
 * layer of its own, inside itself, and every overlay portals into that.
 */
const PortalLayer = createContext<HTMLElement | null>(null);

/** The element overlays portal into. `undefined` until the root has mounted, which Base UI treats
 *  as "the default", so a popup opened in the first frame still works. */
export function usePortalLayer(): HTMLElement | undefined {
  return useContext(PortalLayer) ?? undefined;
}

/**
 * How a page opens the app's navigation on a phone, where there is no sidebar. The frame provides it;
 * the page header draws the button. Null outside a frame that has a navigation drawer.
 */
const NavMenu = createContext<(() => void) | null>(null);
export const NavMenuProvider = NavMenu;
export function useNavMenu() {
  return useContext(NavMenu);
}

/**
 * The element that scrolls, for things that react to scrolling: the page header's title, the phone's
 * tab bar. In a `frame` it is the root itself; outside one it is the window, and this is null.
 */
const ScrollRoot = createContext<RefObject<HTMLDivElement | null> | null>(null);

/** For a frame whose scrolling element is not the root (the app frame's page panel). */
export const ScrollRootProvider = ScrollRoot;

export function useScrollRoot() {
  return useContext(ScrollRoot);
}

/**
 * Where our design language begins. Everything inside reads our tokens, our font and our motion.
 *
 * `reducedMotion="user"`: when somebody has asked their device for less motion, every spring that
 * moves something becomes an instant change, and opacity still fades. Not "no feedback": the press
 * still dims (docs/DESIGN-LANGUAGE.md 7).
 *
 * `mode` forces light or dark (the test page, a preview); left out, the screen follows the
 * dashboard's own light or dark setting.
 *
 * `frame`: the screen is an APP, not a document. The window never scrolls; this root does. That is
 * how Apple's apps work, and it is also what lets a sheet reach the edge of the window: when the
 * window itself scrolls, opening a sheet locks it and the browser keeps the scrollbar's lane
 * reserved (so the page does not jump sideways), painted in its default light grey, and nothing
 * positioned against the window can cover it (owner, 2026-10-13, spotted beside the side panel).
 * With the window not scrolling there is no lane, and the lock has nothing to do. The office and
 * admin use it; a long public page of ours would not.
 *
 * It ALSO turns off the template's `html { scrollbar-gutter: stable }`, which the roofing template
 * sets on every page this app serves (its tokens.css, to stop its own popups shifting the layout).
 * In a frame the window has no scrollbar, so that lane is only ever an empty 10-15px strip beside a
 * sheet. Restored on the way out, so a contractor's site is exactly as it was.
 */
export function DesignRoot({
  mode,
  frame = false,
  className,
  children,
  ...rest
}: {
  mode?: "light" | "dark";
  frame?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<"div">, "className" | "children">) {
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!frame) return;
    const html = document.documentElement;
    const before = { overflow: html.style.overflow, gutter: html.style.scrollbarGutter };
    html.style.overflow = "hidden";
    html.style.scrollbarGutter = "auto";
    return () => {
      html.style.overflow = before.overflow;
      html.style.scrollbarGutter = before.gutter;
    };
  }, [frame]);

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={rootRef}
        data-design=""
        data-mode={mode}
        className={cn(designInter.variable, frame && "h-dvh overflow-y-auto overscroll-contain", className)}
        {...rest}
      >
        <ScrollRoot value={frame ? rootRef : null}>
          <PortalLayer value={layer}>{children}</PortalLayer>
        </ScrollRoot>
        {/* `contents`: it draws no box of its own, so it cannot clip or offset a fixed overlay. */}
        <div ref={setLayer} className="contents" />
      </div>
    </MotionConfig>
  );
}
