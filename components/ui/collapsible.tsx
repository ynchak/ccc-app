"use client"

import { useState, useContext, createContext, type ReactNode } from "react"

interface CollapsibleContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const CollapsibleContext = createContext<CollapsibleContextType | null>(null)

interface CollapsibleProps {
  defaultOpen?: boolean
  children: ReactNode
}

export function Collapsible({
  defaultOpen = false,
  children,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <CollapsibleContext.Provider value={{ open, setOpen }}>
      <div
        data-slot="collapsible"
        data-state={open ? "open" : "closed"}
        className="w-full"
      >
        {children}
      </div>
    </CollapsibleContext.Provider>
  )
}

interface CollapsibleTriggerProps {
  className?: string
  children: ReactNode
}

export function CollapsibleTrigger({
  className,
  children,
  ...props
}: CollapsibleTriggerProps) {
  const ctx = useContext(CollapsibleContext)
  if (!ctx) {
    throw new Error("CollapsibleTrigger must be used within Collapsible")
  }
  return (
    <button
      type="button"
      onClick={() => ctx.setOpen(!ctx.open)}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-accent data-[state=open]:text-muted-foreground border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 py-1 text-xs ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

interface CollapsibleContentProps {
  className?: string
  children: ReactNode
}

export function CollapsibleContent({
  className,
  children,
  ...props
}: CollapsibleContentProps) {
  const ctx = useContext(CollapsibleContext)
  if (!ctx) {
    throw new Error("CollapsibleContent must be used within Collapsible")
  }
  return (
    <div
      data-state={ctx.open ? "open" : "closed"}
      className={`overflow-hidden transition-all duration-300 ease-out ${
        ctx.open
          ? "max-h-[500px] opacity-100 pointer-events-auto"
          : "max-h-0 opacity-0 pointer-events-none"
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
