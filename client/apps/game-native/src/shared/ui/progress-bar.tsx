import React from 'react';
import {StyleSheet, Text, View, ViewStyle} from 'react-native';
import {useTheme} from '../../app/providers/theme-provider';
import {borderRadius, spacing, typography} from '../theme';

interface ProgressBarProps {
  progress: number; // 0 to 1
  color?: string;
  height?: number;
  showLabel?: boolean;
  style?: ViewStyle;
}

export function ProgressBar({
  progress,
  color,
  height = 8,
  showLabel = false,
  style,
}: ProgressBarProps) {
  const {colors} = useTheme();
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const fillColor = color ?? colors.primary;

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.track, {height, backgroundColor: colors.muted}]}>
        <View
          style={[
            styles.fill,
            {height, width: `${clampedProgress * 100}%`, backgroundColor: fillColor},
          ]}
        />
      </View>
      {showLabel && (
        <Text style={[typography.caption, {color: colors.mutedForeground}]}>
          {Math.round(clampedProgress * 100)}%
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  track: {
    flex: 1,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: borderRadius.full,
  },
});
