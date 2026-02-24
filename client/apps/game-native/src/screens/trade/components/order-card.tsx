import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {ArrowRight, Clock} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography, borderRadius} from '../../../shared/theme';
import {ResourceAmount} from '../../../shared/ui/resource-amount';
import {Badge} from '../../../shared/ui/badge';
import {CountdownTimer} from '../../../shared/ui/countdown-timer';
import type {TradeOrder} from '../types';

interface OrderCardProps {
  order: TradeOrder;
  onPress: (order: TradeOrder) => void;
}

const STATUS_VARIANT: Record<string, 'default' | 'destructive' | 'success' | 'warning' | 'outline'> = {
  open: 'success',
  filled: 'default',
  expired: 'warning',
  cancelled: 'outline',
};

export function OrderCard({order, onPress}: OrderCardProps) {
  const {colors} = useTheme();
  const isExpired = order.expiresAt < Math.floor(Date.now() / 1000);

  return (
    <Pressable
      onPress={() => onPress(order)}
      style={({pressed}) => [
        styles.container,
        {backgroundColor: colors.card, borderColor: colors.border},
        pressed && styles.pressed,
      ]}>
      <View style={styles.topRow}>
        <View style={styles.makerInfo}>
          <Text style={[typography.label, {color: colors.foreground}]}>
            {order.makerName}
          </Text>
          {order.isOwn && <Badge label="You" variant="default" size="sm" />}
        </View>
        <Badge
          label={isExpired ? 'Expired' : order.status}
          variant={isExpired ? 'warning' : STATUS_VARIANT[order.status]}
          size="sm"
        />
      </View>

      <View style={styles.tradeRow}>
        <View style={styles.resourceSide}>
          <Text style={[typography.caption, {color: colors.mutedForeground}]}>Offers</Text>
          {order.takerGets.map(r => (
            <ResourceAmount key={r.resourceId} resourceId={r.resourceId} amount={r.amount} size="sm" />
          ))}
        </View>

        <ArrowRight size={16} color={colors.mutedForeground} />

        <View style={styles.resourceSide}>
          <Text style={[typography.caption, {color: colors.mutedForeground}]}>Wants</Text>
          {order.makerGets.map(r => (
            <ResourceAmount key={r.resourceId} resourceId={r.resourceId} amount={r.amount} size="sm" />
          ))}
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.timerRow}>
          <Clock size={12} color={colors.mutedForeground} />
          {isExpired ? (
            <Text style={[typography.caption, {color: colors.mutedForeground}]}>Expired</Text>
          ) : (
            <CountdownTimer targetTimestamp={order.expiresAt} format="hms" />
          )}
        </View>
        <Text style={[typography.caption, {color: colors.mutedForeground}]}>
          #{order.tradeId}
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
  makerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  resourceSide: {
    flex: 1,
    gap: spacing.xs,
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
});
