import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {MessageSquare} from 'lucide-react-native';
import {useTheme} from '../../app/providers/theme-provider';
import {spacing, typography} from '../../shared/theme';
import {Badge, TabBar} from '../../shared/ui';
import {useChat} from './hooks/use-chat';
import {GlobalTab} from './tabs/global-tab';
import {RoomsTab} from './tabs/rooms-tab';
import {DMTab} from './tabs/dm-tab';

const CHAT_TABS = [
  {key: 'global', label: 'Global'},
  {key: 'rooms', label: 'Rooms'},
  {key: 'dm', label: 'Direct'},
];

export function ChatScreen() {
  const {colors} = useTheme();
  const [activeTab, setActiveTab] = useState('global');

  // TODO: Replace with actual username from account store
  const chat = useChat('Player');

  const totalUnread = Object.values(chat.unreadMessages).reduce(
    (sum, n) => sum + n,
    0,
  );

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: colors.background}]}
      edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <MessageSquare size={24} color={colors.foreground} />
          <Text style={[typography.h2, {color: colors.foreground}]}>Chat</Text>
          {!chat.isConnected && (
            <Badge label="Offline" variant="destructive" size="sm" />
          )}
          {totalUnread > 0 && (
            <Badge
              label={String(totalUnread)}
              variant="destructive"
              size="sm"
            />
          )}
        </View>
      </View>

      <TabBar tabs={CHAT_TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      <View style={styles.content}>
        {activeTab === 'global' && (
          <GlobalTab
            messageGroups={chat.messages}
            userId={chat.userId}
            isLoading={chat.isLoading}
            onSendMessage={chat.sendGlobalMessage}
            onSelectRecipient={userId => {
              chat.selectRecipient(userId);
              setActiveTab('dm');
            }}
          />
        )}
        {activeTab === 'rooms' && (
          <RoomsTab
            rooms={chat.rooms}
            activeRoom={chat.activeRoom}
            messageGroups={chat.messages}
            userId={chat.userId}
            isLoading={chat.isLoading}
            onJoinRoom={chat.joinRoom}
            onLeaveRoom={chat.leaveRoom}
            onSendMessage={chat.sendRoomMessage}
            onSelectRecipient={userId => {
              chat.selectRecipient(userId);
              setActiveTab('dm');
            }}
          />
        )}
        {activeTab === 'dm' && (
          <DMTab
            onlineUsers={chat.onlineUsers}
            offlineUsers={chat.offlineUsers}
            unreadMessages={chat.unreadMessages}
            directMessageRecipient={chat.directMessageRecipient}
            messageGroups={chat.messages}
            userId={chat.userId}
            isLoading={chat.isLoading}
            onSelectRecipient={chat.selectRecipient}
            onClearRecipient={chat.clearRecipient}
            onSendMessage={chat.sendDirectMessage}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  content: {flex: 1},
});
