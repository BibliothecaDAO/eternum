import React, {useRef, useEffect} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import {ArrowLeft} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography} from '../../../shared/theme';
import {EmptyState, ChatMessageSkeleton} from '../../../shared/ui';
import {MessageBubble} from '../components/message-bubble';
import {ChatInput} from '../components/chat-input';
import {RoomListItem} from '../components/room-list-item';
import type {MessageGroup, Room} from '../../../features/chat';

interface RoomsTabProps {
  rooms: Room[];
  activeRoom: string;
  messageGroups: MessageGroup[];
  userId: string;
  isLoading: boolean;
  onJoinRoom: (roomId: string) => void;
  onLeaveRoom: () => void;
  onSendMessage: (text: string) => void;
  onSelectRecipient: (userId: string) => void;
}

export function RoomsTab({
  rooms,
  activeRoom,
  messageGroups,
  userId,
  isLoading,
  onJoinRoom,
  onLeaveRoom,
  onSendMessage,
  onSelectRecipient,
}: RoomsTabProps) {
  const {colors} = useTheme();
  const listRef = useRef<FlashList<MessageGroup>>(null);

  useEffect(() => {
    if (messageGroups.length > 0 && activeRoom) {
      setTimeout(() => listRef.current?.scrollToEnd({animated: true}), 100);
    }
  }, [messageGroups.length, activeRoom]);

  if (!activeRoom) {
    return (
      <View style={styles.container}>
        {rooms.length === 0 ? (
          <EmptyState
            title="No rooms available"
            message="Chat rooms will appear here"
          />
        ) : (
          <FlashList
            data={rooms}
            renderItem={({item}) => (
              <RoomListItem room={item} onSelect={onJoinRoom} />
            )}
            estimatedItemSize={60}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  }

  const activeRoomData = rooms.find(r => r.id === activeRoom);

  return (
    <View style={styles.container}>
      <Pressable style={styles.roomHeader} onPress={onLeaveRoom}>
        <ArrowLeft size={20} color={colors.primary} />
        <Text style={[typography.label, {color: colors.primary}]}>
          {activeRoomData?.name || activeRoom}
        </Text>
      </Pressable>
      {isLoading ? (
        <View style={styles.skeletons}>
          {Array.from({length: 5}).map((_, i) => (
            <ChatMessageSkeleton key={i} />
          ))}
        </View>
      ) : messageGroups.length === 0 ? (
        <EmptyState
          title="No messages"
          message="Be the first to post in this room"
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
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  separator: {height: spacing.sm},
  skeletons: {padding: spacing.md, gap: spacing.sm},
});
