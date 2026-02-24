import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography, borderRadius} from '../../../shared/theme';
import {Badge} from '../../../shared/ui';
import type {GuildMember} from '../types';

interface MemberRowProps {
  member: GuildMember;
}

const ROLE_VARIANTS: Record<string, 'default' | 'warning' | 'outline'> = {
  leader: 'warning',
  officer: 'default',
  member: 'outline',
};

export function MemberRow({member}: MemberRowProps) {
  const {colors} = useTheme();

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: colors.card, borderColor: colors.border},
      ]}>
      <View
        style={[
          styles.indicator,
          {backgroundColor: member.isOnline ? '#2D6A4F' : colors.muted},
        ]}
      />
      <View style={styles.info}>
        <Text style={[typography.body, {color: colors.foreground}]}>
          {member.username}
        </Text>
        <Text style={[typography.caption, {color: colors.mutedForeground}]}>
          {member.points.toLocaleString()} pts
        </Text>
      </View>
      <Badge
        label={member.role}
        variant={ROLE_VARIANTS[member.role] || 'outline'}
        size="sm"
      />
    </View>
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
});
