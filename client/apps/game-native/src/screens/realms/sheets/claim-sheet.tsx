import React, {useRef, useImperativeHandle, forwardRef, useCallback} from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import {Package} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography} from '../../../shared/theme';
import {BottomSheetWrapper} from '../../../shared/ui/bottom-sheet-wrapper';
import {Card} from '../../../shared/ui/card';
import {Button} from '../../../shared/ui/button';
import {ResourceAmount} from '../../../shared/ui/resource-amount';
import {EmptyState} from '../../../shared/ui/empty-state';
import {useResourceArrivals} from '../../../features/resource-arrivals';

export interface ClaimSheetRef {
  open: () => void;
  close: () => void;
}

interface ClaimSheetProps {
  structureEntityId: number;
}

export const ClaimSheet = forwardRef<ClaimSheetRef, ClaimSheetProps>(
  ({structureEntityId}, ref) => {
    const sheetRef = useRef<BottomSheet>(null);
    const {claimable} = useResourceArrivals(structureEntityId);
    const {colors} = useTheme();

    useImperativeHandle(ref, () => ({
      open: () => sheetRef.current?.snapToIndex(0),
      close: () => sheetRef.current?.close(),
    }));

    const handleClaimAll = useCallback(() => {
      // TODO: Execute claim all system call via Dojo
      console.log('Claim all for structure', structureEntityId);
      sheetRef.current?.close();
    }, [structureEntityId]);

    return (
      <BottomSheetWrapper ref={sheetRef} title="Claim Resources" snapPoints={['50%', '80%']}>
        {claimable.length === 0 ? (
          <EmptyState
            title="Nothing to Claim"
            message="No resources are ready to be claimed."
          />
        ) : (
          <>
            <FlatList
              data={claimable}
              keyExtractor={item => String(item.entityId)}
              renderItem={({item}) => (
                <Card style={styles.arrivalCard}>
                  <View style={styles.arrivalHeader}>
                    <Package size={16} color={colors.primary} />
                    <Text style={[typography.bodySmall, {color: colors.foreground}]}>
                      Arrival #{item.entityId}
                    </Text>
                  </View>
                  <View style={styles.resourcesRow}>
                    {item.resources.map((res, idx) => (
                      <ResourceAmount
                        key={idx}
                        resourceId={res.resourceId}
                        amount={res.amount}
                        size="sm"
                      />
                    ))}
                  </View>
                </Card>
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
            <View style={styles.claimAllContainer}>
              <Button
                title={`Claim All (${claimable.length})`}
                variant="primary"
                size="lg"
                onPress={handleClaimAll}
              />
            </View>
          </>
        )}
      </BottomSheetWrapper>
    );
  },
);

ClaimSheet.displayName = 'ClaimSheet';

const styles = StyleSheet.create({
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  arrivalCard: {
    gap: spacing.sm,
  },
  arrivalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resourcesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  separator: {
    height: spacing.sm,
  },
  claimAllContainer: {
    paddingTop: spacing.md,
  },
});
