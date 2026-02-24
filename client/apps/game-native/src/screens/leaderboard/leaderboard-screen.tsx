import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {FlashList} from '@shopify/flash-list';
import {Trophy} from 'lucide-react-native';
import {useTheme} from '../../app/providers/theme-provider';
import {spacing, typography} from '../../shared/theme';
import {TabBar, EmptyState, LeaderboardRowSkeleton} from '../../shared/ui';
import {useLeaderboard} from './hooks/use-leaderboard';
import {LeaderboardHeader} from './components/leaderboard-header';
import {LeaderboardRow} from './components/leaderboard-row';
import type {LeaderboardCategory, LeaderboardEntry} from './types';

const TABS = [
  {key: 'points', label: 'Points'},
  {key: 'military', label: 'Military'},
  {key: 'economic', label: 'Economic'},
  {key: 'guilds', label: 'Guilds'},
];

export function LeaderboardScreen() {
  const {colors} = useTheme();
  const {category, setCategory, topThree, rest, isLoading} = useLeaderboard();

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, {backgroundColor: colors.background}]}
        edges={['top']}>
        <View style={styles.header}>
          <Trophy size={24} color={colors.foreground} />
          <Text style={[typography.h2, {color: colors.foreground}]}>
            Leaderboard
          </Text>
        </View>
        <View style={styles.skeletons}>
          {Array.from({length: 8}).map((_, i) => (
            <LeaderboardRowSkeleton key={i} />
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
        <Trophy size={24} color={colors.foreground} />
        <Text style={[typography.h2, {color: colors.foreground}]}>
          Leaderboard
        </Text>
      </View>

      <TabBar
        tabs={TABS}
        activeTab={category}
        onTabChange={key => setCategory(key as LeaderboardCategory)}
      />

      <View style={styles.content}>
        <LeaderboardHeader topThree={topThree} />
        {rest.length === 0 ? (
          <EmptyState title="No entries" message="Check back later" />
        ) : (
          <FlashList
            data={rest}
            renderItem={({item}: {item: LeaderboardEntry}) => (
              <LeaderboardRow entry={item} />
            )}
            estimatedItemSize={60}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  content: {flex: 1, paddingHorizontal: spacing.lg},
  listContent: {paddingBottom: spacing.xxxl * 2},
  separator: {height: spacing.sm},
  skeletons: {padding: spacing.lg, gap: spacing.sm},
});
