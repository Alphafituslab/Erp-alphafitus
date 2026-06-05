import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm shadow-xs",
          "transition-[border-color,box-shadow] duration-150",
          "placeholder:text-muted-foreground/60",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/15",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/50",
          "hover:border-border",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
