import React from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import {AlertTriangle, Shield, Clock, Zap, ChevronRight} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {SectionHeader} from '../../../shared/ui/section-header';
import {EmptyState} from '../../../shared/ui/empty-state';
import {spacing, typography, borderRadius} from '../../../shared/theme';
import {useUrgentActions, type UrgentAction} from '../hooks/use-urgent-actions';

function getActionIcon(type: UrgentAction['type'], color: string) {
  const size = 18;
  switch (type) {
    case 'capacity': return <AlertTriangle size={size} color={color} />;
    case 'attack': return <Shield size={size} color={color} />;
    case 'expiring': return <Clock size={size} color={color} />;
    case 'stamina': return <Zap size={size} color={color} />;
  }
}

function UrgentActionRow({item}: {item: UrgentAction}) {
  const {colors} = useTheme();
  const isHigh = item.severity === 'high';
  const tintColor = isHigh ? colors.destructive : '#B8860B';
  const bgColor = isHigh ? colors.destructive + '18' : '#B8860B18';

  return (
    <Pressable
      style={({pressed}) => [
        styles.actionRow,
        {backgroundColor: bgColor, borderColor: tintColor + '40'},
        pressed && styles.pressed,
      ]}
      onPress={() => console.log('Navigate to realm', item.realmEntityId)}>
      <View style={styles.actionIconContainer}>
        {getActionIcon(item.type, tintColor)}
      </View>
      <Text
        style={[typography.bodySmall, styles.actionMessage, {color: colors.foreground}]}
        numberOfLines={2}>
        {item.message}
      </Text>
      <ChevronRight size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

export function UrgentActionsSection() {
  const {actions} = useUrgentActions();

  return (
    <SectionHeader title="Urgent Actions" count={actions.length}>
      {actions.length === 0 ? (
        <EmptyState title="All Clear" message="No urgent actions require your attention." />
      ) : (
        <FlatList
          data={actions}
          keyExtractor={item => item.id}
          renderItem={({item}) => <UrgentActionRow item={item} />}
          scrollEnabled={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SectionHeader>
  );
}

const styles = StyleSheet.create({
  listContent: {paddingHorizontal: spacing.lg},
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  actionIconContainer: {width: 32, alignItems: 'center'},
  actionMessage: {flex: 1},
  pressed: {opacity: 0.7},
  separator: {height: spacing.sm},
});
