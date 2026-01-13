import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

export type SidebarCategory = {
  id: string;
  name: string;
  count?: number;
};

export function SidebarCategoryPicker({
  groups,
  selectedId,
  onSelect,
  rowHeight = 42
}: {
  groups: SidebarCategory[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  rowHeight?: number;
}) {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startClientY: number;
    startTopY: number;
    started: boolean;
    lastClientY: number;
    lastT: number;
    vY: number;
  } | null>(null);

  const dropletHeight = Math.max(34, rowHeight - 8);
  const pad = (rowHeight - dropletHeight) / 2;

  const selectedIndex = useMemo(() => {
    if (!groups.length || !selectedId) return 0;
    const idx = groups.findIndex((g) => g.id === selectedId);
    return idx >= 0 ? idx : 0;
  }, [groups, selectedId]);

  const snapYForIndex = (idx: number) => idx * rowHeight + pad;
  const yTarget = useMotionValue(snapYForIndex(selectedIndex));
  const y = useSpring(yTarget, reduceMotion ? { stiffness: 999, damping: 999 } : { stiffness: 520, damping: 52, mass: 0.8 });

  const clampIndex = (idx: number) => Math.max(0, Math.min(groups.length - 1, idx));
  const indexFromTopY = (topY: number) => {
    const centerY = topY + dropletHeight / 2;
    const idx = Math.round((centerY - rowHeight / 2) / rowHeight);
    return clampIndex(idx);
  };

  const minTopY = pad;
  const maxTopY = Math.max(pad, (groups.length - 1) * rowHeight + pad);
  const rubberBand = (value: number) => {
    if (value < minTopY) return minTopY - (minTopY - value) * 0.25;
    if (value > maxTopY) return maxTopY + (value - maxTopY) * 0.25;
    return value;
  };

  useEffect(() => {
    if (!groups.length) return;
    if (dragging) return;
    const target = snapYForIndex(selectedIndex);
    if (reduceMotion) {
      yTarget.set(target);
      return;
    }
    const controls = animate(yTarget, target, { type: "spring", stiffness: 520, damping: 40, mass: 0.7 });
    return () => controls.stop();
  }, [groups.length, selectedIndex, dragging, reduceMotion, yTarget]);

  const highlightY = useTransform(y, [minTopY, maxTopY], ["22%", "78%"]);
  const draggingOpacity = useTransform(y, () => (dragging ? 0.9 : 1));

  const dropletVisual = (
    <motion.div
      aria-hidden
      style={{ y, height: dropletHeight, opacity: draggingOpacity, ["--hlY" as any]: highlightY }}
      className="pointer-events-none absolute inset-x-2 top-0 z-0 rounded-full border border-white/14 bg-white/18 shadow-[0_12px_26px_rgba(0,0,0,0.14)] backdrop-blur-md dark:border-white/10 dark:bg-white/8 dark:shadow-[0_18px_44px_rgba(0,0,0,0.42)]"
    >
      <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120px 46px at 50% var(--hlY), rgba(255,255,255,0.22), rgba(255,255,255,0) 68%), linear-gradient(to bottom, rgba(255,255,255,0.10), rgba(255,255,255,0))"
          }}
        />
      </div>
    </motion.div>
  );

  const startPointerDrag = (e: React.PointerEvent) => {
    if (!groups.length) return;
    if (e.button !== 0) return;
    if (dragRef.current) return;

    const topY = yTarget.get();
    dragRef.current = {
      pointerId: e.pointerId,
      startClientY: e.clientY,
      startTopY: topY,
      started: false,
      lastClientY: e.clientY,
      lastT: performance.now(),
      vY: 0
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const movePointerDrag = (e: React.PointerEvent) => {
    const st = dragRef.current;
    if (!st || st.pointerId !== e.pointerId) return;

    const dy = e.clientY - st.startClientY;
    if (!st.started && Math.abs(dy) < 3) return;
    if (!st.started) {
      st.started = true;
      setDragging(true);
    }

    const now = performance.now();
    const dt = Math.max(1, now - st.lastT);
    st.vY = ((e.clientY - st.lastClientY) / dt) * 1000;
    st.lastClientY = e.clientY;
    st.lastT = now;

    const next = rubberBand(st.startTopY + dy);
    yTarget.set(next);

    const idx = indexFromTopY(next);
    const g = groups[idx];
    if (g && g.id !== selectedId) onSelect(g.id);
  };

  const endPointerDrag = (e: React.PointerEvent) => {
    const st = dragRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    dragRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

    if (!st.started) return;
    setDragging(false);

    const current = yTarget.get();
    const velocity = st.vY;

    const velocityFactor = 0.18;
    const projected = reduceMotion ? current : current + velocity * velocityFactor;
    const idx = indexFromTopY(projected);
    const g = groups[idx];
    if (g && g.id !== selectedId) onSelect(g.id);

    const target = snapYForIndex(idx);
    if (reduceMotion) yTarget.set(target);
    else animate(yTarget, target, { type: "spring", stiffness: 520, damping: 40, mass: 0.7, velocity });
  };

  return (
    <div className="glass w-full max-w-[240px] rounded-3xl border border-white/10 p-1.5 shadow-soft dark:border-white/10 dark:shadow-softDark">
      <div className="px-2.5 pb-1.5 pt-1.5 text-[11px] font-medium text-fg/70">分类</div>
      <div ref={containerRef} className="relative">
        <div
          style={{ height: Math.max(1, groups.length) * rowHeight }}
          className="relative select-none touch-none"
          onPointerDown={startPointerDrag}
          onPointerMove={movePointerDrag}
          onPointerUp={endPointerDrag}
          onPointerCancel={endPointerDrag}
        >
          {groups.length ? dropletVisual : null}
          <div className="relative z-10">
            {groups.map((g) => {
              const active = g.id === selectedId;
              return (
                <button
                  key={g.id}
                  type="button"
                  className={
                    "group flex w-full items-center justify-between rounded-2xl px-3 text-left transition-colors " +
                    (active ? "text-fg" : "text-fg/80 hover:text-fg") +
                    " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                  }
                  style={{ height: rowHeight }}
                  onClick={() => {
                    onSelect(g.id);
                    const idx = groups.findIndex((x) => x.id === g.id);
                    const target = snapYForIndex(idx >= 0 ? idx : 0);
                    if (reduceMotion) yTarget.set(target);
                    else animate(yTarget, target, { type: "spring", stiffness: 520, damping: 40, mass: 0.7 });
                  }}
                >
                  <div className="min-w-0">
                    <div className={"truncate text-xs font-medium " + (active ? "text-fg" : "")}>{g.name}</div>
                  </div>
                  {typeof g.count === "number" ? (
                    <div className={"text-[11px] tabular-nums " + (active ? "text-fg/80" : "text-muted")}>{g.count}</div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
