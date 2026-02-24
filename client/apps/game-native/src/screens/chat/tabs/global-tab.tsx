import React, {useRef, useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import {MessageSquare} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing} from '../../../shared/theme';
import {EmptyState, ChatMessageSkeleton} from '../../../shared/ui';
import {MessageBubble} from '../components/message-bubble';
import {ChatInput} from '../components/chat-input';
import type {MessageGroup} from '../../../features/chat';

interface GlobalTabProps {
  messageGroups: MessageGroup[];
  userId: string;
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  onSelectRecipient: (userId: string) => void;
}

export function GlobalTab({
  messageGroups,
  userId,
  isLoading,
  onSendMessage,
  onSelectRecipient,
}: GlobalTabProps) {
  const {colors} = useTheme();
  const listRef = useRef<FlashList<MessageGroup>>(null);

  useEffect(() => {
    if (messageGroups.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({animated: true}), 100);
    }
  }, [messageGroups.length]);

  if (isLoading) {
    return (
      <View style={styles.skeletons}>
        {Array.from({length: 5}).map((_, i) => (
          <ChatMessageSkeleton key={i} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {messageGroups.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={32} color={colors.mutedForeground} />}
          title="No messages yet"
          message="Be the first to say something!"
        />
      ) : (
        <FlashList
          ref={listRef}
          data={messageGroups}
          renderItem={({item}) => (
            <MessageBubble
              group={item}
              userId={userId}
              onSelectRecipient={onSelectRecipient}
            />
          )}
          estimatedItemSize={60}
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
      <ChatInput onSend={onSendMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  listContent: {paddingVertical: spacing.md},
  skeletons: {padding: spacing.md, gap: spacing.sm},
});
