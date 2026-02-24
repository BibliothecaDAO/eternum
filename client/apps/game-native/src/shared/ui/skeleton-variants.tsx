import React from 'react';
import {StyleSheet, View} from 'react-native';
import {LoadingSkeleton} from './loading-skeleton';
import {spacing, borderRadius} from '../theme';

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <LoadingSkeleton width="100%" height={120} borderRadius={borderRadius.lg} />
      <LoadingSkeleton width="60%" height={16} />
      <LoadingSkeleton width="80%" height={12} />
    </View>
  );
}

export function ListItemSkeleton() {
  return (
    <View style={styles.listItem}>
      <LoadingSkeleton width={40} height={40} borderRadius={20} />
      <View style={styles.listItemText}>
        <LoadingSkeleton width="70%" height={14} />
        <LoadingSkeleton width="40%" height={12} />
      </View>
    </View>
  );
}

export function ChatMessageSkeleton() {
  return (
    <View style={styles.chatMessage}>
      <LoadingSkeleton width={32} height={32} borderRadius={16} />
      <View style={styles.chatBubble}>
        <LoadingSkeleton width="50%" height={12} />
        <LoadingSkeleton width="90%" height={14} />
        <LoadingSkeleton width="30%" height={10} />
      </View>
    </View>
  );
}

export function LeaderboardRowSkeleton() {
  return (
    <View style={styles.leaderboardRow}>
      <LoadingSkeleton width={24} height={16} />
      <LoadingSkeleton width={32} height={32} borderRadius={16} />
      <View style={{flex: 1}}>
        <LoadingSkeleton width="60%" height={14} />
      </View>
      <LoadingSkeleton width={48} height={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  listItemText: {
    flex: 1,
    gap: spacing.xs,
  },
  chatMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  chatBubble: {
    flex: 1,
    gap: spacing.xs,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
});
