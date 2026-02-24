import React, {useCallback, useRef, useState} from 'react';
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import {useTheme} from '../../app/providers/theme-provider';
import {spacing, typography} from '../theme';
import {Badge} from './badge';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SectionHeaderProps {
  title: string;
  count?: number;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export function SectionHeader({
  title,
  count,
  collapsible = false,
  defaultExpanded = true,
  children,
}: SectionHeaderProps) {
  const {colors} = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rotateAnim = useRef(new Animated.Value(defaultExpanded ? 1 : 0)).current;

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !expanded;
    setExpanded(next);
    Animated.timing(rotateAnim, {
      toValue: next ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [expanded, rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  return (
    <View style={styles.container}>
      <Pressable onPress={collapsible ? toggleExpanded : undefined} style={styles.header}>
        <View style={styles.titleRow}>
          {collapsible && (
            <Animated.Text
              style={[styles.chevron, {color: colors.mutedForeground, transform: [{rotate}]}]}>
              {'\u25B6'}
            </Animated.Text>
          )}
          <Text style={[typography.h3, {color: colors.foreground}]}>{title}</Text>
          {count !== undefined && <Badge label={String(count)} variant="outline" size="sm" />}
        </View>
      </Pressable>
      {(!collapsible || expanded) && <View>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  header: {
    paddingVertical: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chevron: {
    fontSize: 12,
  },
});
