import { READING_LISTINGS } from "@/lib/ora-reading-listings";

export function ReadingListingPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((item) => item !== id));
      return;
    }
    if (selected.length >= 2) return;
    onChange([...selected, id]);
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-[#2a2430]">Choose Your Reading Listings</legend>
      <p className="text-xs text-muted">Select exactly two. Your profile is listed only in those categories.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {READING_LISTINGS.map((item) => {
          const on = selected.includes(item.id);
          const locked = !on && selected.length >= 2;
          return (
            <label
              key={item.id}
              className={
                on
                  ? "flex cursor-pointer items-center gap-3 rounded-2xl border border-[#7a4e6c] bg-[#fbf6ea] px-3 py-3"
                  : locked
                    ? "flex cursor-not-allowed items-center gap-3 rounded-2xl border border-[#efe4ea] bg-[#faf7f8] px-3 py-3 opacity-60"
                    : "flex cursor-pointer items-center gap-3 rounded-2xl border border-[#eadfe6] bg-white px-3 py-3"
              }
            >
              <input
                type="checkbox"
                className="size-4 accent-[#7a4e6c]"
                checked={on}
                disabled={locked}
                onChange={() => toggle(item.id)}
              />
              <span className="text-sm font-semibold text-[#2a2430]">{item.label}</span>
            </label>
          );
        })}
      </div>
      <p className="text-xs text-faint">{selected.length} of 2 selected</p>
    </fieldset>
  );
}
