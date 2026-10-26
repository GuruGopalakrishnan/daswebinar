"use client";

import { useState } from "react";
import { PanelLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open navigation">
          <PanelLeft />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-sidebar">
        <SheetHeader>
          <SheetTitle asChild>
            <div>
              <Logo href="/dashboard" />
            </div>
          </SheetTitle>
        </SheetHeader>
        <div className="px-3">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
