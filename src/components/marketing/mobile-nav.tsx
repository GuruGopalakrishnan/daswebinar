"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NavLinks } from "./nav-links";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="min-[900px]:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(320px,85vw)]">
        <SheetHeader>
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Logo />
        </SheetHeader>
        <NavLinks className="flex flex-col gap-1 px-4" linkClassName="min-h-11 flex items-center" onNavigate={close} />
        <div className="mt-2 grid gap-2 px-4">
          <Button asChild size="lg">
            <Link href="/signup" onClick={close}>
              Start free
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login" onClick={close}>
              Sign in
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
