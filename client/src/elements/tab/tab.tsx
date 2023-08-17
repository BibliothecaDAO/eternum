
import { Tab as HeadlessTab } from '@headlessui/react';
import clsx from 'clsx';
import type { ComponentProps } from 'react';
import { useContext } from 'react';
import { TabContext } from './TabProvider';
import { VARIANTS } from './tabs';

type TabProps = ComponentProps<'button'> & { noText?: boolean };

export const Tab = ({ className, children, noText, ...props }: TabProps) => {
  const { variant } = useContext(TabContext)!;

  return (
    // @ts-ignore
    <HeadlessTab
      className={({ selected }) =>
        clsx(
          VARIANTS[variant].tab.base,
          selected
            ? VARIANTS[variant].tab.active
            : VARIANTS[variant].tab.inactive,
          className
        )
      }
      {...props}
    >
      {() => {
        return (
          <>
            {children}
          </>
        );
      }}
    </HeadlessTab>
  );
};
