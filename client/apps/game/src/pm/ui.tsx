import type { HTMLAttributes } from "react";
import React, { createContext, useContext, useId, useMemo } from "react";
import * as RechartsPrimitive from "recharts";
import type {
  LegendPayload,
  VerticalAlignmentType,
} from "recharts/types/component/DefaultLegendContent";
import type { NameType, Payload as TooltipPayload, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { TooltipContentProps } from "recharts/types/component/Tooltip";

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");

type DivProps = HTMLAttributes<HTMLDivElement>;

type HeadingProps = HTMLAttributes<HTMLHeadingElement>;

export const Card = ({ className, ...props }: DivProps) => (
  <div
    {...props}
    className={cx("rounded-lg border border-white/10 bg-black/40 p-4 text-white", className)}
  />
);

export const CardHeader = ({ className, ...props }: DivProps) => (
  <div {...props} className={cx("mb-2", className)} />
);

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
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<"light" | "dark", string> }
  );
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

export const ChartTooltipContent = ({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
  ...divProps
}: Omit<TooltipContentProps<ValueType, NameType>, "payload"> &
  React.ComponentProps<"div"> & {
    payload?: ReadonlyArray<TooltipPayload<ValueType, NameType>>;
    hideLabel?: boolean;
    hideIndicator?: boolean;
    indicator?: "line" | "dot" | "dashed";
    nameKey?: string;
    labelKey?: string;
    color?: string;
  }) => {
  const { config } = useChart();

  const tooltipLabel = useMemo(() => {
    if (hideLabel || !payload?.length) return null;
    const [item] = payload;
    const key = `${labelKey || item?.dataKey || item?.name || "value"}`;
    const itemConfig = getPayloadConfigFromPayload(config, item, key);
    const value =
      !labelKey && typeof label === "string"
        ? config[label as keyof typeof config]?.label || label
        : itemConfig?.label;

    if (labelFormatter) {
      return (
        <div className={cx("font-medium", labelClassName)}>
          {labelFormatter(value, payload as any)}
        </div>
      );
    }

    if (!value) return null;
    return <div className={cx("font-medium", labelClassName)}>{value}</div>;
  }, [hideLabel, payload, labelKey, label, config, labelClassName, labelFormatter]);

  if (!active || !payload?.length) return null;

  const nestLabel = payload.length === 1 && indicator !== "dot";

  return (
    <div
      {...divProps}
      className={cx(
        "border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl",
        className,
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key = `${nameKey || item.name || item.dataKey || "value"}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);
          const indicatorColor = color || item.payload.fill || (item as any).color;
          const value = item.value;
          const itemKey =
            typeof item.dataKey === "function" || item.dataKey === undefined || item.dataKey === null
              ? index
              : item.dataKey;

          return (
            <div
              key={itemKey as React.Key}
              className={cx(
                "[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5",
                indicator === "dot" ? "items-center" : undefined,
              )}
            >
              {!hideIndicator ? (
                <div
                  className={cx(
                    "shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)",
                    indicator === "dot" && "h-2.5 w-2.5",
                    indicator === "line" && "w-1",
                    indicator === "dashed" && "w-0 border-[1.5px] border-dashed bg-transparent",
                    nestLabel && indicator === "dashed" ? "my-0.5" : undefined,
                  )}
                  style={
                    {
                      "--color-bg": indicatorColor,
                      "--color-border": indicatorColor,
                    } as React.CSSProperties
                  }
                />
              ) : null}
              <div className={cx("flex flex-1 justify-between leading-none", nestLabel ? "items-end" : "items-center")}>
                <div className="grid gap-1.5">
                  {nestLabel ? tooltipLabel : null}
                  <span className="text-muted-foreground">{itemConfig?.label || item.name}</span>
                </div>
                {value != null ? (
                  <span className="text-foreground font-mono font-medium tabular-nums">
                    {typeof value === "number" ? value.toLocaleString() : value}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ChartLegend = RechartsPrimitive.Legend;

export const ChartLegendContent = ({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey,
  mouseEnter,
  mouseLeave,
}: React.ComponentProps<"div"> &
  {
    payload?: ReadonlyArray<LegendPayload>;
    verticalAlign?: VerticalAlignmentType;
    hideIcon?: boolean;
    nameKey?: string;
    mouseEnter?: (e: LegendPayload) => void;
    mouseLeave?: (e: LegendPayload) => void;
  }) => {
  const { config } = useChart();

  if (!payload?.length) return null;

  return (
    <div
      className={cx(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className,
      )}
    >
      {payload.map((item) => {
        const key = `${nameKey || item.dataKey || "value"}`;
        const itemConfig = getPayloadConfigFromPayload(config, item, key);

        return (
          <div
            onMouseEnter={() => mouseEnter?.(item)}
            onMouseLeave={() => mouseLeave?.(item)}
            key={item.value}
            className="flex items-center gap-1.5"
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
