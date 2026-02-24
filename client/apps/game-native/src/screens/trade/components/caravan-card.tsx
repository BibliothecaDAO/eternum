import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MapPin, ArrowRight, Package} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography, borderRadius} from '../../../shared/theme';
import {ResourceAmount} from '../../../shared/ui/resource-amount';
import {Badge} from '../../../shared/ui/badge';
import {CountdownTimer} from '../../../shared/ui/countdown-timer';
import type {CaravanInfo} from '../types';

interface CaravanCardProps {
  caravan: CaravanInfo;
  onPress: (caravan: CaravanInfo) => void;
  onClaim?: (caravan: CaravanInfo) => void;
}

export function CaravanCard({caravan, onPress, onClaim}: CaravanCardProps) {
  const {colors} = useTheme();
  const isReady = caravan.status === 'ready' || caravan.arrivalTime <= Math.floor(Date.now() / 1000);

  return (
    <Pressable
      onPress={() => onPress(caravan)}
      style={({pressed}) => [
        styles.container,
        {backgroundColor: colors.card, borderColor: isReady ? '#2D6A4F' : colors.border},
        pressed && styles.pressed,
      ]}>
      <View style={styles.topRow}>
        <View style={styles.routeRow}>
          <View style={styles.location}>
            <MapPin size={12} color={colors.mutedForeground} />
            <Text style={[typography.label, {color: colors.foreground}]} numberOfLines={1}>
              {caravan.origin.name}
            </Text>
          </View>
          <ArrowRight size={14} color={colors.mutedForeground} />
          <View style={styles.location}>
            <MapPin size={12} color={colors.primary} />
            <Text style={[typography.label, {color: colors.foreground}]} numberOfLines={1}>
              {caravan.destination.name}
            </Text>
          </View>
        </View>
        <Badge
          label={isReady ? 'Ready' : 'In Transit'}
          variant={isReady ? 'success' : 'warning'}
          size="sm"
        />
      </View>

      <View style={styles.resourcesRow}>
        <Package size={14} color={colors.mutedForeground} />
        {caravan.resources.map(r => (
          <ResourceAmount key={r.resourceId} resourceId={r.resourceId} amount={r.amount} size="sm" />
        ))}
      </View>

      <View style={styles.bottomRow}>
        {isReady ? (
          <Pressable
            onPress={() => onClaim?.(caravan)}
            style={[styles.claimButton, {backgroundColor: '#2D6A4F'}]}>
            <Text style={styles.claimText}>Claim</Text>
          </Pressable>
        ) : (
          <View style={styles.timerRow}>
            <Text style={[typography.caption, {color: colors.mutedForeground}]}>ETA:</Text>
            <CountdownTimer targetTimestamp={caravan.arrivalTime} format="hms" />
          </View>
        )}
        <Text style={[typography.caption, {color: colors.mutedForeground}]}>
          ({caravan.origin.col},{caravan.origin.row}) → ({caravan.destination.col},{caravan.destination.row})
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  resourcesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  claimButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  claimText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
