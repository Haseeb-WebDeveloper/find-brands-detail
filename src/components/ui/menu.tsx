"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { cn } from "@/lib/utils";

/**
 * A menu that hangs off a button: a short list of things to DO, not values to pick.
 *
 * THE DIFFERENCE FROM `Select` IS THE WHOLE REASON THIS EXISTS, and it is not decoration. A select
 * holds a value and one of its rows is currently true, so it marks one and reopens on it. A menu
 * holds verbs. Nothing in it is "current", every row fires and closes, and one of them is usually
 * destructive. Dressing a select up as a menu gets you a tick floating beside "Delete", and reopens
 * pointing at whatever was clicked last, which reads as the app remembering a choice nobody made.
 *
 * IT WAS ADDED FOR THE ROW MENU ON THE TEAM TABLE and is deliberately the smallest thing that could
 * serve it: a trigger, a popup, an item, and a `danger` flag. Base UI already has submenus, checkbox
 * items and radio groups behind the same import; none of them is wrapped here, because a wrapper
 * with no caller is a styling decision made in advance and it will be the wrong one.
 *
 * THE POPUP BORROWS `SelectContent`'S FACE ON PURPOSE — same frosted panel, same ring, same 8px
 * corner with a 4px inset and 4px item corners. Two overlays a click apart that disagree about their
 * corner radius is the kind of thing nobody can name and everybody can see. The tokens fall back to
 * `--popover` outside the app surface, so this is not app-only by accident.
 */

const Menu = MenuPrimitive.Root;
const MenuTrigger = MenuPrimitive.Trigger;

function MenuContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "end",
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "side" | "sideOffset" | "align">) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        className="isolate z-50"
      >
        <MenuPrimitive.Popup
          data-slot="menu-content"
          className={cn(
            "min-w-40 origin-(--transform-origin) overflow-hidden rounded-lg p-1",
            "bg-(--app-overlay-bg) [backdrop-filter:var(--app-overlay-blur)]",
            "text-popover-foreground shadow-md ring-1 ring-border",
            "duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

function MenuItem({
  className,
  danger,
  ...props
}: MenuPrimitive.Item.Props & {
  /**
   * This row takes something away.
   *
   * RED ONLY ON HOVER AND FOCUS, not at rest. A menu whose third row is permanently red reads as a
   * warning about the menu; a row that turns red under the pointer reads as a warning about the
   * click, which is the moment the warning is for. Same reasoning as the destructive button in
   * `customer-actions.tsx`, which is grey until you are on it.
   */
  danger?: boolean;
}) {
  return (
    <MenuPrimitive.Item
      data-slot="menu-item"
      className={cn(
        "flex min-h-8 w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2",
        "text-app-md text-foreground outline-hidden",
        "transition-[background,color] duration-100",
        "hover:bg-app-hover data-highlighted:bg-app-hover",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        danger && "hover:text-destructive data-highlighted:text-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Menu, MenuTrigger, MenuContent, MenuItem };
