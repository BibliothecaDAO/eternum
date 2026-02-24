import React, {useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {FlashList} from '@shopify/flash-list';
import {Target} from 'lucide-react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import {useTheme} from '../../app/providers/theme-provider';
import {spacing, typography} from '../../shared/theme';
import {Badge, TabBar, EmptyState, ListItemSkeleton} from '../../shared/ui';
import {useQuests} from './hooks/use-quests';
import {QuestCard} from './components/quest-card';
import {ClaimRewardSheet} from './sheets/claim-reward-sheet';
import type {Quest, QuestCategory} from './types';

const TABS = [
  {key: 'all', label: 'All'},
  {key: 'active', label: 'Active'},
  {key: 'available', label: 'Available'},
  {key: 'completed', label: 'Completed'},
];

export function QuestsScreen() {
  const {colors} = useTheme();
  const {quests, filter, setFilter, isLoading, activeCount} = useQuests();
  const sheetRef = useRef<BottomSheet>(null);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);

  const handleQuestPress = (quest: Quest) => {
    if (quest.status === 'completed') {
      setSelectedQuest(quest);
      sheetRef.current?.snapToIndex(0);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, {backgroundColor: colors.background}]}
        edges={['top']}>
        <View style={styles.header}>
          <Target size={24} color={colors.foreground} />
          <Text style={[typography.h2, {color: colors.foreground}]}>Quests</Text>
        </View>
        <View style={styles.skeletons}>
          {Array.from({length: 5}).map((_, i) => (
            <ListItemSkeleton key={i} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: colors.background}]}
      edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Target size={24} color={colors.foreground} />
          <Text style={[typography.h2, {color: colors.foreground}]}>Quests</Text>
        </View>
        {activeCount > 0 && (
          <Badge label={`${activeCount} active`} variant="default" size="sm" />
        )}
      </View>

      <TabBar
        tabs={TABS}
        activeTab={filter}
        onTabChange={key => setFilter(key as QuestCategory)}
      />

      <View style={styles.content}>
        {quests.length === 0 ? (
          <EmptyState
            icon={<Target size={32} color={colors.mutedForeground} />}
            title="No quests"
            message="Check back later for new quests"
          />
        ) : (
          <FlashList
            data={quests}
            renderItem={({item}: {item: Quest}) => (
              <QuestCard quest={item} onPress={handleQuestPress} />
            )}
            estimatedItemSize={120}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <ClaimRewardSheet
        ref={sheetRef}
        quest={selectedQuest}
        onClaim={() => {
          // TODO: Implement claim reward
          setSelectedQuest(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  content: {flex: 1, paddingHorizontal: spacing.lg},
  listContent: {paddingBottom: spacing.xxxl * 2},
  separator: {height: spacing.sm},
  skeletons: {padding: spacing.lg, gap: spacing.sm},
});
