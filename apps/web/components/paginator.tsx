"use client";

interface PaginatorProps {
  page: number;
  totalPages: number;
  total?: number;
  label?: string;
  onPageChange: (page: number) => void;
}

function buildPages(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const result: (number | "...")[] = [1];
  if (current - 2 > 2) result.push("...");
  for (let p = Math.max(2, current - 2); p <= Math.min(total - 1, current + 2); p++) result.push(p);
  if (current + 2 < total - 1) result.push("...");
  result.push(total);
  return result;
}

export function Paginator({ page, totalPages, total, label, onPageChange }: PaginatorProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="ha-pag">
      <button className="ha-pag__btn" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        ←<span className="ha-pag__label"> Anterior</span>
      </button>
      <div className="ha-pag__nums">
        {buildPages(page, totalPages).map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} className="ha-pag__ellipsis">…</span>
          ) : (
            <button
              key={p}
              className={"ha-pag__pg" + (p === page ? " on" : "")}
              onClick={() => onPageChange(p as number)}
            >
              {p}
            </button>
          )
        )}
      </div>
      <button className="ha-pag__btn" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        <span className="ha-pag__label">Siguiente </span>→
      </button>
      {total != null && (
        <span className="ha-pag__info">
          {total} {label ?? "total"} · página {page} de {totalPages}
        </span>
      )}
    </div>
  );
}
