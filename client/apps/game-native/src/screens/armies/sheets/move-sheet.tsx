import React, {forwardRef, useState} from 'react';
import {StyleSheet, Text, TextInput, View} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import {Navigation} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {borderRadius, spacing, typography} from '../../../shared/theme';
import {BottomSheetWrapper} from '../../../shared/ui/bottom-sheet-wrapper';
import {Button} from '../../../shared/ui/button';
import type {ArmySummary} from '../types';

interface MoveSheetProps {
  army: ArmySummary;
  onConfirm?: (col: number, row: number) => void;
  onClose?: () => void;
}

export const MoveSheet = forwardRef<BottomSheet, MoveSheetProps>(
  ({army, onConfirm, onClose}, ref) => {
    const {colors} = useTheme();
    const [targetCol, setTargetCol] = useState('');
    const [targetRow, setTargetRow] = useState('');

    const canMove = targetCol.length > 0 && targetRow.length > 0 && army.stamina > 0;
    const staminaCost = 10; // TODO: Calculate based on distance

    return (
      <BottomSheetWrapper ref={ref} title="Move Army" snapPoints={['55%']} onClose={onClose}>
        <View style={styles.content}>
          <View style={styles.armyInfo}>
            <Navigation size={18} color={colors.primary} />
            <Text style={[typography.body, {color: colors.foreground}]}>{army.name}</Text>
            <Text style={[typography.caption, {color: colors.mutedForeground}]}>
              from ({army.position.col}, {army.position.row})
            </Text>
          </View>

          <View style={styles.inputSection}>
            <Text style={[typography.label, {color: colors.foreground}]}>Target Coordinates</Text>
            <View style={styles.coordInputs}>
              <View style={styles.inputWrapper}>
                <Text style={[typography.caption, {color: colors.mutedForeground}]}>Col</Text>
                <TextInput
                  style={[styles.input, {color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border}]}
                  value={targetCol}
                  onChangeText={setTargetCol}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
              <View style={styles.inputWrapper}>
                <Text style={[typography.caption, {color: colors.mutedForeground}]}>Row</Text>
                <TextInput
                  style={[styles.input, {color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border}]}
                  value={targetRow}
                  onChangeText={setTargetRow}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            </View>
          </View>

          <View style={styles.costSection}>
            <View style={styles.costRow}>
              <Text style={[typography.bodySmall, {color: colors.mutedForeground}]}>Stamina Cost</Text>
              <Text style={[typography.label, {color: army.stamina >= staminaCost ? '#2D6A4F' : '#BF2626'}]}>
                {staminaCost} / {army.stamina}
              </Text>
            </View>
            <View style={styles.costRow}>
              <Text style={[typography.bodySmall, {color: colors.mutedForeground}]}>Current Stamina</Text>
              <Text style={[typography.label, {color: colors.foreground}]}>{army.stamina}%</Text>
            </View>
          </View>

          <Button
            title="Confirm Move"
            onPress={() => onConfirm?.(parseInt(targetCol, 10), parseInt(targetRow, 10))}
            disabled={!canMove}
          />
        </View>
      </BottomSheetWrapper>
    );
  },
);

MoveSheet.displayName = 'MoveSheet';

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  armyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inputSection: {
    gap: spacing.sm,
  },
  coordInputs: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inputWrapper: {
    flex: 1,
    gap: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
  },
  costSection: {
    gap: spacing.sm,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
