import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {ArrowUp, Send, Info, Star} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography} from '../../../shared/theme';
import {Card} from '../../../shared/ui/card';
import {Button} from '../../../shared/ui/button';
import {Badge} from '../../../shared/ui/badge';
import type {RealmSummary} from '../hooks/use-realm-summary';

interface ActionsTabProps {
  realm: RealmSummary;
}

export function ActionsTab({realm}: ActionsTabProps) {
  const {colors} = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Level Up */}
      <Card style={styles.actionCard}>
        <View style={styles.actionHeader}>
          <View style={styles.actionIcon}>
            <ArrowUp size={20} color={colors.primary} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={[typography.label, {color: colors.foreground}]}>Level Up Realm</Text>
            <Text style={[typography.caption, {color: colors.mutedForeground}]}>
              Current: Lv.{realm.level} {realm.levelName}
            </Text>
          </View>
        </View>
        <Button
          title="Upgrade"
          variant="primary"
          size="sm"
          onPress={() => {
            // TODO: Open upgrade bottom sheet (Sub-Phase 2e)
            console.log('Open upgrade sheet for realm', realm.entityId);
          }}
        />
      </Card>

      {/* Transfer Ownership */}
      <Card style={styles.actionCard}>
        <View style={styles.actionHeader}>
          <View style={styles.actionIcon}>
            <Send size={20} color={colors.mutedForeground} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={[typography.label, {color: colors.foreground}]}>Transfer Ownership</Text>
            <Text style={[typography.caption, {color: colors.mutedForeground}]}>
              Transfer this realm to another player
            </Text>
          </View>
        </View>
        <Button
          title="Transfer"
          variant="ghost"
          size="sm"
          onPress={() => {
            // TODO: Implement transfer flow
            console.log('Transfer realm', realm.entityId);
          }}
        />
      </Card>

      {/* Realm Info */}
      <Card style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Info size={18} color={colors.mutedForeground} />
          <Text style={[typography.label, {color: colors.foreground}]}>Realm Info</Text>
        </View>
        <View style={styles.infoGrid}>
          <InfoRow label="Entity ID" value={String(realm.entityId)} colors={colors} />
          <InfoRow label="Coordinates" value={`(${realm.coordX}, ${realm.coordY})`} colors={colors} />
          <InfoRow label="Level" value={`${realm.level} - ${realm.levelName}`} colors={colors} />
          <InfoRow label="Buildings" value={`${realm.buildingCount} / ${realm.totalSlots}`} colors={colors} />
          <InfoRow label="Guard Status" value={realm.guardStatus === 'defended' ? 'Defended' : 'Vulnerable'} colors={colors} />
          <InfoRow label="Production" value={realm.productionStatus === 'running' ? 'Running' : realm.productionStatus === 'at-capacity' ? 'At Capacity' : 'Paused'} colors={colors} />
          <InfoRow label="Capacity" value={`${Math.round(realm.capacityPercent * 100)}%`} colors={colors} />
        </View>
      </Card>

      {/* Resources Count */}
      <Card style={styles.actionCard}>
        <View style={styles.actionHeader}>
          <View style={styles.actionIcon}>
            <Star size={20} color={colors.primary} />
          </View>
          <View style={styles.actionInfo}>
            <Text style={[typography.label, {color: colors.foreground}]}>Resource Types</Text>
            <Text style={[typography.caption, {color: colors.mutedForeground}]}>
              {realm.topResources.length} resources being tracked
            </Text>
          </View>
        </View>
        <Badge label={String(realm.topResources.length)} variant="outline" size="sm" />
      </Card>
    </ScrollView>
  );
}

function InfoRow({label, value, colors}: {label: string; value: string; colors: any}) {
  return (
    <View style={styles.infoRow}>
      <Text style={[typography.caption, {color: colors.mutedForeground}]}>{label}</Text>
      <Text style={[typography.bodySmall, {color: colors.foreground}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  actionIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionInfo: {
    flex: 1,
  },
  infoCard: {
    gap: spacing.md,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoGrid: {
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
