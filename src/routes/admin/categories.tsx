import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminAllCategories,
  adminDeleteCategory,
  adminReorderCategory,
  adminSaveCategory,
} from "@/lib/ora-admin";
import type { Category } from "@/lib/ora";

export const Route = createFileRoute("/admin/categories")({ component: CategoriesPage });

function CategoriesPage() {
  const [rows, setRows] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");

  async function load() {
    setRows(await adminAllCategories({ data: { t: Date.now() } }));
  }

  useEffect(() => {
    void load().catch(() => setRows([]));
  }, []);

  return (
    <main>
      <PageHeader
        title="Categories"
        description="These chips appear on the customer floor. Advisors match on specialties."
      />
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void adminSaveCategory({ data: { name } })
            .then((next) => {
              setRows(next);
              setName("");
              toast.success("Category added.");
            })
            .catch((err) => toast.error(err instanceof Error ? err.message : "Could not add"));
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" required />
        <Button type="submit">Add</Button>
      </form>
      <ul className="mt-6 space-y-2">
        {rows.map((c) => (
          <li key={c.id} className="rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-border)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {editId === c.id ? (
                <form
                  className="flex min-w-0 flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void adminSaveCategory({ data: { id: c.id, name: editName, active: c.active } })
                      .then((next) => {
                        setRows(next);
                        setEditId("");
                        toast.success("Renamed.");
                      })
                      .catch((err) => toast.error(err instanceof Error ? err.message : "Could not rename"));
                  }}
                >
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
                  <Button size="sm" type="submit">
                    Save
                  </Button>
                </form>
              ) : (
                <span>
                  {c.name}
                  <span className="ml-2 text-xs text-faint">{c.active ? "on floor" : "hidden"}</span>
                </span>
              )}
              <span className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void adminReorderCategory({ data: { id: c.id, dir: "up" } })
                      .then(setRows)
                      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not move"))
                  }
                >
                  Up
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void adminReorderCategory({ data: { id: c.id, dir: "down" } })
                      .then(setRows)
                      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not move"))
                  }
                >
                  Down
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditId(editId === c.id ? "" : c.id);
                    setEditName(c.name);
                  }}
                >
                  {editId === c.id ? "Cancel" : "Rename"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void adminSaveCategory({ data: { id: c.id, name: c.name, active: !c.active } }).then(setRows)
                  }
                >
                  {c.active ? "Hide" : "Show"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void adminDeleteCategory({ data: { id: c.id } })
                      .then(setRows)
                      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not remove"))
                  }
                >
                  Remove
                </Button>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}