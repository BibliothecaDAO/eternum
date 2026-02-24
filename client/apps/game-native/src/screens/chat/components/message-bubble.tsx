import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {borderRadius, spacing, typography} from '../../../shared/theme';
import type {MessageGroup} from '../../../features/chat';

interface MessageBubbleProps {
  group: MessageGroup;
  userId: string;
  onSelectRecipient?: (userId: string) => void;
}

export function MessageBubble({
  group,
  userId,
  onSelectRecipient,
}: MessageBubbleProps) {
  const {colors} = useTheme();
  const isSelf = group.senderId === userId;

  return (
    <View style={[styles.container, isSelf && styles.selfContainer]}>
      {!isSelf && (
        <Pressable onPress={() => onSelectRecipient?.(group.senderId)}>
          <Text style={[typography.caption, {color: colors.primary}]}>
            {group.senderUsername || group.senderId}
          </Text>
        </Pressable>
      )}
      {group.messages.map((msg, index) => (
        <View
          key={msg.id || index}
          style={[
            styles.bubble,
            isSelf
              ? {backgroundColor: colors.primary}
              : {backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1},
            isSelf && styles.selfBubble,
          ]}>
          <Text
            style={[
              typography.body,
              {
                color: isSelf ? colors.primaryForeground : colors.foreground,
              },
            ]}>
            {msg.message}
          </Text>
        </View>
      ))}
      <Text
        style={[
          typography.caption,
          styles.timestamp,
          {color: colors.mutedForeground},
          isSelf && styles.selfTimestamp,
        ]}>
        {new Date(
          group.messages[group.messages.length - 1].timestamp,
        ).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    maxWidth: '80%',
    alignSelf: 'flex-start',
    gap: 2,
  },
  selfContainer: {
    alignSelf: 'flex-end',
  },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  selfBubble: {
    borderWidth: 0,
  },
  timestamp: {
    marginTop: 2,
  },
  selfTimestamp: {
    textAlign: 'right',
  },
});
