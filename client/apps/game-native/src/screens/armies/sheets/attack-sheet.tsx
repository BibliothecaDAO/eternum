import React, {forwardRef, useState} from 'react';
import {FlatList, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import {Swords, AlertTriangle, Target} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {borderRadius, spacing, typography} from '../../../shared/theme';
import {BottomSheetWrapper} from '../../../shared/ui/bottom-sheet-wrapper';
import {Button} from '../../../shared/ui/button';
import {Badge} from '../../../shared/ui/badge';
import {Card} from '../../../shared/ui/card';
import type {ArmySummary, NearbyArmy} from '../types';

interface AttackSheetProps {
  army: ArmySummary;
  nearbyEnemies: NearbyArmy[];
  onConfirm?: (targetEntityId: number) => void;
  onClose?: () => void;
}

export const AttackSheet = forwardRef<BottomSheet, AttackSheetProps>(
  ({army, nearbyEnemies, onConfirm, onClose}, ref) => {
    const {colors} = useTheme();
    const [selectedTarget, setSelectedTarget] = useState<number | null>(null);

    const enemies = nearbyEnemies.filter(a => a.isEnemy);
    const selectedEnemy = enemies.find(e => e.entityId === selectedTarget);
    const canAttack = selectedTarget !== null && army.stamina > 0;

    // Mock damage preview
    const damagePreview = selectedEnemy
      ? {
          attackerLoss: Math.round(army.troops.count * 0.15),
          defenderLoss: Math.round(selectedEnemy.troops.count * 0.4),
          winChance: army.troops.count > selectedEnemy.troops.count ? 75 : 35,
        }
      : null;

    return (
      <BottomSheetWrapper ref={ref} title="Attack" snapPoints={['70%', '90%']} onClose={onClose}>
        <View style={styles.content}>
          <View style={styles.attackerInfo}>
            <Swords size={18} color={colors.primary} />
            <Text style={[typography.body, {color: colors.foreground}]}>{army.name}</Text>
            <Badge label={`${army.troops.count} troops`} variant="outline" size="sm" />
          </View>

          <Text style={[typography.label, {color: colors.foreground}]}>Select Target</Text>

          {enemies.length === 0 ? (
            <Card>
              <View style={styles.emptyTargets}>
                <Target size={24} color={colors.mutedForeground} />
                <Text style={[typography.bodySmall, {color: colors.mutedForeground}]}>
                  No enemies within attack range
                </Text>
              </View>
            </Card>
          ) : (
            <FlatList
              data={enemies}
              keyExtractor={item => String(item.entityId)}
              renderItem={({item}) => {
                const isSelected = item.entityId === selectedTarget;
                return (
                  <TouchableOpacity
                    onPress={() => setSelectedTarget(item.entityId)}
                    activeOpacity={0.7}>
                    <Card
                      style={
                        isSelected
                          ? {...styles.targetCard, borderColor: colors.primary, borderWidth: 2}
                          : styles.targetCard
                      }>
                      <View style={styles.targetRow}>
                        <View style={styles.targetInfo}>
                          <Text style={[typography.body, {color: colors.foreground}]}>
                            {item.name}
                          </Text>
                          <Text style={[typography.caption, {color: colors.mutedForeground}]}>
                            {item.troops.type} {item.troops.tier} · {item.troops.count} troops · {item.distance} hex away
                          </Text>
                        </View>
                        <Badge
                          label={`${item.distance}h`}
                          variant={item.distance <= 2 ? 'destructive' : 'warning'}
                          size="sm"
                        />
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              scrollEnabled={false}
            />
          )}

          {damagePreview && selectedEnemy && (
            <Card style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <AlertTriangle size={16} color="#B8860B" />
                <Text style={[typography.label, {color: colors.foreground}]}>Battle Preview</Text>
              </View>
              <View style={styles.previewGrid}>
                <View style={styles.previewRow}>
                  <Text style={[typography.bodySmall, {color: colors.mutedForeground}]}>Win Chance</Text>
                  <Text style={[typography.label, {color: damagePreview.winChance > 50 ? '#2D6A4F' : '#BF2626'}]}>
                    {damagePreview.winChance}%
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={[typography.bodySmall, {color: colors.mutedForeground}]}>Your Losses (est.)</Text>
                  <Text style={[typography.label, {color: '#BF2626'}]}>~{damagePreview.attackerLoss}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={[typography.bodySmall, {color: colors.mutedForeground}]}>Enemy Losses (est.)</Text>
                  <Text style={[typography.label, {color: '#2D6A4F'}]}>~{damagePreview.defenderLoss}</Text>
                </View>
              </View>
            </Card>
          )}

          <Button
            title={canAttack ? `Attack ${selectedEnemy?.name ?? ''}` : 'Select a Target'}
            variant={canAttack ? 'destructive' : 'secondary'}
            onPress={() => selectedTarget && onConfirm?.(selectedTarget)}
            disabled={!canAttack}
          />
        </View>
      </BottomSheetWrapper>
    );
  },
);

AttackSheet.displayName = 'AttackSheet';

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
  },
  attackerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  targetCard: {
    paddingVertical: spacing.sm,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  targetInfo: {
    flex: 1,
    gap: 2,
  },
  separator: {
    height: spacing.sm,
  },
  emptyTargets: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  previewCard: {
    gap: spacing.sm,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  previewGrid: {
    gap: spacing.xs,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
