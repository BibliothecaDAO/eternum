import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Crown} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {borderRadius, spacing, typography} from '../../../shared/theme';
import type {LeaderboardEntry} from '../types';

interface LeaderboardHeaderProps {
  topThree: LeaderboardEntry[];
}

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export function LeaderboardHeader({topThree}: LeaderboardHeaderProps) {
  const {colors} = useTheme();

  if (topThree.length === 0) return null;

  return (
    <View style={styles.container}>
      {topThree.map((entry, index) => (
        <View
          key={entry.id}
          style={[
            styles.podium,
            {backgroundColor: colors.card, borderColor: colors.border},
            index === 0 && styles.first,
          ]}>
          <Crown size={index === 0 ? 24 : 18} color={MEDAL_COLORS[index]} />
          <Text
            style={[typography.label, {color: colors.foreground}]}
            numberOfLines={1}>
            {entry.name}
          </Text>
          <Text style={[typography.caption, {color: MEDAL_COLORS[index]}]}>
            {entry.points.toLocaleString()}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  podium: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.xs,
  },
  first: {
    paddingVertical: spacing.lg,
  },
});
