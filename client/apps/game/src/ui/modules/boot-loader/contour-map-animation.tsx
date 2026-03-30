import clsx from "clsx";

const CONTOUR_PATHS = [
  "M-120 88C34 26 138 34 248 82s212 78 347 43 258-118 389-121 245 73 391 70 259-88 419-110 300 30 433 84",
  "M-120 182c108-61 235-78 360-44s208 108 334 107 186-79 318-114 258 0 389 46 224 69 339 34 196-123 327-141 258 27 415 96",
  "M-120 298c127-43 251-32 384 8s221 83 334 59 181-116 305-159 272-19 412 24 231 88 348 72 201-109 341-152 281-19 426 32",
  "M-120 432c134-65 261-74 390-36s221 130 337 135 193-76 322-115 273-8 412 42 234 77 352 40 199-141 325-191 264-23 414 41",
  "M-120 566c119-31 233-7 366 34s241 83 365 58 209-118 336-168 273-35 418 8 257 111 385 109 202-92 320-141 260-35 426 37",
] as const;

type ContourMapAnimationProps = {
  className?: string;
};

export const ContourMapAnimation = ({ className }: ContourMapAnimationProps) => {
  return (
    <div className={clsx("boot-loader-contours absolute inset-0 overflow-hidden", className)} aria-hidden="true">
      <svg className="h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <radialGradient id="boot-loader-vignette" cx="50%" cy="48%" r="70%">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.72)" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="1440" height="900" fill="transparent" />

        {CONTOUR_PATHS.map((path, index) => {
          const groupClassName =
            index % 3 === 0
              ? "boot-loader-contour-group boot-loader-contour-group-a"
              : index % 3 === 1
                ? "boot-loader-contour-group boot-loader-contour-group-b"
                : "boot-loader-contour-group boot-loader-contour-group-c";

          return (
            <g key={path} className={groupClassName}>
              <path
                d={path}
                className="boot-loader-contour-line"
                style={{
                  animationDelay: `${index * -1.8}s`,
                  opacity: `${0.26 + index * 0.08}`,
                }}
              />
              <path
                d={path}
                className="boot-loader-contour-line boot-loader-contour-line-echo"
                style={{
                  transform: `translateY(${22 + index * 9}px)`,
                  animationDelay: `${index * -1.4}s`,
                  opacity: `${0.16 + index * 0.05}`,
                }}
              />
            </g>
          );
        })}

        <rect x="0" y="0" width="1440" height="900" fill="url(#boot-loader-vignette)" />
      </svg>
      <div className="boot-loader-grid absolute inset-0" />
    </div>
  );
};
