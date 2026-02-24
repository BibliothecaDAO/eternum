import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography, borderRadius} from '../../../shared/theme';
import {Badge} from '../../../shared/ui';
import type {User} from '../../../features/chat';

interface UserListItemProps {
  user: User;
  unreadCount?: number;
  onSelect: (userId: string) => void;
}

export function UserListItem({user, unreadCount, onSelect}: UserListItemProps) {
  const {colors} = useTheme();

  return (
    <Pressable
      style={({pressed}) => [
        styles.container,
        {backgroundColor: colors.card, borderColor: colors.border},
        pressed && styles.pressed,
      ]}
      onPress={() => onSelect(user.id)}>
      <View
        style={[
          styles.indicator,
          {backgroundColor: user.is_online ? '#2D6A4F' : colors.muted},
        ]}
      />
      <View style={styles.info}>
        <Text style={[typography.body, {color: colors.foreground}]}>
          {user.username || user.id}
        </Text>
        <Text style={[typography.caption, {color: colors.mutedForeground}]}>
          {user.is_online ? 'Online' : 'Offline'}
        </Text>
      </View>
      {unreadCount && unreadCount > 0 ? (
        <Badge label={String(unreadCount)} variant="destructive" size="sm" />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  indicator: {width: 10, height: 10, borderRadius: 5},
  info: {flex: 1, gap: 2},
  pressed: {opacity: 0.8},
});
