import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle} from 'react-native';
import {useTheme} from '../../app/providers/theme-provider';
import {borderRadius, spacing} from '../theme';
import {typography} from '../theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const {colors} = useTheme();

  const variantStyles: Record<ButtonVariant, {bg: string; fg: string}> = {
    primary: {bg: colors.primary, fg: colors.primaryForeground},
    secondary: {bg: colors.secondary, fg: colors.secondaryForeground},
    ghost: {bg: 'transparent', fg: colors.foreground},
    destructive: {bg: colors.destructive, fg: colors.destructiveForeground},
  };

  const sizeStyles: Record<ButtonSize, ViewStyle> = {
    sm: {paddingVertical: spacing.sm, paddingHorizontal: spacing.md},
    md: {paddingVertical: spacing.md, paddingHorizontal: spacing.lg},
    lg: {paddingVertical: spacing.lg, paddingHorizontal: spacing.xl},
  };

  const v = variantStyles[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({pressed}) => [
        styles.container,
        sizeStyles[size],
        {backgroundColor: v.bg},
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        <Text style={[typography.label, {color: v.fg}]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});
