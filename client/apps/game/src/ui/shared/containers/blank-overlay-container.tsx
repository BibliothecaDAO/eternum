import { Transition } from "@headlessui/react";
import { Fragment, memo } from "react";

type BlurOverlayContainerProps = {
  children?: React.ReactNode;
  open: boolean;
  zIndex?: number;
} & React.HTMLAttributes<HTMLDivElement>;

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");

export const BlankOverlayContainer = memo(
  ({ children, open, zIndex = 10001, className, ...rest }: BlurOverlayContainerProps) => {
    return (
      <Transition
        show={open}
        as={Fragment}
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div
          className={cx(
            "fixed left-0 top-0 flex h-screen w-screen items-center justify-center rounded-lg pointer-events-auto",
            className,
          )}
          style={{ zIndex }}
          {...rest}
        >
          {children}
        </div>
      </Transition>
    );
  },
);
