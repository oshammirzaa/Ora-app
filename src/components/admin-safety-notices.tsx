import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { adminSafetyNotices, markAdminSafetyNoticeRead } from "@/lib/ora-compliance-api";
import { formatWhen } from "@/lib/ora";
import { useVisibleInterval } from "@/lib/use-visible-interval";
import { cn } from "@/lib/utils";

type Notice = Awaited<ReturnType<typeof adminSafetyNotices>>["notices"][number];

export function AdminSafetyNotices() {
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [high, setHigh] = useState(0);
  const seen = useRef(new Set<string>());
  const primed = useRef(false);

  useVisibleInterval(
    () => {
      void adminSafetyNotices()
        .then((res) => {
          setNotices(res.notices);
          setUnread(res.unread);
          setHigh(res.high);
          for (const notice of res.notices) {
            if (notice.read || seen.current.has(notice.id)) continue;
            seen.current.add(notice.id);
            if (!primed.current) continue;
            const preview = `${notice.title}. ${notice.advisorName} · ${notice.customerName} · ${notice.sender} · ${notice.platform} · ${notice.risk.toUpperCase()}`;
            if (notice.risk === "high") toast.warning(preview);
            else toast(preview);
          }
          primed.current = true;
        })
        .catch(() => {});
    },
    15000,
    true,
    true,
  );

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Safety notifications"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "relative grid size-10 place-items-center rounded-full bg-surface text-fg shadow-[var(--shadow-border)]",
          high > 0 && "text-warn",
        )}
      >
        <Bell className="size-4" strokeWidth={1.7} />
        {unread ? <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" /> : null}
      </button>
      {open ? (
        <div className="absolute top-12 right-0 z-50 w-[22rem] overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
          <p className="px-3 pt-3 text-[10px] tracking-[0.16em] text-muted uppercase">Safety notifications</p>
          {!notices.length ? (
            <p className="px-3 py-4 text-sm text-muted">No safety notifications yet.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {notices.map((notice) => (
                <li key={notice.id}>
                  <Link
                    to="/admin/ai-reports"
                    hash={notice.reportId}
                    onClick={() => {
                      setOpen(false);
                      void markAdminSafetyNoticeRead({ data: { id: notice.id } });
                    }}
                    className={cn(
                      "block px-3 py-2.5 text-sm hover:bg-elevated",
                      notice.risk === "high" ? "text-warn" : "text-fg",
                    )}
                  >
                    <span className={notice.read ? "font-normal" : "font-medium"}>{notice.title}</span>
                    <span className="mt-1 block text-xs text-muted">
                      {notice.advisorName} · {notice.customerName} · {notice.sender} · {notice.platform} · {notice.risk.toUpperCase()} · {formatWhen(notice.at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
