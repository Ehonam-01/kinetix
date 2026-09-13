"use client";

import { useId, useMemo, useState, type PointerEvent } from "react";

export type BalanceEvolutionPoint = { date: string; balance: number };

const WIDTH = 600;
const HEIGHT = 200;
const PAD_TOP = 20;
const PAD_BOTTOM = 12;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const CHART_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const CHART_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;

function formatXof(value: number) {
  return `${Math.round(value).toLocaleString("fr-FR")} F`;
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

// Solde cumulé sur les 30 derniers jours — une seule série, donc pas de
// légende nécessaire (le titre de la carte porte déjà le nom de la
// grandeur affichée). Toutes les valeurs restent accessibles sans survol :
// le point final est étiqueté directement, et le détail transaction par
// transaction existe déjà sous forme de table sur /dashboard/commissions.
export function BalanceEvolutionChart({
  points,
}: {
  points: BalanceEvolutionPoint[];
}) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const hasActivity = points.some((p) => p.balance !== 0);

  const { linePath, areaPath, xy, min, max } = useMemo(() => {
    const values = points.map((p) => p.balance);
    const rawMin = Math.min(...values, 0);
    const rawMax = Math.max(...values, 0);
    const span = rawMax - rawMin || 1;
    const min = rawMin - span * 0.1;
    const max = rawMax + span * 0.1;

    const xy = points.map((p, i) => ({
      x:
        PAD_LEFT +
        (points.length <= 1 ? 0 : (i / (points.length - 1)) * CHART_WIDTH),
      y:
        PAD_TOP +
        CHART_HEIGHT -
        ((p.balance - min) / (max - min)) * CHART_HEIGHT,
    }));

    const linePath = xy
      .map(
        (p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`,
      )
      .join(" ");
    const baseline = PAD_TOP + CHART_HEIGHT;
    const areaPath = xy.length
      ? `${linePath} L${xy[xy.length - 1].x.toFixed(2)},${baseline} L${xy[0].x.toFixed(2)},${baseline} Z`
      : "";

    return { linePath, areaPath, xy, min, max };
  }, [points]);

  if (points.length === 0 || !hasActivity) {
    return (
      <div className="text-muted-foreground flex h-[200px] items-center justify-center text-sm">
        Aucune activité sur les 30 derniers jours.
      </div>
    );
  }

  const last = points[points.length - 1];
  const lastXy = xy[xy.length - 1];
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const hoveredXy = hoverIndex !== null ? xy[hoverIndex] : null;

  const tooltipWidth = 108;
  const tooltipX = hoveredXy
    ? Math.min(
        Math.max(hoveredXy.x - tooltipWidth / 2, PAD_LEFT),
        WIDTH - PAD_RIGHT - tooltipWidth,
      )
    : 0;

  function handlePointerMove(e: PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const index = Math.round(ratio * (points.length - 1));
    setHoverIndex(Math.min(points.length - 1, Math.max(0, index)));
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Évolution du solde sur les 30 derniers jours, de ${formatXof(points[0].balance)} à ${formatXof(last.balance)}`}
    >
      <defs>
        <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor="var(--color-primary)"
            stopOpacity={0.16}
          />
          <stop
            offset="100%"
            stopColor="var(--color-primary)"
            stopOpacity={0.02}
          />
        </linearGradient>
      </defs>

      {[0, 1].map((t) => {
        const y = PAD_TOP + CHART_HEIGHT * (1 - t);
        const value = min + (max - min) * t;
        return (
          <g key={t}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={y}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth={1}
            />
            <text
              x={PAD_LEFT}
              y={t === 1 ? y + 10 : y - 4}
              fontSize={9}
              fill="var(--color-muted-foreground)"
            >
              {formatXof(value)}
            </text>
          </g>
        );
      })}

      <path d={areaPath} fill={`url(#${gradientId}-fill)`} stroke="none" />
      <path
        d={linePath}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      <circle cx={lastXy.x} cy={lastXy.y} r={6} fill="var(--color-card)" />
      <circle cx={lastXy.x} cy={lastXy.y} r={4} fill="var(--color-primary)" />
      <text
        x={Math.min(lastXy.x, WIDTH - PAD_RIGHT - 8)}
        y={lastXy.y - 12}
        fontSize={11}
        fontWeight={600}
        textAnchor="end"
        fill="var(--color-foreground)"
      >
        {formatXof(last.balance)}
      </text>

      {hoveredXy && hovered && (
        <>
          <line
            x1={hoveredXy.x}
            x2={hoveredXy.x}
            y1={PAD_TOP}
            y2={PAD_TOP + CHART_HEIGHT}
            stroke="var(--color-muted-foreground)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <circle
            cx={hoveredXy.x}
            cy={hoveredXy.y}
            r={5}
            fill="var(--color-primary)"
            stroke="var(--color-card)"
            strokeWidth={2}
          />
          <g transform={`translate(${tooltipX}, ${PAD_TOP})`}>
            <rect
              width={tooltipWidth}
              height={36}
              rx={6}
              fill="var(--color-popover)"
              stroke="var(--color-border)"
            />
            <text
              x={8}
              y={16}
              fontSize={11}
              fontWeight={600}
              fill="var(--color-popover-foreground)"
            >
              {formatXof(hovered.balance)}
            </text>
            <text
              x={8}
              y={28}
              fontSize={9}
              fill="var(--color-muted-foreground)"
            >
              {formatDate(hovered.date)}
            </text>
          </g>
        </>
      )}

      <rect
        x={PAD_LEFT}
        y={PAD_TOP}
        width={CHART_WIDTH}
        height={CHART_HEIGHT}
        fill="transparent"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      />
    </svg>
  );
}
