import React from 'react';
import {StyleSheet, Text, View, ViewStyle} from 'react-native';
import {useTheme} from '../../app/providers/theme-provider';
import {spacing, typography} from '../theme';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  style?: ViewStyle;
}

export function EmptyState({icon, title, message, style}: EmptyStateProps) {
  const {colors} = useTheme();

  return (
    <View style={[styles.container, style]}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={[typography.h3, {color: colors.foreground}]}>{title}</Text>
      {message && (
        <Text style={[typography.bodySmall, {color: colors.mutedForeground}]}>{message}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  icon: {
    marginBottom: spacing.sm,
  },
});
