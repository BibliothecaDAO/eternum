import React, {useMemo} from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';
import {Hammer, Cog, Pause, Play} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography} from '../../../shared/theme';
import {Card} from '../../../shared/ui/card';
import {Badge} from '../../../shared/ui/badge';
import {ResourceIcon} from '../../../shared/ui/resource-icon';
import {ProgressBar} from '../../../shared/ui/progress-bar';
import {EmptyState} from '../../../shared/ui/empty-state';
import type {RealmSummary} from '../hooks/use-realm-summary';

interface BuildingsTabProps {
  realm: RealmSummary;
}

// TODO: Replace with real data from useBuildings hook once Dojo context is wired
interface MockBuilding {
  id: string;
  name: string;
  category: string;
  producedResourceId: number;
  ratePerHour: number;
  isActive: boolean;
  balance: number;
  maxBalance: number;
}

const MOCK_BUILDINGS: MockBuilding[] = [
  {id: 'b1', name: 'Lumber Mill', category: 'resource', producedResourceId: 1, ratePerHour: 120, isActive: true, balance: 8500, maxBalance: 10000},
  {id: 'b2', name: 'Quarry', category: 'resource', producedResourceId: 2, ratePerHour: 80, isActive: true, balance: 3200, maxBalance: 5000},
  {id: 'b3', name: 'Farm', category: 'food', producedResourceId: 3, ratePerHour: 200, isActive: false, balance: 1800, maxBalance: 5000},
  {id: 'b4', name: 'Iron Mine', category: 'resource', producedResourceId: 5, ratePerHour: 60, isActive: true, balance: 4100, maxBalance: 8000},
  {id: 'b5', name: 'Gold Mine', category: 'resource', producedResourceId: 8, ratePerHour: 30, isActive: true, balance: 950, maxBalance: 3000},
];

function BuildingCard({building}: {building: MockBuilding}) {
  const {colors} = useTheme();
  const capacityPercent = building.maxBalance > 0 ? building.balance / building.maxBalance : 0;
  const isAtCapacity = capacityPercent >= 0.95;

  return (
    <Card style={styles.buildingCard}>
      <View style={styles.buildingHeader}>
        <View style={styles.buildingNameRow}>
          <ResourceIcon resourceId={building.producedResourceId} size={28} />
          <View style={styles.buildingNameCol}>
            <Text style={[typography.label, {color: colors.foreground}]}>{building.name}</Text>
            <Text style={[typography.caption, {color: colors.mutedForeground}]}>
              +{building.ratePerHour}/hr
            </Text>
          </View>
        </View>
        <Badge
          label={isAtCapacity ? 'Full' : building.isActive ? 'Active' : 'Paused'}
          variant={isAtCapacity ? 'warning' : building.isActive ? 'success' : 'destructive'}
          size="sm"
        />
      </View>

      <View style={styles.buildingStats}>
        <View style={styles.balanceRow}>
          <Text style={[typography.bodySmall, {color: colors.foreground}]}>
            {building.balance.toLocaleString()}
          </Text>
          <Text style={[typography.caption, {color: colors.mutedForeground}]}>
            / {building.maxBalance.toLocaleString()}
          </Text>
        </View>
        <ProgressBar
          progress={capacityPercent}
          color={isAtCapacity ? '#BF2626' : capacityPercent >= 0.7 ? '#B8860B' : '#2D6A4F'}
          height={6}
        />
      </View>

      <View style={styles.buildingActions}>
        {building.isActive ? (
          <View style={styles.statusChip}>
            <Cog size={12} color={colors.mutedForeground} />
            <Text style={[typography.caption, {color: colors.mutedForeground}]}>Producing</Text>
          </View>
        ) : (
          <View style={styles.statusChip}>
            <Pause size={12} color={colors.destructive} />
            <Text style={[typography.caption, {color: colors.destructive}]}>Paused</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

export function BuildingsTab({realm}: BuildingsTabProps) {
  const {colors} = useTheme();

  // TODO: Replace with useBuildings(realm.coordX, realm.coordY) when Dojo is wired
  const buildings = useMemo(() => MOCK_BUILDINGS.slice(0, realm.buildingCount), [realm.buildingCount]);

  return (
    <View style={styles.container}>
      <View style={styles.slotsHeader}>
        <View style={styles.slotsRow}>
          <Hammer size={16} color={colors.mutedForeground} />
          <Text style={[typography.label, {color: colors.foreground}]}>
            {realm.buildingCount} / {realm.totalSlots} slots used
          </Text>
        </View>
        {realm.buildingCount < realm.totalSlots && (
          <Badge label={`${realm.totalSlots - realm.buildingCount} available`} variant="outline" size="sm" />
        )}
      </View>

      {buildings.length === 0 ? (
        <EmptyState
          title="No Buildings"
          message="Build your first production building to start generating resources."
          style={styles.emptyState}
        />
      ) : (
        <FlatList
          data={buildings}
          keyExtractor={item => item.id}
          renderItem={({item}) => <BuildingCard building={item} />}
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
  slotsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  slotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  buildingCard: {
    gap: spacing.md,
  },
  buildingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buildingNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  buildingNameCol: {
    flex: 1,
  },
  buildingStats: {
    gap: spacing.xs,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  buildingActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  separator: {
    height: spacing.sm,
  },
  emptyState: {
    flex: 1,
    paddingTop: spacing.xxxl,
  },
});
