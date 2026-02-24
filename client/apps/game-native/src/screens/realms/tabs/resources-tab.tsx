import React from 'react';
import {SectionList, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography} from '../../../shared/theme';
import {Card} from '../../../shared/ui/card';
import {ResourceAmount} from '../../../shared/ui/resource-amount';
import {ProgressBar} from '../../../shared/ui/progress-bar';
import {EmptyState} from '../../../shared/ui/empty-state';
import {useResourceBalances} from '../../../features/resource-balances';

interface ResourcesTabProps {
  entityId: number;
}

interface ResourceRow {
  resourceId: number;
  amount: number;
  maxAmount: number;
}

// TODO: Replace with getResourceTiers from @bibliothecadao/types
const TIER_CONFIG: {title: string; resourceIds: number[]}[] = [
  {title: 'Food', resourceIds: [1, 2]},
  {title: 'Common', resourceIds: [3, 4, 5, 6]},
  {title: 'Uncommon', resourceIds: [7, 8, 9]},
  {title: 'Rare', resourceIds: [10, 11]},
];

export function ResourcesTab({entityId}: ResourcesTabProps) {
  const {colors} = useTheme();
  const {resourceAmounts} = useResourceBalances(entityId);

  const sections = TIER_CONFIG.map(tier => {
    const data = tier.resourceIds
      .map(id => {
        const found = resourceAmounts.find(r => r.resourceId === id);
        return found ? {resourceId: id, amount: found.amount, maxAmount: found.maxAmount} : null;
      })
      .filter((r): r is ResourceRow => r !== null);

    return {title: tier.title, data};
  }).filter(s => s.data.length > 0);

  if (sections.length === 0) {
    return (
      <EmptyState
        title="No Resources"
        message="This realm doesn't have any resources yet."
        style={styles.emptyState}
      />
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={item => String(item.resourceId)}
      renderSectionHeader={({section}) => (
        <View style={[styles.sectionHeader, {backgroundColor: colors.background}]}>
          <Text style={[typography.label, {color: colors.mutedForeground}]}>
            {section.title}
          </Text>
        </View>
      )}
      renderItem={({item}) => {
        const percent = item.maxAmount > 0 ? item.amount / item.maxAmount : 0;
        return (
          <Card style={styles.resourceRow}>
            <View style={styles.resourceTop}>
              <ResourceAmount resourceId={item.resourceId} amount={item.amount} size="md" />
              <Text style={[typography.caption, {color: colors.mutedForeground}]}>
                / {item.maxAmount.toLocaleString()}
              </Text>
            </View>
            <ProgressBar
              progress={percent}
              color={percent >= 0.9 ? '#BF2626' : percent >= 0.7 ? '#B8860B' : '#2D6A4F'}
              height={4}
            />
          </Card>
        );
      }}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionHeader: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  resourceRow: {
    gap: spacing.sm,
  },
  resourceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    paddingTop: spacing.xxxl,
  },
});
