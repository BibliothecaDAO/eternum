import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text} from 'react-native';
import {useTheme} from '../../app/providers/theme-provider';
import {borderRadius, spacing, typography} from '../theme';

interface Tab {
  key: string;
  label: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export function TabBar({tabs, activeTab, onTabChange}: TabBarProps) {
  const {colors} = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}>
      {tabs.map(tab => {
        const isActive = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            style={[
              styles.tab,
              {
                backgroundColor: isActive ? colors.primary : 'transparent',
                borderColor: colors.border,
              },
              !isActive && styles.inactiveTab,
            ]}>
            <Text
              style={[
                typography.label,
                {color: isActive ? colors.primaryForeground : colors.mutedForeground},
              ]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
  },
  inactiveTab: {
    borderWidth: 1,
  },
});
