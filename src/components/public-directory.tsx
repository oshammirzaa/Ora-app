import { Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { PublicPsychicCard } from "@/components/public-psychic-card";
import type { Category } from "@/lib/ora";
import type { PublicPsychic } from "@/lib/ora-domains";
import { PUBLIC_CATEGORIES, TOPIC_FILTERS, publicCategoryById } from "@/lib/ora-public-categories";
import { pageDirectory, queryPublicDirectory, type PsychicSearch } from "@/lib/ora-public-directory";
import { presenceState } from "@/lib/ora-presence";

const TITLES: Record<string, string> = {
  trusted: "Trusted Psychics",
  recommended: "Recommended Psychics",
  new: "New Psychics",
};

export function PublicDirectory({
  advisors,
  categories,
  search,
  marketingHost,
  previewLayout,
}: {
  advisors: PublicPsychic[];
  categories: Category[];
  search: PsychicSearch;
  marketingHost: boolean;
  previewLayout: boolean;
}) {
  const navigate = useNavigate();
  const [pages, setPages] = useState(1);
  const [draft, setDraft] = useState(search.q || "");
  const searchKey = JSON.stringify(search);

  useEffect(() => {
    setPages(1);
    setDraft(search.q || "");
  }, [searchKey, search.q]);

  const matched = useMemo(
    () => queryPublicDirectory(advisors, search, previewLayout),
    [advisors, search, previewLayout],
  );
  const page = pageDirectory(matched, pages);
  const available = matched.filter((advisor) => presenceState(advisor) === "online").length;
  const category = search.category ? publicCategoryById(search.category) : null;
  const title = TITLES[search.board || ""] || category?.label || "Advisors";
  const extras = categories
    .map((item) => item.name)
    .filter((name) => name && !PUBLIC_CATEGORIES.some((item) => item.label.toLowerCase() === name.toLowerCase()));

  function update(next: PsychicSearch) {
    const clean: PsychicSearch = {};
    if (next.board) clean.board = next.board;
    if (next.category) clean.category = next.category;
    if (next.q) clean.q = next.q;
    if (next.availability) clean.availability = next.availability;
    if (next.connect) clean.connect = next.connect;
    if (next.sort && next.sort !== "recommended") clean.sort = next.sort;
    void navigate({ to: "/psychics", search: clean, replace: true });
  }

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const q = draft.trim();
    update({ ...search, q: q || undefined });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-semibold text-[#2a2430] md:text-5xl">{title}</h1>
          <p className="mt-2 text-sm font-medium text-[#72687a]">
            {page.total} {page.total === 1 ? "advisor" : "advisors"}
            {" · "}
            {available} available to chat in this view
          </p>
        </div>
        <Link to="/" className="text-sm font-semibold text-primary">
          Back to Ora
        </Link>
      </div>

      <form onSubmit={onSearch} className="mt-5 flex flex-col gap-2 sm:flex-row" role="search">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search advisors</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary" strokeWidth={2.25} />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search name or specialty"
            className="h-12 w-full rounded-full border border-[#eadfe6] bg-white pr-4 pl-10 text-sm font-semibold text-[#2a2430] outline-none placeholder:font-medium placeholder:text-[#a39aaa] focus:border-primary"
          />
        </label>
        <button type="submit" className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-fg">
          Search
        </button>
      </form>

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <FilterSelect
          label="Topic"
          value={search.category || ""}
          onChange={(category) => update({ ...search, category: category || undefined })}
        >
          <option value="">All topics</option>
          {TOPIC_FILTERS.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.label}
            </option>
          ))}
          {extras.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Availability"
          value={search.availability || ""}
          onChange={(availability) =>
            update({
              ...search,
              availability: availability === "online" || availability === "busy" || availability === "offline" ? availability : undefined,
            })
          }
        >
          <option value="">All</option>
          <option value="online">Online Now</option>
          <option value="busy">Busy</option>
          <option value="offline">Offline</option>
        </FilterSelect>
        <FilterSelect
          label="Sort"
          value={search.board ? "" : search.sort || "recommended"}
          disabled={Boolean(search.board)}
          onChange={(sort) =>
            update({
              ...search,
              board: undefined,
              sort: sort === "top-rated" || sort === "experienced" || sort === "new" ? sort : undefined,
            })
          }
        >
          {search.board ? <option value="">Board order</option> : null}
          <option value="recommended">Recommended</option>
          <option value="top-rated">Top Rated</option>
          <option value="experienced">Most Experienced</option>
          <option value="new">New Advisors</option>
        </FilterSelect>
        <div>
          <p className="mb-1 text-xs font-semibold tracking-wide text-[#72687a] uppercase">Connect via</p>
          <p className="flex h-12 items-center rounded-full border border-[#eadfe6] bg-white px-4 text-sm font-semibold text-[#2a2430]">
            Live chat
          </p>
        </div>
      </div>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        <Pill on={false} href={{}}>
          All
        </Pill>
        {PUBLIC_CATEGORIES.filter((item) => item.id !== "new").map((item) => (
          <Pill key={item.id} on={search.category === item.id} href={{ category: item.id }}>
            {item.short}
          </Pill>
        ))}
        <Pill on={search.board === "new"} href={{ board: "new" }}>
          New Advisors
        </Pill>
        <button
          type="button"
          onClick={() => update({})}
          className="inline-flex h-10 items-center rounded-full px-3 text-sm font-semibold text-primary"
        >
          Clear filters
        </button>
      </div>

      {page.items.length ? (
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {page.items.map((advisor) => (
            <li key={advisor.id} className="min-w-0">
              <PublicPsychicCard advisor={advisor} marketingHost={marketingHost} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm font-medium text-[#72687a]">No advisors match these filters yet.</p>
      )}
      {page.hasMore ? (
        <button
          type="button"
          onClick={() => setPages((current) => current + 1)}
          className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full border border-primary bg-white text-sm font-semibold text-primary sm:w-auto sm:px-8"
        >
          Load more
        </button>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold tracking-wide text-[#72687a] uppercase">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-full border border-[#eadfe6] bg-white px-4 text-sm font-semibold text-[#2a2430] outline-none focus:border-primary disabled:text-[#a39aaa]"
      >
        {children}
      </select>
    </label>
  );
}

function Pill({
  children,
  on,
  href,
}: {
  children: string;
  on: boolean;
  href: PsychicSearch;
}) {
  return (
    <Link
      to="/psychics"
      search={href}
      className={
        on
          ? "inline-flex h-10 items-center rounded-full bg-primary px-3 text-sm font-semibold text-primary-fg"
          : "inline-flex h-10 items-center rounded-full border border-[#eadfe6] bg-white px-3 text-sm font-semibold text-[#2a2430]"
      }
    >
      {children}
    </Link>
  );
}
