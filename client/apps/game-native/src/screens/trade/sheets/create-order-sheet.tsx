import React, {forwardRef, useState} from 'react';
import {StyleSheet, Text, TextInput, View} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import {Plus} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {borderRadius, spacing, typography} from '../../../shared/theme';
import {BottomSheetWrapper} from '../../../shared/ui/bottom-sheet-wrapper';
import {Button} from '../../../shared/ui/button';
import {ResourceIcon} from '../../../shared/ui/resource-icon';

interface CreateOrderSheetProps {
  onConfirm?: (sellResourceId: number, sellAmount: number, buyResourceId: number, buyAmount: number) => void;
  onClose?: () => void;
}

// TODO: Replace with real resource list from shared packages
const RESOURCES = [
  {id: 1, name: 'Stone'},
  {id: 3, name: 'Wood'},
  {id: 4, name: 'Copper'},
  {id: 7, name: 'Gold'},
  {id: 29, name: 'Lords'},
];

export const CreateOrderSheet = forwardRef<BottomSheet, CreateOrderSheetProps>(
  ({onConfirm, onClose}, ref) => {
    const {colors} = useTheme();
    const [sellResourceIdx, setSellResourceIdx] = useState(0);
    const [buyResourceIdx, setBuyResourceIdx] = useState(4);
    const [sellAmount, setSellAmount] = useState('');
    const [buyAmount, setBuyAmount] = useState('');

    const sellResource = RESOURCES[sellResourceIdx];
    const buyResource = RESOURCES[buyResourceIdx];
    const canCreate = sellAmount.length > 0 && buyAmount.length > 0 && Number(sellAmount) > 0 && Number(buyAmount) > 0;

    const handleCycleSellResource = () => {
      setSellResourceIdx((sellResourceIdx + 1) % RESOURCES.length);
    };

    const handleCycleBuyResource = () => {
      setBuyResourceIdx((buyResourceIdx + 1) % RESOURCES.length);
    };

    return (
      <BottomSheetWrapper ref={ref} title="Create Trade Order" snapPoints={['70%']} onClose={onClose}>
        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={[typography.label, {color: colors.foreground}]}>You Offer</Text>
            <View style={styles.resourceRow}>
              <Button
                title={sellResource.name}
                variant="secondary"
                size="sm"
                onPress={handleCycleSellResource}
                style={styles.resourceButton}
              />
              <ResourceIcon resourceId={sellResource.id} size={24} />
              <TextInput
                style={[styles.input, {color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border}]}
                value={sellAmount}
                onChangeText={setSellAmount}
                keyboardType="numeric"
                placeholder="Amount"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, {backgroundColor: colors.border}]} />
            <Plus size={16} color={colors.mutedForeground} />
            <View style={[styles.dividerLine, {backgroundColor: colors.border}]} />
          </View>

          <View style={styles.section}>
            <Text style={[typography.label, {color: colors.foreground}]}>You Want</Text>
            <View style={styles.resourceRow}>
              <Button
                title={buyResource.name}
                variant="secondary"
                size="sm"
                onPress={handleCycleBuyResource}
                style={styles.resourceButton}
              />
              <ResourceIcon resourceId={buyResource.id} size={24} />
              <TextInput
                style={[styles.input, {color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border}]}
                value={buyAmount}
                onChangeText={setBuyAmount}
                keyboardType="numeric"
                placeholder="Amount"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>

          {canCreate && (
            <View style={[styles.summaryCard, {backgroundColor: colors.muted, borderColor: colors.border}]}>
              <View style={styles.summaryRow}>
                <Text style={[typography.bodySmall, {color: colors.mutedForeground}]}>Exchange Rate</Text>
                <Text style={[typography.label, {color: colors.foreground}]}>
                  1 {sellResource.name} = {(Number(buyAmount) / Number(sellAmount)).toFixed(2)} {buyResource.name}
                </Text>
              </View>
            </View>
          )}

          <Button
            title="Create Order"
            onPress={() => onConfirm?.(sellResource.id, Number(sellAmount), buyResource.id, Number(buyAmount))}
            disabled={!canCreate}
          />
        </View>
      </BottomSheetWrapper>
    );
  },
);

CreateOrderSheet.displayName = 'CreateOrderSheet';

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resourceButton: {
    minWidth: 80,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  summaryCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
