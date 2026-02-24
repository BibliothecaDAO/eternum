import React, {useCallback, useRef, useState} from 'react';
import {Pressable, RefreshControl, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import PagerView from 'react-native-pager-view';
import {FlashList} from '@shopify/flash-list';
import {Castle, LayoutGrid, Layers} from 'lucide-react-native';
import {useTheme} from '../../app/providers/theme-provider';
import {spacing, typography} from '../../shared/theme';
import {Badge} from '../../shared/ui/badge';
import {EmptyState} from '../../shared/ui/empty-state';
import {useRealmSummaries} from './hooks/use-realm-summary';
import {RealmCard} from './components/realm-card';
import type {RealmSummary} from './hooks/use-realm-summary';

type ViewMode = 'deck' | 'list';

export function RealmsScreen({navigation}: {navigation: any}) {
  const {colors} = useTheme();
  const realms = useRealmSummaries();
  const [viewMode, setViewMode] = useState<ViewMode>('deck');
  const [activePage, setActivePage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pagerRef = useRef<PagerView>(null);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // TODO: Re-fetch from Torii
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleRealmPress = useCallback((entityId: number) => {
    navigation.navigate('RealmDetail', {realmEntityId: entityId});
  }, [navigation]);

  const toggleViewMode = useCallback(() => {
    setViewMode(prev => (prev === 'deck' ? 'list' : 'deck'));
  }, []);

  const renderListItem = useCallback(
    ({item}: {item: RealmSummary}) => (
      <View style={styles.listItem}>
        <RealmCard realm={item} onPress={handleRealmPress} compact />
      </View>
    ),
    [handleRealmPress],
  );

  if (realms.length === 0) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
        <View style={styles.headerBar}>
          <Text style={[typography.h2, {color: colors.foreground}]}>Your Realms</Text>
        </View>
        <EmptyState
          icon={<Castle size={48} color={colors.mutedForeground} />}
          title="No Realms"
          message="You don't own any realms yet. Settle or conquer one to get started."
          style={styles.emptyState}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <Text style={[typography.h2, {color: colors.foreground}]}>Your Realms</Text>
          <Badge label={String(realms.length)} variant="outline" size="sm" />
        </View>
        <Pressable
          onPress={toggleViewMode}
          style={({pressed}) => [
            styles.viewToggle,
            {backgroundColor: colors.secondary},
            pressed && styles.viewTogglePressed,
          ]}>
          {viewMode === 'deck' ? (
            <Layers size={20} color={colors.foreground} />
          ) : (
            <LayoutGrid size={20} color={colors.foreground} />
          )}
        </Pressable>
      </View>

      {viewMode === 'deck' && (
        <View style={styles.deckContainer}>
          <PagerView
            ref={pagerRef}
            style={styles.pager}
            initialPage={0}
            onPageSelected={e => setActivePage(e.nativeEvent.position)}>
            {realms.map(realm => (
              <View key={realm.entityId} style={styles.pageItem}>
                <RealmCard realm={realm} onPress={handleRealmPress} />
              </View>
            ))}
          </PagerView>

          <View style={styles.dotsRow}>
            {realms.map((realm, index) => (
              <View
                key={realm.entityId}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      index === activePage ? colors.primary : colors.muted,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      )}

      {viewMode === 'list' && (
        <View style={styles.listContainer}>
          <FlashList
            data={realms}
            renderItem={renderListItem}
            estimatedItemSize={100}
            keyExtractor={item => String(item.entityId)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  viewToggle: {
    padding: spacing.sm,
    borderRadius: 8,
  },
  viewTogglePressed: {
    opacity: 0.7,
  },
  deckContainer: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  pageItem: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  listItem: {
    marginBottom: spacing.sm,
  },
  emptyState: {
    flex: 1,
  },
});
