import React, {useCallback, useState} from 'react';
import {RefreshControl, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '../../app/providers/theme-provider';
import {spacing, typography} from '../../shared/theme';
import {QuickStatsBar} from './components/quick-stats-bar';
import {UrgentActionsSection} from './components/urgent-actions-section';
import {ReadyToClaimSection} from './components/ready-to-claim-section';
import {ActivityFeedSection} from './components/activity-feed-section';

export function CommandScreen() {
  const {colors} = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // TODO: Trigger real data refresh via Torii/Dojo queries
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }>
        <View style={styles.header}>
          <Text style={[typography.h1, {color: colors.foreground}]}>Command</Text>
        </View>
        <QuickStatsBar />
        <View style={styles.sections}>
          <UrgentActionsSection />
          <ReadyToClaimSection />
          <ActivityFeedSection />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  scrollContent: {paddingBottom: spacing.xxxl},
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  sections: {
    gap: spacing.lg,
    marginTop: spacing.md,
  },
});
