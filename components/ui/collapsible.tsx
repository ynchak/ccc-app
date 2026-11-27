"use client"

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"

function Collapsible({
  defaultOpen = false,
  ...props
}: CollapsiblePrimitive.Root.Props) {
  return (
    <CollapsiblePrimitive.Root
      defaultOpen={defaultOpen}
      data-slot="collapsible"
      {...props}
    />
  )
}

function CollapsibleTrigger({
  className,
  children,
  ...props
}: CollapsiblePrimitive.Trigger.Props & { className?: string }) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-accent data-[state=open]:text-muted-foreground border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 py-1 text-xs"
      {...props}
    >
      {children}
    </CollapsiblePrimitive.Trigger>
  )
}

function CollapsibleContent({
  className,
  children,
  ...props
}: CollapsiblePrimitive.Panel.Props & { className?: string }) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      keepMounted
      className="data-[state=closed]:max-h-0 data-[state=closed]:opacity-0 data-[state=closed]:pointer-events-none data-[state=open]:max-h-[500px] data-[state=open]:opacity-100 data-[state=open]:pointer-events-auto overflow-hidden transition-all duration-300 ease-out"
      {...props}
    >
      {children}
    </CollapsiblePrimitive.Panel>
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
