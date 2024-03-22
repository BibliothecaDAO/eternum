import React from "react";
import useUIStore from "../../../hooks/store/useUIStore";
import clsx from "clsx";
import { Resource } from "@bibliothecadao/eternum";
import { ResourceCost } from "../../../elements/ResourceCost";
import { divideByPrecision } from "../../../utils/utils";

type ArmyMenuProps = {
  entityId: bigint;
};

const explorationCost: Resource[] = [
  {
    resourceId: 254,
    amount: 300000,
  },
  { resourceId: 255, amount: 150000 },
];

export const ArmyMenu = ({ entityId }: ArmyMenuProps) => {
  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const setIsTravelMode = useUIStore((state) => state.setIsTravelMode);
  const isTravelMode = useUIStore((state) => state.isTravelMode);
  const setIsExploreMode = useUIStore((state) => state.setIsExploreMode);
  const isExploreMode = useUIStore((state) => state.isExploreMode);
  const setIsAttackMode = useUIStore((state) => state.setIsAttackMode);
  const isAttackMode = useUIStore((state) => state.isAttackMode);

  return (
    <div
      className={clsx(
        "flex space-x-0.5 -translate-x-1/2 transition-all duration-200",
        selectedEntity?.id === entityId ? "opacity-100" : "opacity-0 translate-y-1/2",
      )}
    >
      <div
        className={clsx(
          "relative group/icon transition-opacity duration-200",
          isAttackMode || isExploreMode ? "opacity-30" : "opacity-100",
        )}
        onClick={(e) => {
          e.stopPropagation();
          if (isTravelMode) {
            setIsTravelMode(false);
            setIsExploreMode(false);
            setIsAttackMode(false);
          } else {
            setIsTravelMode(true);
            setIsExploreMode(false);
            setIsAttackMode(false);
          }
        }}
      >
        <TravelIcon />
        <div
          className={clsx(
            "absolute left-1/2 -bottom-1 opacity-0 transition-all translate-y-[150%] duration-200 -translate-x-1/2 rounded-lg bg-black text-white border border-white p-2 text-sm",
            "group-hover/icon:opacity-100 group-hover/icon:translate-y-full",
            isTravelMode && "opacity-100 !translate-y-full",
          )}
        >
          Travel
        </div>
      </div>
      <div
        className={clsx(
          "-translate-y-1/2 relative group/icon transition-opacity duration-200",
          isTravelMode || isExploreMode ? "opacity-30" : "opacity-100",
        )}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div
          className={clsx(
            "absolute left-1/2 -top-1 opacity-0 transition-all -translate-y-[150%] duration-200 -translate-x-1/2 rounded-lg bg-black text-white border border-white p-2 text-sm",
            "group-hover/icon:opacity-100 group-hover/icon:-translate-y-full",
            isAttackMode && "opacity-100 -translate-y-full",
          )}
        >
          Attack
        </div>
        <AttackIcon />
      </div>
      <div
        className={clsx(
          "relative group/icon transition-opacity duration-200",
          isAttackMode || isTravelMode ? "opacity-30" : "opacity-100",
        )}
        onClick={(e) => {
          e.stopPropagation();
          if (isExploreMode) {
            setIsTravelMode(false);
            setIsExploreMode(false);
            setIsAttackMode(false);
          } else {
            setIsTravelMode(false);
            setIsExploreMode(true);
            setIsAttackMode(false);
          }
        }}
      >
        <ExploreIcon />
        <div
          className={clsx(
            "absolute flex flex-col items-center justify-center left-1/2 -bottom-1 opacity-0 transition-all translate-y-[150%] duration-200 -translate-x-1/2 rounded-lg bg-black text-white border border-white p-2 text-sm",
            "group-hover/icon:opacity-100 group-hover/icon:translate-y-full",
            isAttackMode && "opacity-100 translate-y-full",
          )}
        >
          Explore
          <div className="flex space-x-1 mt-1">
            {explorationCost.map((res) => {
              return (
                <ResourceCost
                  key={res.resourceId}
                  type="vertical"
                  resourceId={res.resourceId}
                  amount={divideByPrecision(res.amount)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const TravelIcon = (props: any) => (
  <svg
    width="47"
    height="47"
    className="group"
    viewBox="0 0 47 47"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle
      cx="23.1152"
      cy="23.7261"
      r="22.5"
      className="group-hover:stroke-white"
      fill="url(#paint0_linear_4226_88486)"
      stroke="url(#paint1_linear_4226_88486)"
    />
    <circle cx="23.1152" cy="23.7261" r="17" fill="url(#paint2_linear_4226_88486)" />
    <circle cx="23.1152" cy="23.7261" r="17" fill="url(#paint3_radial_4226_88486)" fillOpacity="0.2" />
    <g clipPath="url(#clip0_4226_88486)">
      <g>
        <path
          d="M27.3434 17.0448L27.1527 16.2792L26.3996 16.5073L21.334 18.0385C17.6402 19.1542 15.1152 22.5573 15.1152 26.4135V31.476V32.226H15.8652H26.1152H27.4277L26.7621 31.0948L24.9184 27.9604L25.8027 28.9698L26.0277 29.226H26.3652H28.8652H29.2402L29.4652 28.926L30.9652 26.926L31.1996 26.6104L31.0746 26.2385L29.3246 20.9885L29.209 20.6323L28.8527 20.5135L27.2715 19.9885L27.4527 19.8979L27.9902 19.6292L27.8434 19.0448L27.3434 17.0448ZM19.9934 26.551C20.7871 27.501 21.9621 27.951 23.1121 27.851L24.8027 30.726H16.6152V26.4135C16.6152 23.2167 18.709 20.3979 21.7684 19.4729L26.0809 18.1698L26.2402 18.8229L25.2809 19.3042L24.8652 19.5135V19.976V20.226V20.7667L25.3777 20.9385L28.0215 21.8198L29.5277 26.3417L28.4902 27.726H26.7059L25.1809 25.9823L24.7152 25.451L24.1559 25.8854L24.1184 25.9135C23.2027 26.626 21.8902 26.4823 21.1465 25.5917L20.4402 24.7448L19.959 24.1698L18.8059 25.1292L19.2871 25.7042L19.9934 26.551ZM24.3652 23.226C24.4637 23.226 24.5613 23.2067 24.6522 23.169C24.7432 23.1313 24.8259 23.076 24.8956 23.0064C24.9652 22.9367 25.0205 22.8541 25.0581 22.7631C25.0958 22.6721 25.1152 22.5745 25.1152 22.476C25.1152 22.3776 25.0958 22.28 25.0581 22.189C25.0205 22.098 24.9652 22.0154 24.8956 21.9457C24.8259 21.8761 24.7432 21.8208 24.6522 21.7831C24.5613 21.7454 24.4637 21.726 24.3652 21.726C24.2667 21.726 24.1692 21.7454 24.0782 21.7831C23.9872 21.8208 23.9045 21.8761 23.8349 21.9457C23.7653 22.0154 23.71 22.098 23.6723 22.189C23.6346 22.28 23.6152 22.3776 23.6152 22.476C23.6152 22.5745 23.6346 22.6721 23.6723 22.7631C23.71 22.8541 23.7653 22.9367 23.8349 23.0064C23.9045 23.076 23.9872 23.1313 24.0782 23.169C24.1692 23.2067 24.2667 23.226 24.3652 23.226Z"
          fill="url(#paint4_linear_4226_88486)"
          className="group-hover:fill-white"
          shapeRendering="crispEdges"
        />
      </g>
    </g>
    <defs>
      <filter
        id="filter0_di_4226_88486"
        x="13.1152"
        y="16.2792"
        width="20.084"
        height="19.9469"
        filterUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset dy="2" />
        <feGaussianBlur stdDeviation="1" />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.55 0" />
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_4226_88486" />
        <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_4226_88486" result="shape" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset dy="1" />
        <feGaussianBlur stdDeviation="0.5" />
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.878431 0 0 0 0 0.686275 0 0 0 0 0.396078 0 0 0 1 0" />
        <feBlend mode="normal" in2="shape" result="effect2_innerShadow_4226_88486" />
      </filter>
      <linearGradient
        id="paint0_linear_4226_88486"
        x1="23.1152"
        y1="1.72607"
        x2="23.1152"
        y2="45.7261"
        gradientUnits="userSpaceOnUse"
      >
        <stop />
        <stop offset="1" stopColor="#150903" />
      </linearGradient>
      <linearGradient
        id="paint1_linear_4226_88486"
        x1="23.1152"
        y1="1.72607"
        x2="23.1152"
        y2="45.7261"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#E0AF65" stopOpacity="0.36" />
        <stop offset="1" stopColor="#E0AF65" />
      </linearGradient>
      <linearGradient
        id="paint2_linear_4226_88486"
        x1="23.1152"
        y1="6.72607"
        x2="23.1152"
        y2="40.7261"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#4B413C" />
        <stop offset="1" stopColor="#24130A" />
      </linearGradient>
      <radialGradient
        id="paint3_radial_4226_88486"
        cx="0"
        cy="0"
        r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="translate(23.1152 6.72607) rotate(90) scale(17)"
      >
        <stop stopColor="white" />
        <stop offset="1" stopColor="white" stopOpacity="0" />
      </radialGradient>
      <linearGradient
        id="paint4_linear_4226_88486"
        x1="23.1574"
        y1="16.2792"
        x2="23.1574"
        y2="32.226"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#E0AF65" stopOpacity="0.47" />
        <stop offset="0.765625" stopColor="#E0AF65" />
        <stop offset="1" stopColor="#F4D9B1" />
      </linearGradient>
      <clipPath id="clip0_4226_88486">
        <rect width="20" height="16" fill="white" transform="translate(13.1152 16.2261)" />
      </clipPath>
    </defs>
  </svg>
);

const ExploreIcon = (props: any) => (
  <svg
    width="47"
    height="47"
    className="group"
    viewBox="0 0 47 47"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle
      cx="23.7891"
      cy="23.6902"
      r="22.5"
      fill="url(#paint0_linear_4226_88512)"
      stroke="url(#paint1_linear_4226_88512)"
      className="group-hover:stroke-white"
    />
    <circle cx="23.7891" cy="23.6902" r="17" fill="url(#paint2_linear_4226_88512)" />
    <circle cx="23.7891" cy="23.6902" r="17" fill="url(#paint3_radial_4226_88512)" fillOpacity="0.2" />
    <circle cx="23.7891" cy="23.6902" r="16.5" stroke="url(#paint4_linear_4226_88512)" strokeOpacity="0.12" />
    <g clipPath="url(#clip0_4226_88512)">
      <g>
        <path
          d="M29.0004 24.1902C28.2879 24.1902 27.6129 24.0402 27.0004 23.7746V28.1902H25.7504V22.9902C25.4722 22.7527 25.2191 22.4839 25.0004 22.1902H23.7504V28.1902H22.2504V22.1902H20.2504V28.1902H19.0004V22.1902H17.0004V28.3246C16.9816 28.3339 16.9629 28.3464 16.9441 28.3589L15.4441 29.3589C15.0785 29.6027 14.9129 30.0589 15.041 30.4808C15.1691 30.9027 15.5597 31.1902 16.0004 31.1902H30.0004C30.441 31.1902 30.8285 30.9027 30.9566 30.4808C31.0847 30.0589 30.9222 29.6027 30.5535 29.3589L29.0535 28.3589C29.0347 28.3464 29.016 28.3371 28.9972 28.3246V24.1902H29.0004ZM16.0004 21.1902H24.416C24.1472 20.5777 24.0004 19.9027 24.0004 19.1902C24.0004 18.0621 24.3754 17.0214 25.0035 16.1839L23.4972 15.3214C23.191 15.1464 22.8129 15.1464 22.5035 15.3214L17.1379 18.3902L17.0004 18.4402V18.4683L15.5035 19.3214C15.1097 19.5464 14.916 20.0089 15.0316 20.4464C15.1472 20.8839 15.5472 21.1902 16.0004 21.1902ZM29.0004 16.6933C29.6634 16.6933 30.2993 16.9567 30.7681 17.4255C31.237 17.8944 31.5004 18.5303 31.5004 19.1933C31.5004 19.8564 31.237 20.4922 30.7681 20.9611C30.2993 21.4299 29.6634 21.6933 29.0004 21.6933C28.3373 21.6933 27.7014 21.4299 27.2326 20.9611C26.7638 20.4922 26.5004 19.8564 26.5004 19.1933C26.5004 18.5303 26.7638 17.8944 27.2326 17.4255C27.7014 16.9567 28.3373 16.6933 29.0004 16.6933ZM29.0004 23.1933C29.8347 23.1933 30.6066 22.9371 31.2472 22.5027L33.7191 24.9746C34.0129 25.2683 34.4879 25.2683 34.7785 24.9746C35.0691 24.6808 35.0722 24.2058 34.7785 23.9152L32.3066 21.4433C32.7441 20.8027 32.9972 20.0277 32.9972 19.1964C32.9972 16.9871 31.2066 15.1964 28.9972 15.1964C26.7879 15.1964 24.9972 16.9871 24.9972 19.1964C24.9972 21.4058 26.7879 23.1964 28.9972 23.1964L29.0004 23.1933Z"
          fill="url(#paint5_linear_4226_88512)"
          className="group-hover:fill-white"
        />
      </g>
    </g>
    <defs>
      <filter
        id="filter0_di_4226_88512"
        x="12.998"
        y="15.1902"
        width="24"
        height="20"
        filterUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset dy="2" />
        <feGaussianBlur stdDeviation="1" />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.55 0" />
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_4226_88512" />
        <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_4226_88512" result="shape" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset dy="1" />
        <feGaussianBlur stdDeviation="0.5" />
        <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.878431 0 0 0 0 0.686275 0 0 0 0 0.396078 0 0 0 1 0" />
        <feBlend mode="normal" in2="shape" result="effect2_innerShadow_4226_88512" />
      </filter>
      <linearGradient
        id="paint0_linear_4226_88512"
        x1="23.7891"
        y1="1.69019"
        x2="23.7891"
        y2="45.6902"
        gradientUnits="userSpaceOnUse"
      >
        <stop />
        <stop offset="1" stopColor="#150903" />
      </linearGradient>
      <linearGradient
        id="paint1_linear_4226_88512"
        x1="23.7891"
        y1="1.69019"
        x2="23.7891"
        y2="45.6902"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#E0AF65" stopOpacity="0.36" />
        <stop offset="1" stopColor="#E0AF65" />
      </linearGradient>
      <linearGradient
        id="paint2_linear_4226_88512"
        x1="23.7891"
        y1="6.69019"
        x2="23.7891"
        y2="40.6902"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#40321D" />
        <stop offset="1" stopColor="#43321B" />
      </linearGradient>
      <radialGradient
        id="paint3_radial_4226_88512"
        cx="0"
        cy="0"
        r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="translate(23.7891 6.69019) rotate(90) scale(17)"
      >
        <stop stopColor="white" />
        <stop offset="1" stopColor="white" stopOpacity="0" />
      </radialGradient>
      <linearGradient
        id="paint4_linear_4226_88512"
        x1="23.7891"
        y1="6.69019"
        x2="23.7891"
        y2="40.6902"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="white" />
        <stop offset="0.809267" />
        <stop offset="0.985" stopColor="#DCDCDC" />
      </linearGradient>
      <linearGradient
        id="paint5_linear_4226_88512"
        x1="24.9978"
        y1="15.1902"
        x2="24.9978"
        y2="31.1902"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#E0AF65" stopOpacity="0.47" />
        <stop offset="0.765625" stopColor="#E0AF65" />
        <stop offset="1" stopColor="#F4D9B1" />
      </linearGradient>
      <clipPath id="clip0_4226_88512">
        <rect width="20" height="16" fill="white" transform="translate(15 15.1902)" />
      </clipPath>
    </defs>
  </svg>
);

const AttackIcon = (props: any) => (
  <svg
    width="47"
    height="47"
    className="group"
    viewBox="0 0 47 47"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle
      cx="23.3945"
      cy="23.1902"
      r="22.5"
      fill="url(#paint0_linear_4226_88522)"
      stroke="#C84444"
      className="group-hover:stroke-white"
    />
    <circle cx="23.3945" cy="23.1902" r="17" fill="url(#paint1_linear_4226_88522)" />
    <circle cx="23.3945" cy="23.1902" r="17" fill="url(#paint2_radial_4226_88522)" fillOpacity="0.2" />
    <circle cx="23.3945" cy="23.1902" r="16.5" stroke="url(#paint3_linear_4226_88522)" strokeOpacity="0.12" />
    <g>
      <path
        d="M26.2471 21.4216L27.3065 22.481L30.7409 19.0497C30.9877 18.8029 31.1409 18.4747 31.1752 18.1247L31.394 15.7341C31.4065 15.5872 31.3534 15.4404 31.2502 15.3341C31.1471 15.2279 31.0002 15.1747 30.8502 15.1904L28.4596 15.4091C28.1096 15.4404 27.7815 15.5935 27.5346 15.8435L24.1002 19.2747L25.1596 20.3341L28.594 16.9029L29.7877 16.7935L29.6784 17.9872L26.2471 21.4216ZM22.6877 27.106L21.6284 26.0466L20.294 27.381L19.2096 26.2966L20.544 24.9622L19.4846 23.9029L18.144 25.2341L17.7471 24.8372C17.5534 24.6435 17.2346 24.6435 17.0409 24.8372L16.5409 25.3372C16.394 25.4841 16.3534 25.706 16.4377 25.8935L17.2971 27.831L15.5409 29.5872C15.3471 29.781 15.3471 30.0997 15.5409 30.2935L16.2909 31.0435C16.4846 31.2372 16.8034 31.2372 16.9971 31.0435L18.7534 29.2872L20.6909 30.1466C20.8784 30.231 21.1002 30.1904 21.2471 30.0435L21.7471 29.5435C21.9409 29.3497 21.9409 29.031 21.7471 28.8372L21.3502 28.4404L22.6846 27.106H22.6877ZM17.1065 17.9904L16.9971 16.7935L18.1909 16.9029L26.8752 25.5872L27.9346 24.5279L19.2534 15.8435C19.0065 15.5935 18.6784 15.4404 18.3284 15.4091L15.9377 15.1935C15.7909 15.1779 15.644 15.231 15.5409 15.3372C15.4377 15.4435 15.3815 15.5872 15.3971 15.7341L15.6127 18.1247C15.644 18.4747 15.7971 18.8029 16.0471 19.0497L24.7284 27.7341L25.7877 26.6747L17.1065 17.9904ZM29.7471 24.8372C29.5534 24.6435 29.2346 24.6435 29.0409 24.8372L25.0409 28.8372C24.8471 29.031 24.8471 29.3497 25.0409 29.5435L25.5409 30.0435C25.6877 30.1904 25.9096 30.231 26.0971 30.1466L28.0346 29.2872L29.7909 31.0435C29.9846 31.2372 30.3034 31.2372 30.4971 31.0435L31.2471 30.2935C31.4409 30.0997 31.4409 29.781 31.2471 29.5872L29.4909 27.831L30.3502 25.8935C30.4346 25.7029 30.394 25.4841 30.2471 25.3372L29.7471 24.8372Z"
        fill="#C84444"
        className="group-hover:fill-white"
      />
    </g>
    <defs>
      <filter
        id="filter0_dddd_4226_88522"
        x="12.3945"
        y="14.1877"
        width="22.002"
        height="27.0011"
        filterUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset />
        <feGaussianBlur stdDeviation="0.5" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.6 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_4226_88522" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset dy="2" />
        <feGaussianBlur stdDeviation="1" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.6 0 0 0 0 0 0 0 0 0 0 0 0 0 0.09 0" />
        <feBlend mode="normal" in2="effect1_dropShadow_4226_88522" result="effect2_dropShadow_4226_88522" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset dy="4" />
        <feGaussianBlur stdDeviation="1" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.6 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0" />
        <feBlend mode="normal" in2="effect2_dropShadow_4226_88522" result="effect3_dropShadow_4226_88522" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset dy="7" />
        <feGaussianBlur stdDeviation="1.5" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.6 0 0 0 0 0 0 0 0 0 0 0 0 0 0.01 0" />
        <feBlend mode="normal" in2="effect3_dropShadow_4226_88522" result="effect4_dropShadow_4226_88522" />
        <feBlend mode="normal" in="SourceGraphic" in2="effect4_dropShadow_4226_88522" result="shape" />
      </filter>
      <linearGradient
        id="paint0_linear_4226_88522"
        x1="23.3945"
        y1="1.19019"
        x2="23.3945"
        y2="45.1902"
        gradientUnits="userSpaceOnUse"
      >
        <stop />
        <stop offset="1" stopColor="#150903" />
      </linearGradient>
      <linearGradient
        id="paint1_linear_4226_88522"
        x1="23.3945"
        y1="6.19019"
        x2="23.3945"
        y2="40.1902"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#352121" />
        <stop offset="1" stopColor="#2A1010" />
      </linearGradient>
      <radialGradient
        id="paint2_radial_4226_88522"
        cx="0"
        cy="0"
        r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="translate(23.3945 6.19019) rotate(90) scale(17)"
      >
        <stop stopColor="white" />
        <stop offset="1" stopColor="white" stopOpacity="0" />
      </radialGradient>
      <linearGradient
        id="paint3_linear_4226_88522"
        x1="23.3945"
        y1="6.19019"
        x2="23.3945"
        y2="40.1902"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="white" />
        <stop offset="0.809267" />
        <stop offset="0.985" stopColor="#DCDCDC" />
      </linearGradient>
    </defs>
  </svg>
);
