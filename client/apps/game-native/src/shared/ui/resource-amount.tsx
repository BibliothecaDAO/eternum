import React from 'react';
import {StyleSheet, Text, View, ViewStyle} from 'react-native';
import {useTheme} from '../../app/providers/theme-provider';
import {spacing, typography} from '../theme';
import {ResourceIcon} from './resource-icon';

type ResourceAmountSize = 'sm' | 'md' | 'lg';

interface ResourceAmountProps {
  resourceId: number;
  amount: number;
  size?: ResourceAmountSize;
  showName?: boolean;
  style?: ViewStyle;
}

const sizeMap: Record<ResourceAmountSize, {icon: number; text: keyof typeof typography}> = {
  sm: {icon: 16, text: 'caption'},
  md: {icon: 24, text: 'bodySmall'},
  lg: {icon: 32, text: 'body'},
};

function formatAmount(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(1)}K`;
  }
  return Math.floor(amount).toLocaleString();
}

export function ResourceAmount({
  resourceId,
  amount,
  size = 'md',
  style,
}: ResourceAmountProps) {
  const {colors} = useTheme();
  const s = sizeMap[size];

  return (
    <View style={[styles.container, style]}>
      <ResourceIcon resourceId={resourceId} size={s.icon} />
      <Text style={[typography[s.text], {color: colors.foreground}]}>
        {formatAmount(amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
