import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => number | string;
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  filterText,
  initialSort,
  onRowClick,
  caption,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string;
  caption: string;
  filterText?: (r: T) => string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  onRowClick?: (r: T) => void;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(initialSort ?? null);
  const shown = useMemo(() => {
    let r =
      filterText && q
        ? rows.filter((x) => filterText(x).toLowerCase().includes(q.toLowerCase()))
        : rows;
    const col = columns.find((c) => c.key === sort?.key);
    if (col?.sortValue && sort) {
      r = [...r].sort((a, b) => {
        const va = col.sortValue!(a),
          vb = col.sortValue!(b);
        return (va < vb ? -1 : va > vb ? 1 : 0) * (sort.dir === "asc" ? 1 : -1);
      });
    }
    return r;
  }, [rows, q, sort, columns, filterText]);

  return (
    <div className="space-y-3">
      {filterText && (
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          aria-label="Search table"
          className="h-9 w-full max-w-xs rounded-md border border-border bg-surface px-3 text-sm"
        />
      )}
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-border bg-muted text-left">
            <tr>
              {columns.map((c) => {
                const s = sort?.key === c.key ? sort.dir : null;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={`px-4 py-2.5 font-medium text-muted-foreground ${c.className ?? ""}`}
                    aria-sort={s === "asc" ? "ascending" : s === "desc" ? "descending" : undefined}
                  >
                    {c.sortValue ? (
                      <button
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => setSort({ key: c.key, dir: s === "asc" ? "desc" : "asc" })}
                      >
                        {c.header}
                        {s === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : s === "desc" ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr
                key={rowKey(r)}
                className={`border-b border-border last:border-0 ${onRowClick ? "cursor-pointer hover:bg-accent" : ""}`}
                onClick={() => onRowClick?.(r)}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 align-middle ${c.className ?? ""}`}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No matching rows.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
