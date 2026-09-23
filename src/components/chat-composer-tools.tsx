import { Image as ImageIcon, Smile, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { readImageFile } from "@/lib/file-data";
import { insertAtCursor } from "@/lib/ora-message-media";

const EMOJI = [
  "✨", "😊", "😌", "🙏", "💜", "🤍", "🌙", "⭐",
  "💛", "🌸", "🌿", "🔥", "💧", "👁️", "💫", "🫶",
  "😔", "😢", "😍", "😘", "😅", "🤔", "😇", "😴",
  "👍", "👎", "❤️", "💔", "🌹", "🍀", "🌞", "🌈",
];

export function ChatImagePreview({ image, onCancel }: { image: string; onCancel: () => void }) {
  if (!image) return null;
  return (
    <div className="mb-2 flex items-center gap-2">
      <img src={image} alt="" className="h-14 w-14 rounded-xl object-cover" />
      <button type="button" className="inline-flex items-center gap-1 text-xs text-muted" onClick={onCancel}>
        <X className="size-3.5" />
        Cancel photo
      </button>
    </div>
  );
}

export function EmojiPhotoButtons({
  draft,
  setDraft,
  inputRef,
  setImage,
  disabled,
}: {
  draft: string;
  setDraft: (value: string) => void;
  inputRef: { current: HTMLInputElement | HTMLTextAreaElement | null };
  setImage: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function addEmoji(emoji: string) {
    const field = inputRef.current;
    const start = field?.selectionStart ?? draft.length;
    const end = field?.selectionEnd ?? draft.length;
    const next = insertAtCursor(draft, start, end, emoji);
    setDraft(next.value);
    setOpen(false);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(next.cursor, next.cursor);
    });
  }

  return (
    <div className="relative flex shrink-0 items-end gap-1">
      <button
        type="button"
        aria-label="Emoji"
        disabled={disabled}
        className="grid size-9 place-items-center rounded-full bg-elevated text-primary shadow-[var(--shadow-border)] disabled:opacity-40"
        onClick={() => setOpen((value) => !value)}
      >
        <Smile className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Photo"
        disabled={disabled}
        className="grid size-9 place-items-center rounded-full bg-elevated text-primary shadow-[var(--shadow-border)] disabled:opacity-40"
        onClick={() => fileRef.current?.click()}
      >
        <ImageIcon className="size-4" />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          void readImageFile(file)
            .then(setImage)
            .catch((err) => toast.error(err instanceof Error ? err.message : "Could not read that photo"));
        }}
      />
      {open ? (
        <div className="absolute bottom-11 left-0 z-20 grid w-56 grid-cols-8 gap-0.5 rounded-2xl bg-surface p-1.5 shadow-[var(--shadow-border)]">
          {EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="grid size-6 place-items-center rounded-md text-base hover:bg-elevated"
              onClick={() => addEmoji(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
