import React, {forwardRef} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import {ArrowRight, Clock} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography, borderRadius} from '../../../shared/theme';
import {BottomSheetWrapper} from '../../../shared/ui/bottom-sheet-wrapper';
import {Button} from '../../../shared/ui/button';
import {ResourceAmount} from '../../../shared/ui/resource-amount';
import {CountdownTimer} from '../../../shared/ui/countdown-timer';
import type {TradeOrder} from '../types';

interface AcceptOrderSheetProps {
  order: TradeOrder | null;
  onConfirm?: (tradeId: number) => void;
  onClose?: () => void;
}

export const AcceptOrderSheet = forwardRef<BottomSheet, AcceptOrderSheetProps>(
  ({order, onConfirm, onClose}, ref) => {
    const {colors} = useTheme();

    if (!order) {
      return (
        <BottomSheetWrapper ref={ref} title="Accept Order" snapPoints={['50%']} onClose={onClose}>
          <Text style={[typography.body, {color: colors.mutedForeground}]}>No order selected</Text>
        </BottomSheetWrapper>
      );
    }

    return (
      <BottomSheetWrapper ref={ref} title="Accept Trade Order" snapPoints={['55%']} onClose={onClose}>
        <View style={styles.content}>
          <View style={[styles.makerCard, {backgroundColor: colors.muted}]}>
            <Text style={[typography.caption, {color: colors.mutedForeground}]}>From</Text>
            <Text style={[typography.body, {color: colors.foreground, fontWeight: '600'}]}>
              {order.makerName}
            </Text>
            <Text style={[typography.caption, {color: colors.mutedForeground}]}>
              Order #{order.tradeId}
            </Text>
          </View>

          <View style={styles.tradeVisual}>
            <View style={styles.tradeSide}>
              <Text style={[typography.caption, {color: colors.mutedForeground}]}>You Send</Text>
              {order.makerGets.map(r => (
                <ResourceAmount key={r.resourceId} resourceId={r.resourceId} amount={r.amount} size="md" />
              ))}
            </View>

            <ArrowRight size={20} color={colors.primary} />

            <View style={styles.tradeSide}>
              <Text style={[typography.caption, {color: colors.mutedForeground}]}>You Receive</Text>
              {order.takerGets.map(r => (
                <ResourceAmount key={r.resourceId} resourceId={r.resourceId} amount={r.amount} size="md" />
              ))}
            </View>
          </View>

          <View style={[styles.expiryRow, {backgroundColor: colors.muted}]}>
            <Clock size={14} color={colors.mutedForeground} />
            <Text style={[typography.bodySmall, {color: colors.mutedForeground}]}>Expires in</Text>
            <CountdownTimer targetTimestamp={order.expiresAt} format="hms" />
          </View>

          <View style={styles.buttonRow}>
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => onClose?.()}
              style={styles.cancelButton}
            />
            <Button
              title="Accept Trade"
              onPress={() => onConfirm?.(order.tradeId)}
              style={styles.acceptButton}
            />
          </View>
        </View>
      </BottomSheetWrapper>
    );
  },
);

AcceptOrderSheet.displayName = 'AcceptOrderSheet';

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  makerCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  tradeVisual: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  tradeSide: {
    flex: 1,
    gap: spacing.sm,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
  },
  acceptButton: {
    flex: 2,
  },
});
