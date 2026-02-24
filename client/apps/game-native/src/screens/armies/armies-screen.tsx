import React, {useCallback, useRef} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {FlashList} from '@shopify/flash-list';
import BottomSheet from '@gorhom/bottom-sheet';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Navigation, Swords, Shield} from 'lucide-react-native';
import {useTheme} from '../../app/providers/theme-provider';
import {spacing, typography} from '../../shared/theme';
import {SwipeableCard} from '../../shared/ui/swipeable-card';
import {Badge} from '../../shared/ui/badge';
import {EmptyState} from '../../shared/ui/empty-state';
import {ArmyCard} from './components/army-card';
import {MoveSheet} from './sheets/move-sheet';
import {useArmyList} from './hooks/use-army-list';
import type {ArmiesStackParamList} from '../../app/config/types';
import type {ArmySummary} from './types';

type ArmiesNav = NativeStackNavigationProp<ArmiesStackParamList>;

export function ArmiesScreen() {
  const {colors} = useTheme();
  const navigation = useNavigation<ArmiesNav>();
  const {armies, totalCount, armiesByStatus} = useArmyList();
  const moveSheetRef = useRef<BottomSheet>(null);
  const selectedArmyRef = useRef<ArmySummary | null>(null);

  const handleArmyPress = useCallback(
    (army: ArmySummary) => {
      navigation.navigate('ArmyDetail', {armyEntityId: army.entityId});
    },
    [navigation],
  );

  const handleSwipeMove = useCallback((army: ArmySummary) => {
    selectedArmyRef.current = army;
    moveSheetRef.current?.snapToIndex(0);
  }, []);

  const handleMoveConfirm = useCallback((_col: number, _row: number) => {
    // TODO: Wire to real move transaction
    moveSheetRef.current?.close();
  }, []);

  const renderArmyItem = useCallback(
    ({item}: {item: ArmySummary}) => (
      <SwipeableCard
        onSwipeRight={() => handleSwipeMove(item)}
        leftContent={() => (
          <View style={styles.swipeAction}>
            <Navigation size={20} color="#FFFFFF" />
            <Text style={styles.swipeText}>Move</Text>
          </View>
        )}
        rightContent={() => (
          <View style={[styles.swipeAction, styles.swipeAttack]}>
            <Swords size={20} color="#FFFFFF" />
            <Text style={styles.swipeText}>Attack</Text>
          </View>
        )}>
        <ArmyCard army={item} />
      </SwipeableCard>
    ),
    [handleSwipeMove],
  );

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: colors.background}]}
      edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Shield size={24} color={colors.foreground} />
          <Text style={[typography.h2, {color: colors.foreground}]}>Armies</Text>
          <Badge label={String(totalCount)} variant="outline" size="sm" />
        </View>
        <View style={styles.statusSummary}>
          <Badge label={`${armiesByStatus.active.length} Active`} variant="warning" size="sm" />
          <Badge label={`${armiesByStatus.idle.length} Idle`} variant="outline" size="sm" />
          <Badge label={`${armiesByStatus.garrisoned.length} Guard`} variant="success" size="sm" />
        </View>
      </View>

      {armies.length === 0 ? (
        <EmptyState
          title="No Armies"
          message="Create armies from the Military tab on your Realm."
          style={styles.emptyState}
        />
      ) : (
        <FlashList
          data={armies}
          renderItem={renderArmyItem}
          estimatedItemSize={120}
          keyExtractor={item => String(item.entityId)}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {selectedArmyRef.current && (
        <MoveSheet
          ref={moveSheetRef}
          army={selectedArmyRef.current}
          onConfirm={handleMoveConfirm}
          onClose={() => {
            selectedArmyRef.current = null;
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusSummary: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  separator: {
    height: spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
  },
  swipeAction: {
    backgroundColor: '#2D6A4F',
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minWidth: 70,
  },
  swipeAttack: {
    backgroundColor: '#BF2626',
  },
  swipeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
