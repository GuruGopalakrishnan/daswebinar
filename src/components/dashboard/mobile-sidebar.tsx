"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";

/** Sidebar as a sheet under 1024 px. `foot` is the server-rendered plan box and account menu. */
export function MobileSidebar({ foot }: { foot?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(288px,85vw)] gap-4 bg-sidebar px-3 pb-4">
        <SheetHeader className="px-2">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Logo href="/dashboard" />
        </SheetHeader>
        <SidebarNav onNavigate={() => setOpen(false)} />
        <div className="mt-auto flex flex-col gap-3">{foot}</div>
      </SheetContent>
    </Sheet>
  );
}
