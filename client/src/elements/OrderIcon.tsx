import clsx from 'clsx';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { ReactComponent as Anger } from '../assets/icons/orders/anger.svg'
import { ReactComponent as Brilliance } from '../assets/icons/orders/brilliance.svg';
import { ReactComponent as Detection } from '../assets/icons/orders/detection.svg';
import { ReactComponent as Enlightenment } from '../assets/icons/orders/enlightenment.svg';
import { ReactComponent as Fox } from '../assets/icons/orders/fox.svg';
import { ReactComponent as Fury } from '../assets/icons/orders/fury.svg';
import { ReactComponent as Giants } from '../assets/icons/orders/giants.svg';
import { ReactComponent as Perfection } from '../assets/icons/orders/perfection.svg';
import { ReactComponent as Power } from '../assets/icons/orders/power.svg';
import { ReactComponent as Protection } from '../assets/icons/orders/protection.svg';
import { ReactComponent as Rage } from '../assets/icons/orders/rage.svg';
import { ReactComponent as Reflection } from '../assets/icons/orders/reflection.svg';
import { ReactComponent as Skill } from '../assets/icons/orders/skill.svg';
import { ReactComponent as Titans } from '../assets/icons/orders/titans.svg';
import { ReactComponent as Twins } from '../assets/icons/orders/twins.svg';
import { ReactComponent as Vitriol } from '../assets/icons/orders/vitriol.svg';

export type Props = {
  order: string;
  size: keyof typeof STYLES['size'];
  className?: string;
  containerClassName?: string;
  withTooltip?: boolean;
  color?: string;
};

const Components: { [key: string]: ReactElement } = Object.freeze({
  power: <Power className="stroke-8 stroke-order-power" />,
  anger: <Anger />,
  brilliance: <Brilliance />,
  detection: <Detection />,
  enlightenment: <Enlightenment />,
  'the fox': <Fox className="stroke-8 stroke-order-fox" />,
  fury: <Fury />,
  giants: <Giants />,
  perfection: <Perfection className=" fill-order-perfection" />,
  reflection: <Reflection />,
  skill: <Skill />,
  titans: <Titans />,
  'the twins': <Twins />,
  vitriol: <Vitriol />,
  rage: <Rage />,
  protection: <Protection />,
});

const getIcon = (order: string, color: string) => {
  switch (order) {
    case 'power':
      return <Power className={`stroke-8 stroke-${color}`} />;
    case 'anger':
      return <Anger className={`fill-${color}`} />;
    case 'brilliance':
      return <Brilliance className={`fill-${color}`} />;
    case 'detection':
      return <Detection className={`fill-${color}`} />;
    case 'enlightenment':
      return <Enlightenment className={`fill-${color}`} />;
    case 'fox':
      return <Fox className={`stroke-8 stroke-${color}`} />;
    case 'fury':
      return <Fury className={`stroke-8 stroke-${color}`} />;
    case 'giants':
      return <Giants className={`fill-${color}`} />;
    case 'perfection':
      return <Perfection className={`fill-${color}`} />;
    case 'reflection':
      return <Reflection className={`fill-${color}`} />;
    case 'skill':
      return <Skill className={`fill-${color}`} />;
    case 'titans':
      return <Titans className={`stroke-8 stroke-${color}`} />;
    case 'twins':
      return <Twins className={`fill-${color}`} />;
    case 'vitriol':
      return <Vitriol className={`stroke-8 stroke-${color}`} />;
    case 'rage':
      return <Rage className={`fill-${color}`} />;
    case 'protection':
      return <Protection className={`fill-${color}`} />;
  }
}

const STYLES = {
  size: {
    xxs: 'w-2 h-2 flex justify-center paper',
    xs: 'w-4 h-4 flex justify-center paper',
    sm: 'w-6 h-6 flex justify-center paper',
    md: 'w-8 h-8 flex justify-center paper',
    lg: 'w-12 h-12 flex justify-center paper',
  },
} as const;

export const OrderIcon = (props: Props) => {
  const order = props.order.toLowerCase();

  const color = props.color ?? `order-${order.replace('the ', '')}`;

  return (
    <div className={clsx('relative group', props.containerClassName)}>
      <div className={clsx(STYLES.size[props.size], props.className)}>
        {getIcon(order, color)}
      </div>
      {props.withTooltip && (
        <div className="absolute top-0 flex flex-col items-center hidden -translate-y-full w-max group-hover:flex">
          <span className="relative z-10 p-2 text-xs leading-none text-white whitespace-no-wrap rounded shadow-lg bg-gray-1000">
            Order of {order.includes('the') && 'the '}
            <span className="capitalize">{order.replace('the ', '')}</span>
          </span>
          <div className="w-3 h-3 -mt-2 rotate-45 bg-gray-1000"></div>
        </div>
      )}
    </div>
  );
};
