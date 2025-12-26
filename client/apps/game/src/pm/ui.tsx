import type { HTMLAttributes } from "react";
import React, { createContext, useContext, useId } from "react";
import * as RechartsPrimitive from "recharts";
import type { LegendPayload, VerticalAlignmentType } from "recharts/types/component/DefaultLegendContent";

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");

type DivProps = HTMLAttributes<HTMLDivElement>;

type HeadingProps = HTMLAttributes<HTMLHeadingElement>;

export const Card = ({ className, ...props }: DivProps) => (
  <div {...props} className={cx("rounded-lg border border-white/10 bg-black/40 p-4 text-white", className)} />
);

export const CardHeader = ({ className, ...props }: DivProps) => <div {...props} className={cx("mb-2", className)} />;

export const CardTitle = ({ className, ...props }: HeadingProps) => (
  <h3 {...props} className={cx("text-lg font-semibold", className)} />
);

export const CardContent = ({ className, ...props }: DivProps) => (
  <div {...props} className={cx("flex flex-col gap-2", className)} />
);

export const CardDescription = ({ className, ...props }: DivProps) => (
  <div {...props} className={cx("text-sm text-white/70", className)} />
);

export const Container = ({ className, ...props }: DivProps) => (
  <div {...props} className={cx("flex flex-col w-full", className)} />
);

export const HStack = ({ className, ...props }: DivProps) => (
  <div {...props} className={cx("flex items-center", className)} />
);

export const VStack = ({ className, ...props }: DivProps) => (
  <div {...props} className={cx("flex flex-col", className)} />
);

export const ScrollArea = ({ className, ...props }: DivProps) => (
  <div {...props} className={cx("overflow-y-auto", className)} />
);

// Chart primitives (adapted from the PM web UI library)
export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & ({ color?: string; theme?: never } | { color?: never; theme: Record<"light" | "dark", string> });
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = createContext<ChartContextProps | null>(null);

const THEMES = { light: "", dark: ".dark" } as const;

export const ChartContainer = ({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) => {
  const uniqueId = useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cx(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border flex w-full justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
};

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(([, item]) => item.theme || item.color);
  if (colorConfig.length === 0) return null;

  const styles = Object.entries(THEMES)
    .map(([theme, prefix]) => {
      const lines = colorConfig
        .map(([key, itemConfig]) => {
          const color = itemConfig.theme?.[theme as keyof typeof THEMES] || itemConfig.color;
          return color ? `  --color-${key}: ${color};` : null;
        })
        .filter(Boolean)
        .join("\n");
      return `${prefix} [data-chart=${id}] {\n${lines}\n}`;
    })
    .join("\n");

  return <style dangerouslySetInnerHTML={{ __html: styles }} />;
};

export const ChartTooltip = RechartsPrimitive.Tooltip;

export const ChartLegend = RechartsPrimitive.Legend;

export const ChartLegendContent = ({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey,
  mouseEnter,
  mouseLeave,
  onItemClick,
}: React.ComponentProps<"div"> & {
  payload?: ReadonlyArray<LegendPayload>;
  verticalAlign?: VerticalAlignmentType;
  hideIcon?: boolean;
  nameKey?: string;
  mouseEnter?: (e: LegendPayload) => void;
  mouseLeave?: (e: LegendPayload) => void;
  onItemClick?: (e: LegendPayload) => void;
}) => {
  const { config } = useChart();

  if (!payload?.length) return null;

  return (
    <div className={cx("flex items-center justify-center gap-4", verticalAlign === "top" ? "pb-3" : "pt-3", className)}>
      {payload.map((item) => {
        const key = `${nameKey || item.dataKey || "value"}`;
        const itemConfig = getPayloadConfigFromPayload(config, item, key);

        return (
          <div
            onMouseEnter={() => mouseEnter?.(item)}
            onMouseLeave={() => mouseLeave?.(item)}
            onClick={() => onItemClick?.(item)}
            key={item.value}
            className={cx("flex items-center gap-1.5", onItemClick && "cursor-pointer")}
          >
            {!hideIcon ? (
              itemConfig?.icon ? (
                <itemConfig.icon />
              ) : (
                <div className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: (item as any).color }} />
              )
            ) : null}
            {itemConfig?.label ?? item.value}
          </div>
        );
      })}
    </div>
  );
};

const useChart = () => {
  const context = useContext(ChartContext);
  if (!context) throw new Error("useChart must be used within a <ChartContainer />");
  return context;
};

const getPayloadConfigFromPayload = (config: ChartConfig, payload: unknown, key: string) => {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const payloadPayload =
    "payload" in payload && typeof (payload as any).payload === "object" && (payload as any).payload !== null
      ? (payload as any).payload
      : undefined;

  let configLabelKey: string = key;

  if (key in (payload as any) && typeof (payload as any)[key] === "string") {
    configLabelKey = (payload as any)[key] as string;
  } else if (payloadPayload && key in payloadPayload && typeof payloadPayload[key] === "string") {
    configLabelKey = payloadPayload[key] as string;
  }

  return configLabelKey in config ? config[configLabelKey] : config[key];
};
