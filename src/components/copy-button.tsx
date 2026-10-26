"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = React.ComponentProps<typeof Button> & { value: string; label?: string };

/** Copies an absolute URL (relative paths are resolved against the current origin). */
export function CopyButton({ value, label = "Copy link", children, ...props }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = value.startsWith("/") ? `${window.location.origin}${value}` : value;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Select and copy it manually.");
    }
  }

  return (
    <Button variant="outline" onClick={copy} {...props}>
      {copied ? <Check /> : <Copy />}
      {children ?? label}
    </Button>
  );
}
