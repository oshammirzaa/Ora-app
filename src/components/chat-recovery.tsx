export function ConnectionBanner({ offline }: { offline: boolean }) {
  if (!offline) return null;
  return (
    <p className="rounded-xl bg-[#f3eaf6] px-3 py-2 text-sm text-[#6d3d78]" role="status">
      Connection lost — reconnecting. This reading stays open. The server keeps the timer and charges. Reconnecting does not start a second reading.
    </p>
  );
}
