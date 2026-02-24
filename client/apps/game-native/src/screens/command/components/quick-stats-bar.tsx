import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {Coins, Shield, Castle, ArrowLeftRight} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {Card} from '../../../shared/ui/card';
import {spacing, typography} from '../../../shared/theme';

// TODO: Replace mock values with real Dojo queries

interface StatItem {
  id: string;
  label: string;
  value: string;
  icon: React.ReactNode;
}

export function QuickStatsBar() {
  const {colors} = useTheme();

  const stats: StatItem[] = [
    {id: 'lords', label: 'LORDS', value: '12,450', icon: <Coins size={18} color={colors.primary} />},
    {id: 'armies', label: 'Armies', value: '3', icon: <Shield size={18} color={colors.primary} />},
    {id: 'realms', label: 'Realms', value: '2', icon: <Castle size={18} color={colors.primary} />},
    {id: 'trades', label: 'Trades', value: '5', icon: <ArrowLeftRight size={18} color={colors.primary} />},
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}>
      {stats.map(stat => (
        <Card key={stat.id} style={styles.statCard}>
          <View style={styles.statRow}>
            {stat.icon}
            <Text style={[typography.caption, {color: colors.mutedForeground}]}>{stat.label}</Text>
          </View>
          <Text style={[typography.h3, {color: colors.foreground}]}>{stat.value}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  statCard: {
    minWidth: 100,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
