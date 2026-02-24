import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Users} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {borderRadius, spacing, typography} from '../../../shared/theme';
import {Badge} from '../../../shared/ui';
import type {Guild} from '../types';

interface GuildCardProps {
  guild: Guild;
  onPress: (guildId: string) => void;
}

export function GuildCard({guild, onPress}: GuildCardProps) {
  const {colors} = useTheme();

  return (
    <Pressable
      style={({pressed}) => [
        styles.container,
        {backgroundColor: colors.card, borderColor: colors.border},
        pressed && styles.pressed,
      ]}
      onPress={() => onPress(guild.id)}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[typography.h3, {color: colors.foreground}]}>
            #{guild.rank} {guild.name}
          </Text>
        </View>
        <Badge label={`${guild.totalPoints.toLocaleString()} pts`} variant="default" size="sm" />
      </View>
      <Text
        style={[typography.bodySmall, {color: colors.mutedForeground}]}
        numberOfLines={1}>
        {guild.description}
      </Text>
      <View style={styles.footer}>
        <View style={styles.memberInfo}>
          <Users size={14} color={colors.mutedForeground} />
          <Text style={[typography.caption, {color: colors.mutedForeground}]}>
            {guild.memberCount}/{guild.maxMembers} members
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {flex: 1, marginRight: spacing.sm},
  footer: {flexDirection: 'row', alignItems: 'center'},
  memberInfo: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  pressed: {opacity: 0.8},
});
