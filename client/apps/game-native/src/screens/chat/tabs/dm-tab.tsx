import React, {useRef, useEffect} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import {ArrowLeft} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography} from '../../../shared/theme';
import {EmptyState, SectionHeader, ChatMessageSkeleton} from '../../../shared/ui';
import {MessageBubble} from '../components/message-bubble';
import {ChatInput} from '../components/chat-input';
import {UserListItem} from '../components/user-list-item';
import type {MessageGroup, User} from '../../../features/chat';

interface DMTabProps {
  onlineUsers: User[];
  offlineUsers: User[];
  unreadMessages: Record<string, number>;
  directMessageRecipient: string;
  messageGroups: MessageGroup[];
  userId: string;
  isLoading: boolean;
  onSelectRecipient: (userId: string) => void;
  onClearRecipient: () => void;
  onSendMessage: (text: string) => void;
}

export function DMTab({
  onlineUsers,
  offlineUsers,
  unreadMessages,
  directMessageRecipient,
  messageGroups,
  userId,
  isLoading,
  onSelectRecipient,
  onClearRecipient,
  onSendMessage,
}: DMTabProps) {
  const {colors} = useTheme();
  const listRef = useRef<FlashList<MessageGroup>>(null);

  useEffect(() => {
    if (messageGroups.length > 0 && directMessageRecipient) {
      setTimeout(() => listRef.current?.scrollToEnd({animated: true}), 100);
    }
  }, [messageGroups.length, directMessageRecipient]);

  if (!directMessageRecipient) {
    const filteredOnline = onlineUsers.filter(u => u.id !== userId);
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.userList}>
        {filteredOnline.length === 0 && offlineUsers.length === 0 ? (
          <EmptyState
            title="No users"
            message="Other players will appear here"
          />
        ) : (
          <>
            {filteredOnline.length > 0 && (
              <SectionHeader title={`Online (${filteredOnline.length})`}>
                {filteredOnline.map(user => (
                  <UserListItem
                    key={user.id}
                    user={user}
                    unreadCount={unreadMessages[user.id]}
                    onSelect={onSelectRecipient}
                  />
                ))}
              </SectionHeader>
            )}
            {offlineUsers.length > 0 && (
              <SectionHeader title={`Offline (${offlineUsers.length})`}>
                {offlineUsers.map(user => (
                  <UserListItem
                    key={user.id}
                    user={user}
                    unreadCount={unreadMessages[user.id]}
                    onSelect={onSelectRecipient}
                  />
                ))}
              </SectionHeader>
            )}
          </>
        )}
      </ScrollView>
    );
  }

  const recipientUser = [...onlineUsers, ...offlineUsers].find(
    u => u.id === directMessageRecipient,
  );

  return (
    <View style={styles.container}>
      <Pressable style={styles.recipientHeader} onPress={onClearRecipient}>
        <ArrowLeft size={20} color={colors.primary} />
        <View
          style={[
            styles.indicator,
            {
              backgroundColor: recipientUser?.is_online
                ? '#2D6A4F'
                : colors.muted,
            },
          ]}
        />
        <Text style={[typography.label, {color: colors.primary}]}>
          {recipientUser?.username || directMessageRecipient}
        </Text>
      </Pressable>
      {isLoading ? (
        <View style={styles.skeletons}>
          {Array.from({length: 5}).map((_, i) => (
            <ChatMessageSkeleton key={i} />
          ))}
        </View>
      ) : messageGroups.length === 0 ? (
        <EmptyState title="No messages" message="Start the conversation" />
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
  userList: {gap: spacing.sm, paddingHorizontal: spacing.md},
  listContent: {paddingVertical: spacing.md},
  recipientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  indicator: {width: 8, height: 8, borderRadius: 4},
  skeletons: {padding: spacing.md, gap: spacing.sm},
});
