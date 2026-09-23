import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function ChatPhoto({ src, light = false }: { src: string; light?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!src) return null;
  return (
    <>
      <button type="button" className="block" onClick={() => setOpen(true)} aria-label="View photo">
        <img src={src} alt="" className="max-h-48 max-w-full rounded-xl object-cover" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(100%,24rem)] bg-surface p-3">
          <img src={src} alt="" className={light ? "max-h-[70dvh] w-full rounded-xl object-contain" : "max-h-[70dvh] w-full rounded-xl object-contain"} />
        </DialogContent>
      </Dialog>
    </>
  );
}
