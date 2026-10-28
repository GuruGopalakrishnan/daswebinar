import * as React from "react"
import { cn } from "cn"
import { fieldStyles } from "./field-styles"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        fieldStyles,
        "flex field-sizing-content min-h-[88px] w-full px-3 py-2 text-base leading-5 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
