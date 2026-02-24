import React, {useRef, useCallback, useState} from 'react';
import {RefreshControl, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import BottomSheet from '@gorhom/bottom-sheet';
import {
  ArrowLeft,
  Swords,
  Crosshair,
  Shield,
  MapPin,
  Wheat,
  Fish,
  Package,
  Compass,
  Navigation,
  Target,
  Home,
  Trash2,
} from 'lucide-react-native';
import {useTheme} from '../../app/providers/theme-provider';
import {spacing, typography, borderRadius} from '../../shared/theme';
import {Card} from '../../shared/ui/card';
import {Badge} from '../../shared/ui/badge';
import {ProgressBar} from '../../shared/ui/progress-bar';
import {Button} from '../../shared/ui/button';
import {NeighborhoodView} from './components/neighborhood-view';
import {MoveSheet} from './sheets/move-sheet';
import {ExploreSheet} from './sheets/explore-sheet';
import {AttackSheet} from './sheets/attack-sheet';
import {useArmyDetail} from './hooks/use-army-detail';
import type {ArmiesStackParamList} from '../../app/config/types';
import type {ArmyStatus} from './types';

type Props = NativeStackScreenProps<ArmiesStackParamList, 'ArmyDetail'>;

const TROOP_ICONS: Record<string, typeof Swords> = {
  Knight: Swords,
  Crossbowman: Crosshair,
  Paladin: Shield,
};

const STATUS_CONFIG: Record<ArmyStatus, {label: string; variant: 'default' | 'destructive' | 'success' | 'warning' | 'outline'}> = {
  idle: {label: 'Idle', variant: 'outline'},
  moving: {label: 'Moving', variant: 'warning'},
  exploring: {label: 'Exploring', variant: 'default'},
  in_combat: {label: 'In Combat', variant: 'destructive'},
  garrisoned: {label: 'Garrisoned', variant: 'success'},
};

const TIER_COLORS: Record<string, string> = {
  T1: '#8B7355',
  T2: '#6B8E8E',
  T3: '#9B7DDB',
};

export function ArmyDetailScreen({route, navigation}: Props) {
  const {colors} = useTheme();
  const {armyEntityId} = route.params;
  const {army, neighborHexes, nearbyArmies} = useArmyDetail(armyEntityId);

  const [refreshing, setRefreshing] = useState(false);
  const moveSheetRef = useRef<BottomSheet>(null);
  const exploreSheetRef = useRef<BottomSheet>(null);
  const attackSheetRef = useRef<BottomSheet>(null);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // TODO: Re-fetch from Torii
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleMoveConfirm = useCallback((_col: number, _row: number) => {
    // TODO: Wire to real move transaction
    moveSheetRef.current?.close();
  }, []);

  const handleExploreConfirm = useCallback(() => {
    // TODO: Wire to real explore transaction
    exploreSheetRef.current?.close();
  }, []);

  const handleAttackConfirm = useCallback((_targetId: number) => {
    // TODO: Wire to real attack transaction
    attackSheetRef.current?.close();
  }, []);

  if (!army) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
        <Text style={[typography.body, {color: colors.mutedForeground, textAlign: 'center', marginTop: 100}]}>
          Army not found
        </Text>
      </SafeAreaView>
    );
  }

  const TroopIcon = TROOP_ICONS[army.troops.type] ?? Swords;
  const statusConfig = STATUS_CONFIG[army.status];
  const tierColor = TIER_COLORS[army.troops.tier] ?? colors.mutedForeground;
  const staminaColor = army.stamina > 60 ? '#2D6A4F' : army.stamina > 25 ? '#B8860B' : '#BF2626';
  const loadPercent = army.carryCapacity > 0 ? army.currentLoad / army.carryCapacity : 0;

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]} edges={['top']}>
      <View style={styles.navBar}>
        <Button
          title="Back"
          variant="ghost"
          size="sm"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TroopIcon size={28} color={tierColor} />
            <View style={styles.headerText}>
              <Text style={[typography.h2, {color: colors.foreground}]}>{army.name}</Text>
              <View style={styles.headerMeta}>
                <Badge label={statusConfig.label} variant={statusConfig.variant} size="sm" />
                {army.homeRealmName && (
                  <View style={styles.homeRealm}>
                    <Home size={12} color={colors.mutedForeground} />
                    <Text style={[typography.caption, {color: colors.mutedForeground}]}>
                      {army.homeRealmName}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Troop Stats */}
        <Card style={styles.section}>
          <Text style={[typography.label, {color: colors.foreground}]}>Troops</Text>
          <View style={styles.troopStats}>
            <View style={styles.troopStat}>
              <Text style={[typography.caption, {color: colors.mutedForeground}]}>Type</Text>
              <Text style={[typography.body, {color: tierColor, fontWeight: '600'}]}>
                {army.troops.type}
              </Text>
            </View>
            <View style={styles.troopStat}>
              <Text style={[typography.caption, {color: colors.mutedForeground}]}>Tier</Text>
              <Text style={[typography.body, {color: tierColor, fontWeight: '600'}]}>
                {army.troops.tier}
              </Text>
            </View>
            <View style={styles.troopStat}>
              <Text style={[typography.caption, {color: colors.mutedForeground}]}>Count</Text>
              <Text style={[typography.body, {color: colors.foreground, fontWeight: '600'}]}>
                {army.troops.count.toLocaleString()}
              </Text>
            </View>
          </View>
        </Card>

        {/* Stamina & Resources */}
        <Card style={styles.section}>
          <View style={styles.statRow}>
            <Text style={[typography.label, {color: colors.foreground}]}>Stamina</Text>
            <Text style={[typography.label, {color: staminaColor}]}>
              {army.stamina}/{army.maxStamina}
            </Text>
          </View>
          <ProgressBar progress={army.stamina / army.maxStamina} color={staminaColor} height={8} />

          <View style={styles.resourceRow}>
            <View style={styles.resourceItem}>
              <Wheat size={14} color={colors.mutedForeground} />
              <Text style={[typography.bodySmall, {color: colors.foreground}]}>
                {army.food.wheat.toLocaleString()}
              </Text>
            </View>
            <View style={styles.resourceItem}>
              <Fish size={14} color={colors.mutedForeground} />
              <Text style={[typography.bodySmall, {color: colors.foreground}]}>
                {army.food.fish.toLocaleString()}
              </Text>
            </View>
            <View style={styles.resourceItem}>
              <Package size={14} color={colors.mutedForeground} />
              <Text style={[typography.bodySmall, {color: colors.foreground}]}>
                {army.currentLoad}/{army.carryCapacity}
              </Text>
            </View>
          </View>
          <ProgressBar
            progress={loadPercent}
            color={loadPercent > 0.8 ? '#BF2626' : colors.primary}
            height={4}
          />
        </Card>

        {/* Position & Neighborhood */}
        <Card style={styles.section}>
          <View style={styles.positionHeader}>
            <MapPin size={16} color={colors.primary} />
            <Text style={[typography.label, {color: colors.foreground}]}>
              Position ({army.position.col}, {army.position.row})
            </Text>
          </View>
          <NeighborhoodView
            center={army.position}
            neighbors={neighborHexes}
          />
        </Card>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <Text style={[typography.label, {color: colors.foreground}]}>Actions</Text>
          <View style={styles.actionsGrid}>
            <Button
              title="Move"
              variant="secondary"
              size="md"
              onPress={() => moveSheetRef.current?.snapToIndex(0)}
              style={styles.actionButton}
            />
            <Button
              title="Explore"
              variant="secondary"
              size="md"
              onPress={() => exploreSheetRef.current?.snapToIndex(0)}
              style={styles.actionButton}
            />
            <Button
              title="Attack"
              variant="destructive"
              size="md"
              onPress={() => attackSheetRef.current?.snapToIndex(0)}
              style={styles.actionButton}
            />
            <Button
              title="Garrison"
              variant="secondary"
              size="md"
              onPress={() => {/* TODO */}}
              style={styles.actionButton}
            />
          </View>
        </View>

        {/* Nearby Armies */}
        {nearbyArmies.length > 0 && (
          <Card style={styles.section}>
            <View style={styles.statRow}>
              <Text style={[typography.label, {color: colors.foreground}]}>Nearby Armies</Text>
              <Badge label={String(nearbyArmies.length)} variant="outline" size="sm" />
            </View>
            {nearbyArmies.map(nearby => (
              <View key={nearby.entityId} style={styles.nearbyRow}>
                <View style={styles.nearbyInfo}>
                  <Text style={[typography.bodySmall, {color: colors.foreground}]}>
                    {nearby.name}
                  </Text>
                  <Text style={[typography.caption, {color: colors.mutedForeground}]}>
                    {nearby.troops.type} {nearby.troops.tier} · {nearby.troops.count} troops
                  </Text>
                </View>
                <View style={styles.nearbyMeta}>
                  <Badge
                    label={nearby.isEnemy ? 'Enemy' : 'Ally'}
                    variant={nearby.isEnemy ? 'destructive' : 'success'}
                    size="sm"
                  />
                  <Text style={[typography.caption, {color: colors.mutedForeground}]}>
                    {nearby.distance}h
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      <MoveSheet
        ref={moveSheetRef}
        army={army}
        onConfirm={handleMoveConfirm}
      />
      <ExploreSheet
        ref={exploreSheetRef}
        army={army}
        onConfirm={handleExploreConfirm}
      />
      <AttackSheet
        ref={attackSheetRef}
        army={army}
        nearbyEnemies={nearbyArmies}
        onConfirm={handleAttackConfirm}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navBar: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
    gap: spacing.md,
  },
  header: {
    gap: spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  homeRealm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  section: {
    gap: spacing.md,
  },
  troopStats: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  troopStat: {
    gap: 2,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resourceRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  positionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionsSection: {
    gap: spacing.sm,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
  },
  nearbyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  nearbyInfo: {
    flex: 1,
    gap: 2,
  },
  nearbyMeta: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
});
