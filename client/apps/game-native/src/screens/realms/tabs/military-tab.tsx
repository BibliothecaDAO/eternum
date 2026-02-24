import React from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';
import {Shield, Swords, Eye, AlertTriangle} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography} from '../../../shared/theme';
import {Card} from '../../../shared/ui/card';
import {Badge} from '../../../shared/ui/badge';
import {EmptyState} from '../../../shared/ui/empty-state';
import type {RealmSummary} from '../hooks/use-realm-summary';

interface MilitaryTabProps {
  realm: RealmSummary;
}

// TODO: Replace with real data from useExplorersByStructure, useGuardsByStructure
interface NearbyEnemy {
  id: string;
  name: string;
  distance: number;
  troopCount: number;
}

const MOCK_ENEMIES: NearbyEnemy[] = [
  {id: 'e1', name: 'Raider Band Alpha', distance: 8, troopCount: 150},
  {id: 'e2', name: 'Dark Legion Scouts', distance: 14, troopCount: 80},
];

function getDangerLevel(distance: number): {label: string; variant: 'destructive' | 'warning' | 'success'} {
  if (distance < 6) return {label: 'High Danger', variant: 'destructive'};
  if (distance < 12) return {label: 'Medium', variant: 'warning'};
  return {label: 'Low', variant: 'success'};
}

function StatCard({icon, label, value, color}: {icon: React.ReactNode; label: string; value: string; color: string}) {
  const {colors} = useTheme();
  return (
    <Card style={styles.statCard}>
      {icon}
      <Text style={[typography.h3, {color}]}>{value}</Text>
      <Text style={[typography.caption, {color: colors.mutedForeground}]}>{label}</Text>
    </Card>
  );
}

export function MilitaryTab({realm}: MilitaryTabProps) {
  const {colors} = useTheme();

  // TODO: Replace mock values with real hook data
  const explorerCount = 2;
  const maxExplorers = 3;
  const guardCount = realm.guardStatus === 'defended' ? 2 : 0;
  const maxGuards = 3;

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <StatCard
          icon={<Swords size={22} color={colors.primary} />}
          label="Explorers"
          value={`${explorerCount}/${maxExplorers}`}
          color={colors.foreground}
        />
        <StatCard
          icon={<Shield size={22} color={realm.guardStatus === 'defended' ? '#2D6A4F' : '#BF2626'} />}
          label="Guards"
          value={`${guardCount}/${maxGuards}`}
          color={realm.guardStatus === 'defended' ? '#2D6A4F' : '#BF2626'}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Eye size={16} color={colors.mutedForeground} />
        <Text style={[typography.label, {color: colors.foreground}]}>Nearby Threats</Text>
        <Badge label={String(MOCK_ENEMIES.length)} variant="outline" size="sm" />
      </View>

      {MOCK_ENEMIES.length === 0 ? (
        <EmptyState
          title="No Threats Detected"
          message="No enemy armies are within detection range."
          style={styles.emptyState}
        />
      ) : (
        <FlatList
          data={MOCK_ENEMIES}
          keyExtractor={item => item.id}
          renderItem={({item}) => {
            const danger = getDangerLevel(item.distance);
            return (
              <Card style={styles.enemyCard}>
                <View style={styles.enemyRow}>
                  <AlertTriangle size={16} color={danger.variant === 'destructive' ? '#BF2626' : danger.variant === 'warning' ? '#B8860B' : '#2D6A4F'} />
                  <View style={styles.enemyInfo}>
                    <Text style={[typography.bodySmall, {color: colors.foreground}]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[typography.caption, {color: colors.mutedForeground}]}>
                      {item.troopCount} troops · {item.distance} hexes away
                    </Text>
                  </View>
                  <Badge label={danger.label} variant={danger.variant} size="sm" />
                </View>
              </Card>
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  enemyCard: {
    paddingVertical: spacing.sm,
  },
  enemyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  enemyInfo: {
    flex: 1,
  },
  separator: {
    height: spacing.sm,
  },
  emptyState: {
    paddingTop: spacing.xxxl,
  },
});
