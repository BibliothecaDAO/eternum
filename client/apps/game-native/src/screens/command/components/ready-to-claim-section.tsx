import React from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';
import {Package, Gift, Zap} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {SectionHeader} from '../../../shared/ui/section-header';
import {Button} from '../../../shared/ui/button';
import {ResourceIcon} from '../../../shared/ui/resource-icon';
import {EmptyState} from '../../../shared/ui/empty-state';
import {spacing, typography, borderRadius} from '../../../shared/theme';
import {useClaimableItems, type ClaimableItem} from '../hooks/use-claimable-items';

function getClaimIcon(type: ClaimableItem['type'], color: string) {
  const size = 18;
  switch (type) {
    case 'caravan': return <Package size={size} color={color} />;
    case 'quest': return <Gift size={size} color={color} />;
    case 'overflow': return <Zap size={size} color={color} />;
  }
}

function ClaimableItemRow({item}: {item: ClaimableItem}) {
  const {colors} = useTheme();

  return (
    <View style={[styles.claimRow, {backgroundColor: colors.card, borderColor: colors.border}]}>
      <View style={styles.claimIconContainer}>
        {getClaimIcon(item.type, colors.primary)}
      </View>
      <View style={styles.claimContent}>
        <Text style={[typography.bodySmall, {color: colors.foreground}]} numberOfLines={1}>
          {item.message}
        </Text>
        <View style={styles.resourceList}>
          {item.resources.slice(0, 3).map((res, idx) => (
            <View key={idx} style={styles.resourceChip}>
              <ResourceIcon resourceId={res.resourceId} size={14} />
              <Text style={[typography.caption, {color: colors.mutedForeground}]}>{res.amount}</Text>
            </View>
          ))}
          {item.resources.length > 3 && (
            <Text style={[typography.caption, {color: colors.mutedForeground}]}>
              +{item.resources.length - 3}
            </Text>
          )}
        </View>
      </View>
      {item.onClaim && <Button title="Claim" onPress={item.onClaim} variant="primary" size="sm" />}
    </View>
  );
}

export function ReadyToClaimSection() {
  const {items, totalCount} = useClaimableItems();

  return (
    <SectionHeader title="Ready to Claim" count={totalCount}>
      {items.length === 0 ? (
        <EmptyState title="Nothing to Claim" message="Caravans, quest rewards, and overflow will appear here." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={({item}) => <ClaimableItemRow item={item} />}
          scrollEnabled={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SectionHeader>
  );
}

const styles = StyleSheet.create({
  listContent: {paddingHorizontal: spacing.lg},
  claimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  claimIconContainer: {width: 32, alignItems: 'center'},
  claimContent: {flex: 1, gap: spacing.xs},
  resourceList: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  resourceChip: {flexDirection: 'row', alignItems: 'center', gap: 2},
  separator: {height: spacing.sm},
});
