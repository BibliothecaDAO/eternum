import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Swords, Crosshair, Shield, MapPin} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography} from '../../../shared/theme';
import {Badge} from '../../../shared/ui/badge';
import {ProgressBar} from '../../../shared/ui/progress-bar';
import type {ArmySummary, ArmyStatus} from '../types';

interface ArmyCardProps {
  army: ArmySummary;
}

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

export function ArmyCard({army}: ArmyCardProps) {
  const {colors} = useTheme();
  const TroopIcon = TROOP_ICONS[army.troops.type] ?? Swords;
  const statusConfig = STATUS_CONFIG[army.status];
  const tierColor = TIER_COLORS[army.troops.tier] ?? colors.mutedForeground;

  const staminaColor = army.stamina > 60 ? '#2D6A4F' : army.stamina > 25 ? '#B8860B' : '#BF2626';

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.nameSection}>
          <TroopIcon size={18} color={tierColor} />
          <Text style={[typography.body, styles.name, {color: colors.foreground}]} numberOfLines={1}>
            {army.name}
          </Text>
        </View>
        <Badge label={statusConfig.label} variant={statusConfig.variant} size="sm" />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[typography.caption, {color: colors.mutedForeground}]}>
            {army.troops.type} {army.troops.tier}
          </Text>
          <Text style={[typography.label, {color: tierColor}]}>
            {army.troops.count.toLocaleString()}
          </Text>
        </View>

        <View style={styles.staminaContainer}>
          <Text style={[typography.caption, {color: colors.mutedForeground}]}>Stamina</Text>
          <View style={styles.staminaRow}>
            <ProgressBar progress={army.stamina / army.maxStamina} color={staminaColor} height={6} />
            <Text style={[typography.caption, {color: staminaColor}]}>
              {army.stamina}%
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.locationRow}>
          <MapPin size={12} color={colors.mutedForeground} />
          <Text style={[typography.caption, {color: colors.mutedForeground}]}>
            ({army.position.col}, {army.position.row})
          </Text>
          {army.homeRealmName && (
            <Text style={[typography.caption, {color: colors.mutedForeground}]}>
              from {army.homeRealmName}
            </Text>
          )}
        </View>
        {army.status !== 'garrisoned' && (
          <Text style={[typography.caption, {color: colors.mutedForeground}]}>
            Load: {Math.round((army.currentLoad / army.carryCapacity) * 100)}%
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  name: {
    fontWeight: '600',
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-end',
  },
  stat: {
    gap: 2,
  },
  staminaContainer: {
    flex: 1,
    gap: 2,
  },
  staminaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
