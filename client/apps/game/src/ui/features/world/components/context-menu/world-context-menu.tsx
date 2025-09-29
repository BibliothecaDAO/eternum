import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { CONTEXT_MENU_CONFIG } from "@/ui/config";
import { ContextMenuAction } from "@/types/context-menu";

const RADIAL_DEFAULTS = CONTEXT_MENU_CONFIG.radial;
const CLAMP_PADDING = CONTEXT_MENU_CONFIG.clampPadding ?? 12;

type RadialSegment = {
  action: ContextMenuAction;
  start: number;
  end: number;
  rawStart: number;
  rawEnd: number;
  mid: number;
  path: string;
  labelPosition: { x: number; y: number };
};

const polarToCartesian = (radius: number, angleDeg: number, center: number) => {
  const rad = (angleDeg * Math.PI) / 180;
  const x = center + Math.sin(rad) * radius;
  const y = center - Math.cos(rad) * radius;
  return { x, y };
};

const buildRingSegmentPath = (
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  center: number,
) => {
  const outerStart = polarToCartesian(outerRadius, startAngle, center);
  const outerEnd = polarToCartesian(outerRadius, endAngle, center);
  const innerEnd = polarToCartesian(innerRadius, endAngle, center);
  const innerStart = polarToCartesian(innerRadius, startAngle, center);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
};

const buildRadialSegments = (
  actions: ContextMenuAction[],
  innerRadius: number,
  outerRadius: number,
  gapDegrees: number,
): RadialSegment[] => {
  if (!actions.length) {
    return [];
  }

  const step = 360 / actions.length;
  const safeGap = Math.min(Math.max(gapDegrees, 0), Math.max(step - 6, 0));
  const halfGap = safeGap / 2;
  const center = outerRadius;
  const labelRadius = innerRadius + (outerRadius - innerRadius) * 0.65;

  return actions.map((action, index) => {
    const rawStart = index * step;
    const rawEnd = rawStart + step;
    const start = rawStart + halfGap;
    const end = rawEnd - halfGap;
    const mid = (start + end) / 2;

    return {
      action,
      start,
      end,
      rawStart,
      rawEnd,
      mid,
      path: buildRingSegmentPath(innerRadius, outerRadius, start, end, center),
      labelPosition: polarToCartesian(labelRadius, mid, center),
    };
  });
};

