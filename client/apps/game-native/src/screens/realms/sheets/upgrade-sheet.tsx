import React, {useRef, useImperativeHandle, forwardRef, useCallback} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import {ArrowUp, Check} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography} from '../../../shared/theme';
import {BottomSheetWrapper} from '../../../shared/ui/bottom-sheet-wrapper';
import {Card} from '../../../shared/ui/card';
import {Button} from '../../../shared/ui/button';
import {Badge} from '../../../shared/ui/badge';
import {ResourceAmount} from '../../../shared/ui/resource-amount';
import type {RealmSummary} from '../hooks/use-realm-summary';

export interface UpgradeSheetRef {
  open: () => void;
  close: () => void;
}

interface UpgradeSheetProps {
  realm: RealmSummary;
}

// TODO: Replace with real upgrade costs from configManager
const UPGRADE_COSTS: {resourceId: number; amount: number}[] = [
  {resourceId: 1, amount: 2000},
  {resourceId: 2, amount: 1500},
  {resourceId: 5, amount: 800},
];

const LEVEL_NAMES: Record<number, string> = {
  1: 'Keep',
  2: 'Fortress',
  3: 'Citadel',
  4: 'Stronghold',
  5: 'Empire',
};

export const UpgradeSheet = forwardRef<UpgradeSheetRef, UpgradeSheetProps>(
  ({realm}, ref) => {
    const sheetRef = useRef<BottomSheet>(null);
    const {colors} = useTheme();

    useImperativeHandle(ref, () => ({
      open: () => sheetRef.current?.snapToIndex(0),
      close: () => sheetRef.current?.close(),
    }));

    const nextLevel = realm.level + 1;
    const nextLevelName = LEVEL_NAMES[nextLevel] ?? `Level ${nextLevel}`;

    const handleUpgrade = useCallback(() => {
      // TODO: Execute upgrade system call via Dojo
      console.log('Upgrade realm', realm.entityId, 'to level', nextLevel);
      sheetRef.current?.close();
    }, [realm.entityId, nextLevel]);

    return (
      <BottomSheetWrapper ref={sheetRef} title="Upgrade Realm" snapPoints={['55%']}>
        <Card style={styles.upgradeInfo}>
          <View style={styles.levelRow}>
            <View style={styles.levelCol}>
              <Text style={[typography.caption, {color: colors.mutedForeground}]}>Current</Text>
              <Badge label={`Lv.${realm.level} ${realm.levelName}`} variant="outline" />
            </View>
            <ArrowUp size={20} color={colors.primary} />
            <View style={styles.levelCol}>
              <Text style={[typography.caption, {color: colors.mutedForeground}]}>Next</Text>
              <Badge label={`Lv.${nextLevel} ${nextLevelName}`} variant="success" />
            </View>
          </View>
        </Card>

        <View style={styles.benefitsSection}>
          <Text style={[typography.label, {color: colors.foreground}]}>Benefits</Text>
          <View style={styles.benefitRow}>
            <Check size={14} color="#2D6A4F" />
            <Text style={[typography.bodySmall, {color: colors.foreground}]}>
              +2 additional building slots
            </Text>
          </View>
          <View style={styles.benefitRow}>
            <Check size={14} color="#2D6A4F" />
            <Text style={[typography.bodySmall, {color: colors.foreground}]}>
              +1 guard slot
            </Text>
          </View>
          <View style={styles.benefitRow}>
            <Check size={14} color="#2D6A4F" />
            <Text style={[typography.bodySmall, {color: colors.foreground}]}>
              Increased storage capacity
            </Text>
          </View>
        </View>

        <View style={styles.costsSection}>
          <Text style={[typography.label, {color: colors.foreground}]}>Requirements</Text>
          <View style={styles.costsRow}>
            {UPGRADE_COSTS.map(cost => (
              <ResourceAmount
                key={cost.resourceId}
                resourceId={cost.resourceId}
                amount={cost.amount}
                size="md"
              />
            ))}
          </View>
        </View>

        <Button
          title={`Upgrade to ${nextLevelName}`}
          variant="primary"
          size="lg"
          onPress={handleUpgrade}
        />
      </BottomSheetWrapper>
    );
  },
);

UpgradeSheet.displayName = 'UpgradeSheet';

const styles = StyleSheet.create({
  upgradeInfo: {
    marginBottom: spacing.lg,
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  levelCol: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  benefitsSection: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  costsSection: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  costsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
});
