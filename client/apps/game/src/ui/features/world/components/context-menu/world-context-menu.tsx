import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { ContextMenuAction, ContextMenuState } from "@/types/context-menu";
import { CONTEXT_MENU_CONFIG } from "@/ui/config";
import { useUISound } from "@/audio";

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
  const labelRadius = innerRadius + (outerRadius - innerRadius) * 0.5;

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
  const contextMenuStack = useUIStore((state) => state.contextMenuStack);
  const pushContextMenu = useUIStore((state) => state.pushContextMenu);
  const popContextMenu = useUIStore((state) => state.popContextMenu);
  const closeContextMenu = useUIStore((state) => state.closeContextMenu);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hoveredActionRef = useRef<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const playClickSound = useUISound("ui.click");
  const playHoverSound = useUISound("ui.hover");
  const playOpenSound = useUISound("ui.whoosh");

  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredActionId, setHoveredActionId] = useState<string | null>(null);
  const [isRadialActive, setIsRadialActive] = useState(false);
  const [segmentAnimationTrigger, setSegmentAnimationTrigger] = useState(0);
  const [menuRotation, setMenuRotation] = useState(0);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    hoveredActionRef.current = hoveredActionId;
    // Change cursor when hovering over a segment
    if (hoveredActionId) {
      document.body.style.cursor = "pointer";
    } else {
      document.body.style.cursor = "";
    }
  }, [hoveredActionId]);

  const triggerAction = useCallback(
    (action: ContextMenuAction) => {
      if (!contextMenu || action.disabled) {
        return;
      }

      playClickSound();

      if (action.children && action.children.length > 0) {
        const maxChildActions = contextMenu.radialOptions?.maxActions ?? RADIAL_DEFAULTS.maxActions ?? 8;
        const childLayout = action.children.length > maxChildActions ? "list" : contextMenu.layout;
        const childMenu: ContextMenuState = {
          id: `${contextMenu.id}::${action.id}`,
          title: action.childTitle ?? action.label,
          subtitle: action.childSubtitle ?? contextMenu.subtitle,
          position: contextMenu.position,
          scene: contextMenu.scene,
          actions: action.children,
          layout: childLayout,
          radialOptions: contextMenu.radialOptions,
          metadata: contextMenu.metadata,
        };
        pushContextMenu(childMenu);
        setHoveredActionId(null);
        hoveredActionRef.current = null;
        return;
      }

      action.onSelect();
      closeContextMenu();
    },
    [contextMenu, pushContextMenu, closeContextMenu, playClickSound],
  );

  const radialConfig = useMemo(() => {
    const radius = contextMenu?.radialOptions?.radius ?? RADIAL_DEFAULTS.radius;
    const requestedInner = contextMenu?.radialOptions?.innerRadius ?? RADIAL_DEFAULTS.innerRadius;
    const innerRadius = Math.min(Math.max(requestedInner, 12), radius - 6);
    const selectRadius = contextMenu?.radialOptions?.selectRadius ?? Math.max(radius * 0.6, innerRadius + 16);

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

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    playOpenSound();

    if (shouldUseRadial) {
      setIsRadialActive(false);
      setSegmentAnimationTrigger((prev) => prev + 1);
      // Add rotation wobble on open
      const wobbleAmount = 8;
      setMenuRotation(wobbleAmount);
      animationFrameRef.current = requestAnimationFrame(() => {
        setIsRadialActive(true);
        // Settle rotation back to 0
        setTimeout(() => setMenuRotation(0), 100);
      });
    } else {
      setIsRadialActive(false);
    }
  }, [contextMenu, shouldUseRadial, playOpenSound]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (contextMenuStack.length > 0) {
          popContextMenu();
        } else {
          closeContextMenu();
        }
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
  }, [contextMenu, contextMenuStack.length, closeContextMenu, popContextMenu]);

  useEffect(() => {
    if (!contextMenu || !menuRef.current) {
      return;
    }

    // For radial menus, position represents the visual center (due to translate(-50%, -50%))
    // So positionRef should always store the visual center for accurate hover calculations
    if (shouldUseRadial) {
      const rect = menuRef.current.getBoundingClientRect();
      // Get the actual visual center from the DOM
      const visualCenterX = rect.left + rect.width / 2;
      const visualCenterY = rect.top + rect.height / 2;

      // Update ref with the actual rendered center position
      positionRef.current = { x: visualCenterX, y: visualCenterY };
      return;
    }

    const rect = menuRef.current.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - CLAMP_PADDING;
    const maxY = window.innerHeight - rect.height - CLAMP_PADDING;
    const clampedX = Math.max(CLAMP_PADDING, Math.min(position.x, maxX));
    const clampedY = Math.max(CLAMP_PADDING, Math.min(position.y, maxY));

    if (clampedX !== position.x || clampedY !== position.y) {
      setPosition({ x: clampedX, y: clampedY });
      positionRef.current = { x: clampedX, y: clampedY };
    }
  }, [contextMenu, position, shouldUseRadial]);

  useEffect(() => {
    if (!contextMenu || !shouldUseRadial || radialSegments.length === 0) {
      return;
    }
    const handleMouseDown = (event: MouseEvent) => {
      if (!shouldUseRadial) {
        return;
      }
      if (event.button !== 0 && event.button !== 2) {
        return;
      }

      const center = positionRef.current;
      const dx = event.clientX - center.x;
      const dy = event.clientY - center.y;
      const distance = Math.hypot(dx, dy);

      if (distance < radialConfig.innerRadius) {
        event.preventDefault();
        event.stopPropagation();

        playClickSound();

        if (contextMenuStack.length > 0) {
          popContextMenu();
        } else {
          closeContextMenu();
        }
        return;
      }

      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const baseAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const normalized = (baseAngle + 360) % 360;
      const angleFromTop = (normalized + 90) % 360;

      const segment = radialSegments.find((item) => angleFromTop >= item.rawStart && angleFromTop < item.rawEnd);

      if (!segment) {
        closeContextMenu();
        return;
      }

      triggerAction(segment.action);
    };

    document.addEventListener("mousedown", handleMouseDown, true);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown, true);
    };
  }, [
    contextMenu,
    shouldUseRadial,
    radialSegments,
    radialConfig.innerRadius,
    contextMenuStack.length,
    popContextMenu,
    closeContextMenu,
    triggerAction,
    playClickSound,
  ]);

  const handleContainerMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!shouldUseRadial || radialSegments.length === 0) return;

      const center = positionRef.current;
      const dx = event.clientX - center.x;
      const dy = event.clientY - center.y;
      const distance = Math.hypot(dx, dy);

      if (distance < radialConfig.innerRadius || distance > radialConfig.radius) {
        if (hoveredActionRef.current !== null) {
          setHoveredActionId(null);
        }
        hoveredActionRef.current = null;
        return;
      }

      const baseAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const normalized = (baseAngle + 360) % 360;
      const angleFromTop = (normalized + 90) % 360;

      const segment = radialSegments.find((item) => angleFromTop >= item.rawStart && angleFromTop < item.rawEnd);

      if (!segment) {
        setHoveredActionId(null);
        hoveredActionRef.current = null;
        return;
      }

      if (hoveredActionRef.current !== segment.action.id) {
        setHoveredActionId(segment.action.id);
        hoveredActionRef.current = segment.action.id;
        playHoverSound();
      }
    },
    [shouldUseRadial, radialSegments, radialConfig.innerRadius, radialConfig.radius, playHoverSound],
  );

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // Reset cursor when component unmounts
      document.body.style.cursor = "";
    };
  }, []);

  if (!contextMenu) {
    return null;
  }

  const containerStyle: CSSProperties = shouldUseRadial
    ? {
        top: position.y,
        left: position.x,
        width: radialConfig.radius * 2,
        height: radialConfig.radius * 2,
        transform: `translate(-50%, -50%) scale(${isRadialActive ? 1 : 0.9})`,
        opacity: isRadialActive ? 1 : 0,
        transition: "transform 160ms ease-out, opacity 160ms ease-out",
      }
    : { top: position.y, left: position.x };

  return (
    <div
      ref={menuRef}
      className="fixed z-40 pointer-events-auto"
      style={containerStyle}
      onContextMenu={(event) => event.preventDefault()}
      onMouseMove={handleContainerMouseMove}
      role="menu"
      aria-label={contextMenu.title ?? "Context menu"}
    >
      {shouldUseRadial && radialSegments.length > 0 ? (
        <div
          className="relative flex items-center justify-center  pointer-events-none"
          style={{
            width: radialConfig.radius * 2,
            height: radialConfig.radius * 2,
            transform: `rotate(${menuRotation}deg)`,
            transition: "transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {/* Ripple effect rings */}
          {isRadialActive && (
            <>
              <div
                className="absolute rounded-full border border-gold/30"
                style={{
                  width: radialConfig.innerRadius * 2,
                  height: radialConfig.innerRadius * 2,
                  animation: "ripple 1.2s ease-out forwards",
                }}
              />
              <div
                className="absolute rounded-full border border-gold/20"
                style={{
                  width: radialConfig.innerRadius * 2,
                  height: radialConfig.innerRadius * 2,
                  animation: "ripple 1.2s ease-out 0.15s forwards",
                }}
              />
              <div
                className="absolute rounded-full border border-gold/10"
                style={{
                  width: radialConfig.innerRadius * 2,
                  height: radialConfig.innerRadius * 2,
                  animation: "ripple 1.2s ease-out 0.3s forwards",
                }}
              />
            </>
          )}

          <svg
            width={radialConfig.radius * 2}
            height={radialConfig.radius * 2}
            className="absolute inset-0 pointer-events-none"
          >
            {/* Outer ring border */}
            <circle
              cx={radialConfig.radius}
              cy={radialConfig.radius}
              r={radialConfig.radius - 1}
              fill="none"
              stroke="rgba(255,212,170,0.3)"
              strokeWidth={1}
              style={{
                opacity: 0,
                animation: "segmentFadeIn 300ms ease-out forwards",
              }}
            />

            {/* Inner circle border */}
            <circle
              cx={radialConfig.radius}
              cy={radialConfig.radius}
              r={radialConfig.innerRadius}
              fill="rgba(0,0,0,0.5)"
              stroke="rgba(255,212,170,0.25)"
              strokeWidth={1.5}
              style={{
                opacity: 0,
                animation: "segmentFadeIn 300ms ease-out forwards",
              }}
            />

            {radialSegments.map((segment, index) => {
              const isActive = segment.action.id === hoveredActionId;
              const delayMs = index * 40; // Stagger delay per segment
              return (
                <g key={`${segment.action.id}-${segmentAnimationTrigger}`}>
                  {/* Base segment with darker background */}
                  <path
                    d={segment.path}
                    fill={isActive ? "rgba(255,212,170,0.35)" : "rgba(255,212,170,0.18)"}
                    stroke="rgba(255,255,255,0.25)"
                    strokeWidth={isActive ? 2.5 : 1.5}
                    style={{
                      transition: "fill 140ms ease, stroke-width 140ms ease, stroke 140ms ease",
                      filter: isActive ? "drop-shadow(0 0 8px rgba(255,212,170,0.4))" : "none",
                      opacity: 0,
                      animation: `segmentFadeIn 300ms ease-out ${delayMs}ms forwards`,
                    }}
                  />
                  {/* Inner glow line for active segment */}
                  {isActive && (
                    <path
                      d={segment.path}
                      fill="none"
                      stroke="rgba(255,212,170,0.6)"
                      strokeWidth={1}
                      style={{
                        filter: "blur(2px)",
                        opacity: 0.7,
                      }}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {contextMenuStack.length > 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-full border border-gold/15 bg-black/45 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gold/60">
                Back
              </div>
            </div>
          )}

          {radialSegments.map((segment, index) => {
            const isActive = segment.action.id === hoveredActionId;
            const delayMs = index * 40; // Match segment stagger
            const sharedTransition =
              "transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 160ms ease, opacity 160ms ease, box-shadow 160ms ease";

            return (
              <div
                key={`${segment.action.id}-label-${segmentAnimationTrigger}`}
                className="absolute pointer-events-none"
                style={{
                  left: segment.labelPosition.x,
                  top: segment.labelPosition.y,
                  transform: "translate(-50%, -50%)",
                  opacity: 0,
                  animation: `radialLabelFadeIn 280ms ease-out ${delayMs}ms forwards`,
                }}
              >
                <div
                  className={`flex items-center justify-center rounded-full px-2 py-1 backdrop-blur-sm pointer-events-none ${
                    isActive ? "bg-black/75" : "bg-black/75"
                  }`}
                  style={{
                    transform: `rotate(${-menuRotation}deg) scale(${isActive ? 1.05 : 1})`,
                    transition: sharedTransition,
                    border: isActive ? "1px solid rgba(255,212,170,0.4)" : "1px solid rgba(255,212,170,0.15)",
                  }}
                >
                  {segment.action.icon ? (
                    <img
                      src={segment.action.icon}
                      alt={segment.action.label}
                      title={segment.action.label}
                      className={`h-10 w-10 ${isActive ? "opacity-100" : "opacity-90"}`}
                      style={{
                        transition: "opacity 160ms ease, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                        transform: isActive ? "scale(1.12)" : "scale(1)",
                      }}
                    />
                  ) : (
                    <span
                      className={`whitespace-nowrap text-xs font-semibold ${isActive ? "text-gold" : "text-gold/85"}`}
                      style={{
                        transition: "color 160ms ease, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                        display: "inline-block",
                        transform: isActive ? "scale(1.12)" : "scale(1)",
                      }}
                    >
                      {segment.action.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="min-w-[200px] overflow-hidden rounded-xl border border-gold/10 bg-black/85 text-sm text-gold shadow-2xl backdrop-blur-md">
          {(contextMenu.title || contextMenu.subtitle) && (
            <div className="border-b border-white/10 px-4 py-3">
              {contextMenu.title && (
                <div className="text-xs font-semibold uppercase tracking-wide text-gold/70">{contextMenu.title}</div>
              )}
              {contextMenu.subtitle && <div className="text-[11px] text-gold/50">{contextMenu.subtitle}</div>}
            </div>
          )}
          <ul className="py-1">
            {contextMenu.actions.map((action) => (
              <li key={action.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition hover:bg-gold/10 disabled:cursor-not-allowed disabled:text-gold/40"
                  onClick={() => triggerAction(action)}
                  onMouseEnter={playHoverSound}
                  onFocus={playHoverSound}
                  disabled={action.disabled}
                >
                  <span className="flex items-center gap-2">
                    {action.icon && <img src={action.icon} alt="" className="h-4 w-4 opacity-70" />}
                    {action.label}
                  </span>
                  {action.children && action.children.length > 0 ? (
                    <span className="text-xs text-gold/40">›</span>
                  ) : action.hint ? (
                    <span className="text-xs text-gold/40">{action.hint}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