export const WorldContextMenu = () => {
  const contextMenu = useUIStore((state) => state.contextMenu);
  const closeContextMenu = useUIStore((state) => state.closeContextMenu);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hoveredActionRef = useRef<string | null>(null);

  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredActionId, setHoveredActionId] = useState<string | null>(null);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    hoveredActionRef.current = hoveredActionId;
  }, [hoveredActionId]);

  const radialConfig = useMemo(() => {
    const radius = contextMenu?.radialOptions?.radius ?? RADIAL_DEFAULTS.radius;
    const requestedInner = contextMenu?.radialOptions?.innerRadius ?? RADIAL_DEFAULTS.innerRadius;
    const innerRadius = Math.min(Math.max(requestedInner, 12), radius - 6);
    const selectRadius =
      contextMenu?.radialOptions?.selectRadius ?? Math.max(radius * 0.6, innerRadius + 16);

    return {
      radius,
      innerRadius,
      selectRadius,
      gapDegrees: contextMenu?.radialOptions?.gapDegrees ?? RADIAL_DEFAULTS.gapDegrees ?? 0,
      maxActions: contextMenu?.radialOptions?.maxActions ?? RADIAL_DEFAULTS.maxActions ?? 8,
    };
  }, [contextMenu]);

  const shouldUseRadial = useMemo(() => {
    if (!contextMenu) {
      return false;
    }
    if (contextMenu.layout === "list") {
      return false;
    }
    const actionCount = contextMenu.actions.length;
    if (actionCount === 0) {
      return false;
    }
    if (contextMenu.layout === "radial") {
      return true;
    }
    return actionCount <= radialConfig.maxActions;
  }, [contextMenu, radialConfig.maxActions]);

  const radialSegments = useMemo(() => {
    if (!contextMenu || !shouldUseRadial) {
      return [];
    }
    return buildRadialSegments(
      contextMenu.actions,
      radialConfig.innerRadius,
      radialConfig.radius,
      radialConfig.gapDegrees ?? 0,
    );
  }, [contextMenu, shouldUseRadial, radialConfig.innerRadius, radialConfig.radius, radialConfig.gapDegrees]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    const { x, y } = contextMenu.position;
    setPosition({ x, y });
    positionRef.current = { x, y };
    setHoveredActionId(null);
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }
      if (!menuRef.current.contains(event.target as Node)) {
        closeContextMenu();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [contextMenu, closeContextMenu]);

  useEffect(() => {
    if (!contextMenu || !menuRef.current) {
      return;
    }

    const rect = menuRef.current.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - CLAMP_PADDING;
    const maxY = window.innerHeight - rect.height - CLAMP_PADDING;
    const clampedX = Math.max(CLAMP_PADDING, Math.min(position.x, maxX));
    const clampedY = Math.max(CLAMP_PADDING, Math.min(position.y, maxY));

    if (clampedX !== position.x || clampedY !== position.y) {
      setPosition({ x: clampedX, y: clampedY });
    }
  }, [contextMenu, position]);

  useEffect(() => {
    if (!contextMenu || !shouldUseRadial || radialSegments.length === 0) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const center = positionRef.current;
      const dx = event.clientX - center.x;
      const dy = event.clientY - center.y;
      const distance = Math.hypot(dx, dy);

      if (distance < radialConfig.innerRadius) {
        if (hoveredActionRef.current !== null) {
          setHoveredActionId(null);
        }
        return;
      }

      const baseAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const normalized = (baseAngle + 360) % 360;
      const angleFromTop = (normalized + 90) % 360;

      const segment = radialSegments.find(
        (item) => angleFromTop >= item.rawStart && angleFromTop < item.rawEnd,
      );

      if (!segment) {
        setHoveredActionId(null);
        return;
      }

      if (hoveredActionRef.current !== segment.action.id) {
        setHoveredActionId(segment.action.id);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    const handleMouseDown = (event: MouseEvent) => {
      if (!shouldUseRadial) {
        return;
      }
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const hoveredId = hoveredActionRef.current;
      const segment = radialSegments.find((item) => item.action.id === hoveredId);

      if (segment && !segment.action.disabled) {
        segment.action.onSelect();
      }

      closeContextMenu();
    };

    document.addEventListener("mousedown", handleMouseDown, true);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mousedown", handleMouseDown, true);
    };
  }, [contextMenu, shouldUseRadial, radialSegments, radialConfig.innerRadius, closeContextMenu]);

  if (!contextMenu) {
    return null;
  }

  const handleSelect = (handler: () => void, disabled?: boolean) => () => {
    if (disabled) {
      return;
    }
    handler();
    closeContextMenu();
  };

  const containerStyle: CSSProperties = shouldUseRadial
    ? {
        top: position.y,
        left: position.x,
        width: radialConfig.radius * 2,
        height: radialConfig.radius * 2,
        transform: "translate(-50%, -50%)",
      }
    : { top: position.y, left: position.x };

  return (
    <div
      ref={menuRef}
      className="fixed z-40 pointer-events-auto"
      style={containerStyle}
      onContextMenu={(event) => event.preventDefault()}
      role="menu"
      aria-label={contextMenu.title ?? "Context menu"}
    >
      {shouldUseRadial && radialSegments.length > 0 ? (
        <div
          className="relative flex items-center justify-center text-white"
          style={{ width: radialConfig.radius * 2, height: radialConfig.radius * 2 }}
        >
          <svg
            width={radialConfig.radius * 2}
            height={radialConfig.radius * 2}
            className="absolute inset-0"
          >
            {radialSegments.map((segment) => {
              const isActive = segment.action.id === hoveredActionId;
              return (
                <path
                  key={segment.action.id}
                  d={segment.path}
                  fill={isActive ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.12)"}
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth={isActive ? 2 : 1}
                />
              );
            })}
          </svg>

          {radialSegments.map((segment) => {
            const isActive = segment.action.id === hoveredActionId;
            return (
              <div
                key={segment.action.id}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-1 backdrop-blur ${
                  isActive ? "bg-white/25" : "bg-black/60"
                }`}
                style={{
                  left: segment.labelPosition.x,
                  top: segment.labelPosition.y,
                }}
              >
                {segment.action.icon ? (
                  <img
                    src={segment.action.icon}
                    alt={segment.action.label}
                    title={segment.action.label}
                    className={`h-8 w-8 ${isActive ? "opacity-100" : "opacity-80"}`}
                  />
                ) : (
                  <span
                    className={`whitespace-nowrap text-xs font-semibold ${
                      isActive ? "text-white" : "text-white/70"
                    }`}
                  >
                    {segment.action.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="min-w-[200px] overflow-hidden rounded-xl border border-white/10 bg-black/85 text-sm text-white shadow-2xl backdrop-blur-md">
          {(contextMenu.title || contextMenu.subtitle) && (
            <div className="border-b border-white/10 px-4 py-3">
              {contextMenu.title && (
                <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
                  {contextMenu.title}
                </div>
              )}
              {contextMenu.subtitle && (
                <div className="text-[11px] text-white/50">{contextMenu.subtitle}</div>
              )}
            </div>
          )}
          <ul className="py-1">
            {contextMenu.actions.map((action) => (
              <li key={action.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-white/40"
                  onClick={handleSelect(action.onSelect, action.disabled)}
                  disabled={action.disabled}
                >
                  <span className="flex items-center gap-2">
                    {action.icon && (
                      <img src={action.icon} alt="" className="h-4 w-4 opacity-70" />
                    )}
                    {action.label}
                  </span>
                  {action.hint && <span className="text-xs text-white/40">{action.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
