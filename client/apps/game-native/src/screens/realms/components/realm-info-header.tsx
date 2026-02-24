import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Castle, MapPin, Coins} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography, borderRadius} from '../../../shared/theme';
import {Badge} from '../../../shared/ui/badge';
import type {RealmSummary} from '../hooks/use-realm-summary';

interface RealmInfoHeaderProps {
  realm: RealmSummary;
  lordsBalance?: number;
}

export function RealmInfoHeader({realm, lordsBalance = 0}: RealmInfoHeaderProps) {
  const {colors} = useTheme();

  return (
    <View style={[styles.container, {borderBottomColor: colors.border}]}>
      <View style={styles.topRow}>
        <View style={styles.nameRow}>
          <Castle size={24} color={colors.primary} />
          <View style={styles.nameCol}>
            <Text style={[typography.h2, {color: colors.foreground}]}>{realm.name}</Text>
            <Text style={[typography.caption, {color: colors.mutedForeground}]}>
              Lv.{realm.level} {realm.levelName}
            </Text>
          </View>
        </View>
        <Badge label={`Lv.${realm.level}`} variant="default" size="sm" />
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoChip}>
          <MapPin size={14} color={colors.mutedForeground} />
          <Text style={[typography.caption, {color: colors.mutedForeground}]}>
            ({realm.coordX}, {realm.coordY})
          </Text>
        </View>
        <View style={styles.infoChip}>
          <Coins size={14} color={colors.primary} />
          <Text style={[typography.bodySmall, {color: colors.foreground}]}>
            {lordsBalance.toLocaleString()} LORDS
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  nameCol: {
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center',
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
