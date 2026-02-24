import React, {forwardRef} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import {Compass, Wheat, Fish} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography} from '../../../shared/theme';
import {BottomSheetWrapper} from '../../../shared/ui/bottom-sheet-wrapper';
import {Button} from '../../../shared/ui/button';
import {Card} from '../../../shared/ui/card';
import type {ArmySummary} from '../types';

interface ExploreSheetProps {
  army: ArmySummary;
  onConfirm?: () => void;
  onClose?: () => void;
}

export const ExploreSheet = forwardRef<BottomSheet, ExploreSheetProps>(
  ({army, onConfirm, onClose}, ref) => {
    const {colors} = useTheme();

    // TODO: Calculate from configManager
    const staminaCost = 15;
    const wheatCost = 100;
    const fishCost = 50;
    const canExplore = army.stamina >= staminaCost && army.food.wheat >= wheatCost && army.food.fish >= fishCost;

    return (
      <BottomSheetWrapper ref={ref} title="Explore Hex" snapPoints={['50%']} onClose={onClose}>
        <View style={styles.content}>
          <View style={styles.armyInfo}>
            <Compass size={18} color={colors.primary} />
            <Text style={[typography.body, {color: colors.foreground}]}>{army.name}</Text>
            <Text style={[typography.caption, {color: colors.mutedForeground}]}>
              at ({army.position.col}, {army.position.row})
            </Text>
          </View>

          <Card style={styles.costsCard}>
            <Text style={[typography.label, {color: colors.foreground}]}>Exploration Cost</Text>
            <View style={styles.costsGrid}>
              <View style={styles.costItem}>
                <Text style={[typography.caption, {color: colors.mutedForeground}]}>Stamina</Text>
                <Text style={[typography.label, {color: army.stamina >= staminaCost ? '#2D6A4F' : '#BF2626'}]}>
                  {staminaCost} / {army.stamina}
                </Text>
              </View>
              <View style={styles.costItem}>
                <View style={styles.costLabel}>
                  <Wheat size={12} color={colors.mutedForeground} />
                  <Text style={[typography.caption, {color: colors.mutedForeground}]}>Wheat</Text>
                </View>
                <Text style={[typography.label, {color: army.food.wheat >= wheatCost ? '#2D6A4F' : '#BF2626'}]}>
                  {wheatCost} / {army.food.wheat.toLocaleString()}
                </Text>
              </View>
              <View style={styles.costItem}>
                <View style={styles.costLabel}>
                  <Fish size={12} color={colors.mutedForeground} />
                  <Text style={[typography.caption, {color: colors.mutedForeground}]}>Fish</Text>
                </View>
                <Text style={[typography.label, {color: army.food.fish >= fishCost ? '#2D6A4F' : '#BF2626'}]}>
                  {fishCost} / {army.food.fish.toLocaleString()}
                </Text>
              </View>
            </View>
          </Card>

          {!canExplore && (
            <Text style={[typography.bodySmall, {color: '#BF2626'}]}>
              Insufficient resources to explore. Need {staminaCost} stamina, {wheatCost} wheat, and {fishCost} fish.
            </Text>
          )}

          <Button
            title="Explore Adjacent Hex"
            onPress={() => onConfirm?.()}
            disabled={!canExplore}
          />
        </View>
      </BottomSheetWrapper>
    );
  },
);

ExploreSheet.displayName = 'ExploreSheet';

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  armyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  costsCard: {
    gap: spacing.md,
  },
  costsGrid: {
    gap: spacing.sm,
  },
  costItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
