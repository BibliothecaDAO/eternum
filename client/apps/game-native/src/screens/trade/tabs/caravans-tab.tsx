import React, {useCallback} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import {Truck} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography} from '../../../shared/theme';
import {Badge} from '../../../shared/ui/badge';
import {EmptyState} from '../../../shared/ui/empty-state';
import {SectionHeader} from '../../../shared/ui/section-header';
import {CaravanCard} from '../components/caravan-card';
import {useCaravans} from '../hooks/use-caravans';
import type {CaravanInfo} from '../types';

export function CaravansTab() {
  const {colors} = useTheme();
  const {readyToClaim, inTransit, totalCount} = useCaravans();

  const handleCaravanPress = useCallback((_caravan: CaravanInfo) => {
    // TODO: Navigate to caravan detail or show on neighborhood view
  }, []);

  const handleClaim = useCallback((_caravan: CaravanInfo) => {
    // TODO: Wire to real arrivals_offload system call
  }, []);

  if (totalCount === 0) {
    return (
      <EmptyState
        icon={<Truck size={32} color={colors.mutedForeground} />}
        title="No Caravans"
        message="Trade resources to see caravans here."
      />
    );
  }

  return (
    <View style={styles.container}>
      {readyToClaim.length > 0 && (
        <SectionHeader title="Ready to Claim" count={readyToClaim.length}>
          <View style={styles.sectionList}>
            {readyToClaim.map(caravan => (
              <CaravanCard
                key={caravan.caravanId}
                caravan={caravan}
                onPress={handleCaravanPress}
                onClaim={handleClaim}
              />
            ))}
          </View>
        </SectionHeader>
      )}

      {inTransit.length > 0 && (
        <SectionHeader title="In Transit" count={inTransit.length}>
          <View style={styles.sectionList}>
            {inTransit.map(caravan => (
              <CaravanCard
                key={caravan.caravanId}
                caravan={caravan}
                onPress={handleCaravanPress}
              />
            ))}
          </View>
        </SectionHeader>
      )}

      <View style={styles.statsRow}>
        <Badge label={`${readyToClaim.length} Ready`} variant="success" size="sm" />
        <Badge label={`${inTransit.length} In Transit`} variant="warning" size="sm" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.lg,
  },
  sectionList: {
    gap: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
});
