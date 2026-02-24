import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Hash} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography, borderRadius} from '../../../shared/theme';
import {Badge} from '../../../shared/ui';
import type {Room} from '../../../features/chat';

interface RoomListItemProps {
  room: Room;
  onSelect: (roomId: string) => void;
}

export function RoomListItem({room, onSelect}: RoomListItemProps) {
  const {colors} = useTheme();

  return (
    <Pressable
      style={({pressed}) => [
        styles.container,
        {backgroundColor: colors.card, borderColor: colors.border},
        pressed && styles.pressed,
      ]}
      onPress={() => onSelect(room.id)}>
      <Hash size={18} color={colors.primary} />
      <View style={styles.info}>
        <Text style={[typography.body, {color: colors.foreground}]}>
          {room.name || room.id}
        </Text>
      </View>
      {room.userCount !== undefined && (
        <Badge label={`${room.userCount} online`} variant="outline" size="sm" />
      )}
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
  info: {flex: 1},
  pressed: {opacity: 0.8},
});
