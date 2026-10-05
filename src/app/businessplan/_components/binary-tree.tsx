"use client";

import { useEffect, useRef, useState } from "react";

// The binary structure, drawn row by row once it scrolls into view: the
// ambassador, two direct positions, then each position's own two, and so
// on. Fully drawn from the start for reduced motion (and on the server).
const ROWS = 4;
const WIDTH = 640;
const ROW_GAP = 92;
const TOP = 40;

type Node = {
  x: number;
  y: number;
  row: number;
  parent?: { x: number; y: number };
};

function layout(): Node[] {
  const nodes: Node[] = [];
  for (let row = 0; row < ROWS; row++) {
    const count = 2 ** row;
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) / count) * WIDTH;
      const y = TOP + row * ROW_GAP;
      const parent =
        row === 0
          ? undefined
          : {
              x: ((Math.floor(i / 2) + 0.5) / 2 ** (row - 1)) * WIDTH,
              y: TOP + (row - 1) * ROW_GAP,
            };
      nodes.push({ x, y, row, parent });
    }
  }
  return nodes;
}

const NODES = layout();
const LABELS = ["Toi", "G1", "G2", "G3"];

export function BinaryTree() {
  const ref = useRef<SVGSVGElement>(null);
  const [visibleRows, setVisibleRows] = useState(ROWS);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timers: number[] = [];
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        setVisibleRows(1);
        for (let row = 2; row <= ROWS; row++) {
          timers.push(
            window.setTimeout(() => setVisibleRows(row), (row - 1) * 650),
          );
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const height = TOP * 2 + (ROWS - 1) * ROW_GAP;
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${WIDTH} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label="Structure binaire : l'ambassadeur, ses deux positions directes, puis deux positions sous chacune, et ainsi de suite."
    >
      <defs>
        <linearGradient id="bt-line" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5a524" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#4f8cff" stopOpacity="0.7" />
        </linearGradient>
        <radialGradient id="bt-root" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ffd27a" />
          <stop offset="100%" stopColor="#f5a524" />
        </radialGradient>
      </defs>

      {NODES.filter((n) => n.parent).map((n, i) => (
        <line
          key={`l${i}`}
          x1={n.parent!.x}
          y1={n.parent!.y}
          x2={n.x}
          y2={n.y}
          stroke="url(#bt-line)"
          strokeWidth={2}
          strokeLinecap="round"
          style={{
            opacity: n.row < visibleRows ? 1 : 0,
            transition: "opacity 500ms ease-out",
          }}
        />
      ))}

      {NODES.map((n, i) => {
        const shown = n.row < visibleRows;
        const r = n.row === 0 ? 24 : n.row === 1 ? 18 : n.row === 2 ? 14 : 10;
        return (
          <g
            key={`n${i}`}
            style={{
              opacity: shown ? 1 : 0,
              transform: shown ? "scale(1)" : "scale(0.4)",
              transformOrigin: `${n.x}px ${n.y}px`,
              transition: "opacity 500ms ease-out, transform 500ms ease-out",
            }}
          >
            <circle
              cx={n.x}
              cy={n.y}
              r={r + 6}
              fill={n.row === 0 ? "#f5a524" : "#4f8cff"}
              opacity={0.15}
            />
            <circle
              cx={n.x}
              cy={n.y}
              r={r}
              fill={n.row === 0 ? "url(#bt-root)" : "#16224a"}
              stroke={n.row === 0 ? "#ffd27a" : "#4f8cff"}
              strokeWidth={2}
            />
          </g>
        );
      })}

      {LABELS.map((label, row) => (
        <text
          key={label}
          x={8}
          y={TOP + row * ROW_GAP + 4}
          fill="#9fb0d6"
          fontSize={13}
          fontWeight={600}
          style={{
            opacity: row < visibleRows ? 1 : 0,
            transition: "opacity 500ms ease-out",
          }}
        >
          {label}
        </text>
      ))}
    </svg>
  );
}
