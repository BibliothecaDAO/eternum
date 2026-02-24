import React from 'react';
import {FlatList, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Shield, Swords, Eye, AlertTriangle, Clock, Plus, Lock} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {borderRadius, spacing, typography} from '../../../shared/theme';
import {Card} from '../../../shared/ui/card';
import {Badge} from '../../../shared/ui/badge';
import {Button} from '../../../shared/ui/button';
import {ProgressBar} from '../../../shared/ui/progress-bar';
import {EmptyState} from '../../../shared/ui/empty-state';
import {CountdownTimer} from '../../../shared/ui/countdown-timer';
import type {RealmSummary} from '../hooks/use-realm-summary';

interface MilitaryTabProps {
  realm: RealmSummary;
}

interface NearbyEnemy {
  id: string;
  name: string;
  distance: number;
  troopCount: number;
}

interface GuardSlotData {
  slot: number;
  name: string;
  troopType: string | null;
  troopTier: string | null;
  troopCount: number;
  cooldownEnd: number | null;
}

const MOCK_ENEMIES: NearbyEnemy[] = [
  {id: 'e1', name: 'Raider Band Alpha', distance: 8, troopCount: 150},
  {id: 'e2', name: 'Dark Legion Scouts', distance: 14, troopCount: 80},
];

const GUARD_SLOT_NAMES = ['Front Gate', 'East Wall', 'West Wall', 'Inner Keep'];

// TODO: Replace with real data from useGuardsByStructure
function getMockGuardSlots(isDefended: boolean): GuardSlotData[] {
  if (!isDefended) {
    return GUARD_SLOT_NAMES.map((name, i) => ({
      slot: i,
      name,
      troopType: null,
      troopTier: null,
      troopCount: 0,
      cooldownEnd: null,
    }));
  }
  return [
    {slot: 0, name: 'Front Gate', troopType: 'Knight', troopTier: 'T2', troopCount: 100, cooldownEnd: null},
    {slot: 1, name: 'East Wall', troopType: 'Crossbowman', troopTier: 'T1', troopCount: 80, cooldownEnd: null},
    {slot: 2, name: 'West Wall', troopType: null, troopTier: null, troopCount: 0, cooldownEnd: Date.now() + 3600000},
    {slot: 3, name: 'Inner Keep', troopType: null, troopTier: null, troopCount: 0, cooldownEnd: null},
  ];
}

const TIER_COLORS: Record<string, string> = {
  T1: '#8B7355',
  T2: '#6B8E8E',
  T3: '#9B7DDB',
};

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

function GuardSlotCard({slot}: {slot: GuardSlotData}) {
  const {colors} = useTheme();
  const isEmpty = slot.troopCount === 0;
  const isOnCooldown = slot.cooldownEnd !== null && slot.cooldownEnd > Date.now();
  const tierColor = slot.troopTier ? TIER_COLORS[slot.troopTier] ?? colors.mutedForeground : colors.mutedForeground;

  return (
    <Card style={styles.guardSlot}>
      <View style={styles.guardSlotHeader}>
        <Text style={[typography.label, {color: colors.foreground}]}>{slot.name}</Text>
        {isEmpty ? (
          isOnCooldown ? (
            <Badge label="Cooldown" variant="warning" size="sm" />
          ) : (
            <Badge label="Empty" variant="outline" size="sm" />
          )
        ) : (
          <Badge label="Active" variant="success" size="sm" />
        )}
      </View>

      {isEmpty ? (
        <View style={styles.guardSlotEmpty}>
          {isOnCooldown ? (
            <View style={styles.cooldownRow}>
              <Clock size={14} color="#B8860B" />
              <CountdownTimer targetTimestamp={slot.cooldownEnd!} format="hms" />
            </View>
          ) : (
            <Button
              title="Assign Guard"
              variant="ghost"
              size="sm"
              onPress={() => {/* TODO: Open guard assignment sheet */}}
            />
          )}
        </View>
      ) : (
        <View style={styles.guardSlotFilled}>
          <View style={styles.guardTroopRow}>
            <Shield size={14} color={tierColor} />
            <Text style={[typography.bodySmall, {color: colors.foreground}]}>
              {slot.troopType} {slot.troopTier}
            </Text>
            <Text style={[typography.label, {color: tierColor}]}>
              {slot.troopCount}
            </Text>
          </View>
          <Button
            title="Remove"
            variant="ghost"
            size="sm"
            onPress={() => {/* TODO: Remove guard */}}
          />
        </View>
      )}
    </Card>
  );
}

export function MilitaryTab({realm}: MilitaryTabProps) {
  const {colors} = useTheme();

  // TODO: Replace mock values with real hook data
  const explorerCount = 2;
  const maxExplorers = 3;
  const guardSlots = getMockGuardSlots(realm.guardStatus === 'defended');
  const filledSlots = guardSlots.filter(s => s.troopCount > 0).length;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.statsRow}>
        <StatCard
          icon={<Swords size={22} color={colors.primary} />}
          label="Explorers"
          value={`${explorerCount}/${maxExplorers}`}
          color={colors.foreground}
        />
        <StatCard
          icon={<Shield size={22} color={filledSlots > 0 ? '#2D6A4F' : '#BF2626'} />}
          label="Guards"
          value={`${filledSlots}/${guardSlots.length}`}
          color={filledSlots > 0 ? '#2D6A4F' : '#BF2626'}
        />
      </View>

      {/* Guard Slots */}
      <View style={styles.sectionHeader}>
        <Lock size={16} color={colors.mutedForeground} />
        <Text style={[typography.label, {color: colors.foreground}]}>Defense Slots</Text>
        <Badge label={`${filledSlots}/${guardSlots.length}`} variant="outline" size="sm" />
      </View>

      <View style={styles.guardSlotsContainer}>
        {guardSlots.map(slot => (
          <GuardSlotCard key={slot.slot} slot={slot} />
        ))}
      </View>

      {/* Nearby Threats */}
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
        <View style={styles.listContent}>
          {MOCK_ENEMIES.map(item => {
            const danger = getDangerLevel(item.distance);
            return (
              <Card key={item.id} style={styles.enemyCard}>
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
          })}
        </View>
      )}
    </ScrollView>
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
    paddingTop: spacing.md,
  },
  guardSlotsContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  guardSlot: {
    gap: spacing.sm,
  },
  guardSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  guardSlotEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  guardSlotFilled: {
    gap: spacing.sm,
  },
  guardTroopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cooldownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
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
  emptyState: {
    paddingTop: spacing.xxxl,
  },
});
