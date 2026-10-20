import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";

/**
 * NOTHING HERE YET: a picture, one line saying what will be here, and the button that fills it.
 *
 * Reading "No visits booked" is exactly the moment somebody wants to book one, so the action is part
 * of the empty state, not somewhere else on the page (docs/DESIGN-LANGUAGE.md 9). One line: no
 * paragraph explaining what visits are.
 */
export function Empty({
  icon,
  picture,
  title,
  action,
}: {
  icon: IconName;
  /** A drawing in place of the icon: the office's empty-state art (`EmptyArt`), which the owner
   *  wants kept. The icon is the fallback where no drawing fits. */
  picture?: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      {picture ?? (
        <span className="grid size-16 place-items-center rounded-full bg-fill text-label-secondary">
          <Icon name={icon} className="size-7" />
        </span>
      )}
      <p className="text-headline text-label">{title}</p>
      {action}
    </div>
  );
}
