import React from 'react';
import {StyleSheet, Text, View, ViewStyle} from 'react-native';
import {AlertTriangle} from 'lucide-react-native';
import {useTheme} from '../../app/providers/theme-provider';
import {spacing, typography} from '../theme';
import {Button} from './button';

interface ErrorStateProps {
  icon?: React.ReactNode;
  title?: string;
  message?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export function ErrorState({
  icon,
  title = 'Something went wrong',
  message,
  onRetry,
  style,
}: ErrorStateProps) {
  const {colors} = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.icon}>
        {icon || <AlertTriangle size={32} color={colors.destructive} />}
      </View>
      <Text style={[typography.h3, {color: colors.foreground}]}>{title}</Text>
      {message && (
        <Text style={[typography.bodySmall, {color: colors.mutedForeground}]}>
          {message}
        </Text>
      )}
      {onRetry && (
        <Button title="Try Again" onPress={onRetry} variant="secondary" size="sm" style={styles.retryButton} />
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
  retryButton: {
    marginTop: spacing.md,
  },
});
