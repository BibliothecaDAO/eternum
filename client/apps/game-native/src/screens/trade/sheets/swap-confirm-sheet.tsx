import React, {forwardRef} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import {ArrowDown, Info} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography, borderRadius} from '../../../shared/theme';
import {BottomSheetWrapper} from '../../../shared/ui/bottom-sheet-wrapper';
import {Button} from '../../../shared/ui/button';
import {ResourceIcon} from '../../../shared/ui/resource-icon';
import type {SwapPreview} from '../types';

interface SwapConfirmSheetProps {
  sellResourceId: number;
  sellResourceName: string;
  sellAmount: number;
  buyResourceId: number;
  buyResourceName: string;
  preview: SwapPreview | null;
  onConfirm?: () => void;
  onClose?: () => void;
}

export const SwapConfirmSheet = forwardRef<BottomSheet, SwapConfirmSheetProps>(
  ({sellResourceId, sellResourceName, sellAmount, buyResourceId, buyResourceName, preview, onConfirm, onClose}, ref) => {
    const {colors} = useTheme();

    return (
      <BottomSheetWrapper ref={ref} title="Confirm Swap" snapPoints={['60%']} onClose={onClose}>
        <View style={styles.content}>
          <View style={styles.swapVisual}>
            <View style={[styles.resourceBox, {backgroundColor: colors.muted}]}>
              <ResourceIcon resourceId={sellResourceId} size={32} />
              <View>
                <Text style={[typography.caption, {color: colors.mutedForeground}]}>You Pay</Text>
                <Text style={[typography.h3, {color: colors.foreground}]}>
                  {sellAmount.toLocaleString()}
                </Text>
                <Text style={[typography.bodySmall, {color: colors.mutedForeground}]}>
                  {sellResourceName}
                </Text>
              </View>
            </View>

            <View style={[styles.arrowCircle, {backgroundColor: colors.card, borderColor: colors.border}]}>
              <ArrowDown size={18} color={colors.primary} />
            </View>

            <View style={[styles.resourceBox, {backgroundColor: colors.muted}]}>
              <ResourceIcon resourceId={buyResourceId} size={32} />
              <View>
                <Text style={[typography.caption, {color: colors.mutedForeground}]}>You Receive</Text>
                <Text style={[typography.h3, {color: colors.foreground}]}>
                  {preview ? preview.outputAmount.toLocaleString() : '—'}
                </Text>
                <Text style={[typography.bodySmall, {color: colors.mutedForeground}]}>
                  {buyResourceName}
                </Text>
              </View>
            </View>
          </View>

          {preview && (
            <View style={[styles.detailsCard, {backgroundColor: colors.muted, borderColor: colors.border}]}>
              <View style={styles.detailRow}>
                <Text style={[typography.bodySmall, {color: colors.mutedForeground}]}>Price per unit</Text>
                <Text style={[typography.label, {color: colors.foreground}]}>
                  {preview.pricePerUnit.toFixed(4)} LORDS
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[typography.bodySmall, {color: colors.mutedForeground}]}>Slippage</Text>
                <Text style={[typography.label, {color: preview.slippage > 5 ? '#BF2626' : colors.foreground}]}>
                  {preview.slippage.toFixed(2)}%
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[typography.bodySmall, {color: colors.mutedForeground}]}>LP Fee</Text>
                <Text style={[typography.label, {color: colors.foreground}]}>
                  {preview.lpFee.toLocaleString()}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[typography.bodySmall, {color: colors.mutedForeground}]}>Bank Owner Fee</Text>
                <Text style={[typography.label, {color: colors.foreground}]}>
                  {preview.ownerFee.toLocaleString()}
                </Text>
              </View>
            </View>
          )}

          {preview && preview.slippage > 5 && (
            <View style={styles.warningRow}>
              <Info size={14} color="#BF2626" />
              <Text style={[typography.bodySmall, {color: '#BF2626'}]}>
                High slippage. Consider reducing your trade amount.
              </Text>
            </View>
          )}

          <Button
            title="Confirm Swap"
            onPress={() => onConfirm?.()}
            disabled={!preview}
          />
        </View>
      </BottomSheetWrapper>
    );
  },
);

SwapConfirmSheet.displayName = 'SwapConfirmSheet';

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  swapVisual: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  resourceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    width: '100%',
  },
  arrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -spacing.sm,
    zIndex: 1,
  },
  detailsCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
