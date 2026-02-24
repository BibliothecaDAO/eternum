import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {CheckCircle, Circle} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {borderRadius, spacing, typography} from '../../../shared/theme';
import {Badge, ProgressBar} from '../../../shared/ui';
import type {Quest} from '../types';

interface QuestCardProps {
  quest: Quest;
  onPress: (quest: Quest) => void;
}

const CATEGORY_VARIANTS: Record<string, 'default' | 'warning' | 'success' | 'outline'> = {
  economic: 'default',
  military: 'warning',
  exploration: 'success',
  social: 'outline',
};

export function QuestCard({quest, onPress}: QuestCardProps) {
  const {colors} = useTheme();
  const isCompleted = quest.status === 'completed';

  return (
    <Pressable
      style={({pressed}) => [
        styles.container,
        {backgroundColor: colors.card, borderColor: colors.border},
        pressed && styles.pressed,
      ]}
      onPress={() => onPress(quest)}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {isCompleted ? (
            <CheckCircle size={18} color="#2D6A4F" />
          ) : (
            <Circle size={18} color={colors.mutedForeground} />
          )}
          <Text
            style={[
              typography.body,
              {color: colors.foreground},
              isCompleted && {textDecorationLine: 'line-through' as const},
            ]}>
            {quest.title}
          </Text>
        </View>
        <Badge
          label={quest.category}
          variant={CATEGORY_VARIANTS[quest.category] || 'outline'}
          size="sm"
        />
      </View>
      <Text
        style={[typography.bodySmall, {color: colors.mutedForeground}]}
        numberOfLines={2}>
        {quest.description}
      </Text>
      {!isCompleted && (
        <ProgressBar progress={quest.progress} showLabel />
      )}
      <View style={styles.footer}>
        <Text style={[typography.caption, {color: colors.primary}]}>
          Reward: {quest.reward.amount} {quest.reward.type}
        </Text>
        <Text style={[typography.caption, {color: colors.mutedForeground}]}>
          {quest.steps.filter(s => s.completed).length}/{quest.steps.length} steps
        </Text>
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
  titleRow: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pressed: {opacity: 0.8},
});
