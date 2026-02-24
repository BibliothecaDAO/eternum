import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Castle, Shield, Cog, Hammer} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography} from '../../../shared/theme';
import {Card} from '../../../shared/ui/card';
import {Badge} from '../../../shared/ui/badge';
import {ProgressBar} from '../../../shared/ui/progress-bar';
import {ResourceAmount} from '../../../shared/ui/resource-amount';
import type {RealmSummary} from '../hooks/use-realm-summary';

interface RealmCardProps {
  realm: RealmSummary;
  onPress: (entityId: number) => void;
  compact?: boolean;
}

function getGuardVariant(status: RealmSummary['guardStatus']): 'success' | 'destructive' {
  return status === 'defended' ? 'success' : 'destructive';
}

function getGuardLabel(status: RealmSummary['guardStatus']): string {
  return status === 'defended' ? 'Defended' : 'Vulnerable';
}

function getProductionVariant(
  status: RealmSummary['productionStatus'],
): 'success' | 'warning' | 'destructive' {
  switch (status) {
    case 'running':
      return 'success';
    case 'at-capacity':
      return 'warning';
    case 'paused':
      return 'destructive';
  }
}

function getProductionLabel(status: RealmSummary['productionStatus']): string {
  switch (status) {
    case 'running':
      return 'Running';
    case 'at-capacity':
      return 'At Capacity';
    case 'paused':
      return 'Paused';
  }
}

function getCapacityColor(percent: number): string {
  if (percent >= 0.9) return '#BF2626';
  if (percent >= 0.7) return '#B8860B';
  return '#2D6A4F';
}

export function RealmCard({realm, onPress, compact = false}: RealmCardProps) {
  const {colors} = useTheme();

  if (compact) {
    return (
      <Pressable
        onPress={() => onPress(realm.entityId)}
        style={({pressed}) => [pressed && styles.pressed]}>
        <Card style={styles.compactCard}>
          <View style={styles.compactRow}>
            <View style={styles.compactLeft}>
              <Castle size={18} color={colors.primary} />
              <View style={styles.compactInfo}>
                <Text style={[typography.label, {color: colors.foreground}]} numberOfLines={1}>
                  {realm.name}
                </Text>
                <Text style={[typography.caption, {color: colors.mutedForeground}]}>
                  Lv.{realm.level} {realm.levelName} ({realm.coordX}, {realm.coordY})
                </Text>
              </View>
            </View>
            <View style={styles.compactRight}>
              <Badge
                label={getGuardLabel(realm.guardStatus)}
                variant={getGuardVariant(realm.guardStatus)}
                size="sm"
              />
              <Badge
                label={getProductionLabel(realm.productionStatus)}
                variant={getProductionVariant(realm.productionStatus)}
                size="sm"
              />
            </View>
          </View>
          <ProgressBar
            progress={realm.capacityPercent}
            color={getCapacityColor(realm.capacityPercent)}
            height={4}
            style={styles.compactProgress}
          />
        </Card>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => onPress(realm.entityId)}
      style={({pressed}) => [styles.fullCardPressable, pressed && styles.pressed]}>
      <Card variant="elevated" style={styles.fullCard}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Castle size={24} color={colors.primary} />
            <View style={styles.headerText}>
              <Text style={[typography.h2, {color: colors.foreground}]}>{realm.name}</Text>
              <Text style={[typography.caption, {color: colors.mutedForeground}]}>
                ({realm.coordX}, {realm.coordY})
              </Text>
            </View>
          </View>
          <Badge label={`Lv.${realm.level} ${realm.levelName}`} variant="default" size="sm" />
        </View>

        <View style={styles.resourceSection}>
          <Text style={[typography.label, {color: colors.mutedForeground}]}>Resources</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.resourceScrollContent}>
            {realm.topResources.slice(0, 5).map(res => (
              <ResourceAmount
                key={res.resourceId}
                resourceId={res.resourceId}
                amount={res.amount}
                size="sm"
                style={styles.resourceItem}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.capacitySection}>
          <View style={styles.capacityHeader}>
            <Text style={[typography.label, {color: colors.mutedForeground}]}>Capacity</Text>
            <Text style={[typography.caption, {color: colors.mutedForeground}]}>
              {Math.round(realm.capacityPercent * 100)}%
            </Text>
          </View>
          <ProgressBar
            progress={realm.capacityPercent}
            color={getCapacityColor(realm.capacityPercent)}
            height={8}
          />
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.badgeItem}>
            <Hammer size={14} color={colors.mutedForeground} />
            <Badge
              label={`${realm.buildingCount}/${realm.totalSlots} slots`}
              variant="outline"
              size="sm"
            />
          </View>
          <View style={styles.badgeItem}>
            <Shield size={14} color={colors.mutedForeground} />
            <Badge
              label={getGuardLabel(realm.guardStatus)}
              variant={getGuardVariant(realm.guardStatus)}
              size="sm"
            />
          </View>
          <View style={styles.badgeItem}>
            <Cog size={14} color={colors.mutedForeground} />
            <Badge
              label={getProductionLabel(realm.productionStatus)}
              variant={getProductionVariant(realm.productionStatus)}
              size="sm"
            />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullCardPressable: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  fullCard: {
    flex: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  headerText: {
    flex: 1,
  },
  resourceSection: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  resourceScrollContent: {
    gap: spacing.md,
    paddingRight: spacing.sm,
  },
  resourceItem: {
    marginRight: spacing.xs,
  },
  capacitySection: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  capacityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  compactCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  compactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  compactInfo: {
    flex: 1,
  },
  compactRight: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  compactProgress: {
    marginTop: spacing.sm,
  },
});
