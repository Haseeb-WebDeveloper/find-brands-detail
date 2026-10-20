import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * A tag, in the reference's sense: 24px tall, 8px of side padding, a 4px corner and 12px regular
 * text. No border unless a variant asks for one.
 *
 * **IT WAS 20px AND THAT LEFT 4px OF AIR AROUND A 12px WORD (2026-10-05).** A status chip is the
 * thing a contractor looks for when scanning a list of rows, and the one on the money screen read as
 * something squeezed in rather than something to find. 24px is still shorter than the 32px row it
 * sits in, so nothing about the density changes; the word simply has room.
 *
 * IT IS NO LONGER A PILL, and that is the change to notice. A fully rounded chip reads as a status
 * light, which is right when there are two of them on a page and wrong when a record has nine
 * stacked in a field. Squaring the corner to the same 4px a table row uses is what lets a column of
 * tags read as data rather than as decoration, and it is why the reference sets `sm-round` here
 * while keeping `pill` in the palette for the rare thing that really is a pill.
 *
 * 12px AND NOT 13, WHICH IS A DELIBERATE DEPARTURE. The reference sets tags at its body size, and
 * gets away with it because its entire surface is that one size: a tag next to a cell next to a
 * label, all 13px, so nothing stands out. This surface is not there yet. Its meta lines are 12px and
 * its card titles are larger, so a 13px tag dropped into that mix was the loudest thing on the card
 * rather than the quietest. It goes back to `text-app-md` when layer 5 puts the whole surface on one
 * scale, and not before. See `docs/DESIGN-SYSTEM.md`.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-2 text-app-sm font-normal whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border bg-input/20 text-foreground dark:bg-input/30 [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
