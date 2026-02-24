import React from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {ChevronDown} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {borderRadius, spacing, typography} from '../../../shared/theme';
import {ResourceIcon} from '../../../shared/ui/resource-icon';
import type {SwapDirection} from '../types';

interface SwapInputProps {
  direction: SwapDirection;
  resourceId: number;
  resourceName: string;
  amount: string;
  balance: number;
  onAmountChange: (amount: string) => void;
  onResourcePress: () => void;
}

const QUICK_PERCENTS = [10, 25, 50, 100] as const;

export function SwapInput({
  direction,
  resourceId,
  resourceName,
  amount,
  balance,
  onAmountChange,
  onResourcePress,
}: SwapInputProps) {
  const {colors} = useTheme();

  const handleQuickSelect = (percent: number) => {
    const value = Math.floor(balance * (percent / 100));
    onAmountChange(String(value));
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.muted, borderColor: colors.border}]}>
      <View style={styles.topRow}>
        <Text style={[typography.caption, {color: colors.mutedForeground, textTransform: 'uppercase'}]}>
          {direction === 'sell' ? 'You Pay' : 'You Receive'}
        </Text>
        <Text style={[typography.caption, {color: colors.mutedForeground}]}>
          Balance: {balance.toLocaleString()}
        </Text>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={[styles.amountInput, {color: colors.foreground}]}
          value={amount}
          onChangeText={onAmountChange}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.mutedForeground}
        />
        <Pressable
          onPress={onResourcePress}
          style={[styles.resourcePicker, {backgroundColor: colors.card, borderColor: colors.border}]}>
          <ResourceIcon resourceId={resourceId} size={24} />
          <Text style={[typography.label, {color: colors.foreground}]} numberOfLines={1}>
            {resourceName}
          </Text>
          <ChevronDown size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {direction === 'sell' && (
        <View style={styles.quickRow}>
          {QUICK_PERCENTS.map(p => (
            <Pressable
              key={p}
              onPress={() => handleQuickSelect(p)}
              style={[styles.quickButton, {borderColor: colors.border}]}>
              <Text style={[typography.caption, {color: colors.mutedForeground}]}>
                {p === 100 ? 'Max' : `${p}%`}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '600',
    padding: 0,
  },
  resourcePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
});
