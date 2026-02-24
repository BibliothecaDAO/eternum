import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {borderRadius, spacing, typography} from '../../../shared/theme';
import type {LeaderboardEntry} from '../types';

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
}

export function LeaderboardRow({entry}: LeaderboardRowProps) {
  const {colors} = useTheme();

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: colors.card, borderColor: colors.border},
      ]}>
      <Text style={[typography.h3, styles.rank, {color: colors.mutedForeground}]}>
        {entry.rank}
      </Text>
      <View style={styles.info}>
        <Text style={[typography.body, {color: colors.foreground}]}>
          {entry.name}
        </Text>
      </View>
      <Text style={[typography.label, {color: colors.primary}]}>
        {entry.points.toLocaleString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  rank: {width: 30, textAlign: 'center'},
  info: {flex: 1},
});
