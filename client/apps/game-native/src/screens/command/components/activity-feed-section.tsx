import React from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';
import {Sword, ArrowLeftRight, Compass, Users} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {SectionHeader} from '../../../shared/ui/section-header';
import {EmptyState} from '../../../shared/ui/empty-state';
import {spacing, typography, borderRadius} from '../../../shared/theme';
import {useActivityFeed, formatRelativeTime, type ActivityEvent} from '../hooks/use-activity-feed';

function getActivityIcon(type: ActivityEvent['type'], color: string) {
  const size = 16;
  switch (type) {
    case 'battle': return <Sword size={size} color={color} />;
    case 'trade': return <ArrowLeftRight size={size} color={color} />;
    case 'exploration': return <Compass size={size} color={color} />;
    case 'guild': return <Users size={size} color={color} />;
  }
}

function ActivityFeedItem({event}: {event: ActivityEvent}) {
  const {colors} = useTheme();

  return (
    <View style={styles.feedRow}>
      <View style={[styles.feedIconContainer, {backgroundColor: colors.secondary}]}>
        {getActivityIcon(event.type, colors.foreground)}
      </View>
      <Text
        style={[typography.bodySmall, styles.feedMessage, {color: colors.foreground}]}
        numberOfLines={2}>
        {event.message}
      </Text>
      <Text style={[typography.caption, {color: colors.mutedForeground}]}>
        {formatRelativeTime(event.timestamp)}
      </Text>
    </View>
  );
}

export function ActivityFeedSection() {
  const {events, totalCount} = useActivityFeed();

  return (
    <SectionHeader title="Activity" count={totalCount} collapsible defaultExpanded>
      {events.length === 0 ? (
        <EmptyState title="No Activity" message="Recent battles, trades, and exploration events will appear here." />
      ) : (
        <FlatList
          data={events}
          keyExtractor={item => item.id}
          renderItem={({item}) => <ActivityFeedItem event={item} />}
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
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  feedIconContainer: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedMessage: {flex: 1},
  separator: {height: 1},
});
