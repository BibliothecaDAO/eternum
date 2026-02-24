import React from 'react';
import {StyleSheet, Text, View, ViewStyle} from 'react-native';
import {useTheme} from '../../app/providers/theme-provider';
import {borderRadius, spacing} from '../theme';
import {typography} from '../theme';

type BadgeVariant = 'default' | 'destructive' | 'success' | 'warning' | 'outline';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: ViewStyle;
}

export function Badge({label, variant = 'default', size = 'md', style}: BadgeProps) {
  const {colors} = useTheme();

  const variantStyles: Record<BadgeVariant, {bg: string; fg: string; borderColor?: string}> = {
    default: {bg: colors.primary, fg: colors.primaryForeground},
    destructive: {bg: colors.destructive, fg: colors.destructiveForeground},
    success: {bg: '#2D6A4F', fg: '#FFFFFF'},
    warning: {bg: '#B8860B', fg: '#FFFFFF'},
    outline: {bg: 'transparent', fg: colors.foreground, borderColor: colors.border},
  };

  const v = variantStyles[variant];

  return (
    <View
      style={[
        styles.container,
        size === 'sm' ? styles.sm : styles.md,
        {backgroundColor: v.bg},
        v.borderColor ? {borderWidth: 1, borderColor: v.borderColor} : undefined,
        style,
      ]}>
      <Text style={[size === 'sm' ? typography.caption : typography.label, {color: v.fg}]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  sm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  md: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
