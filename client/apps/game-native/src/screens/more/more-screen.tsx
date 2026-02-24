import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  MessageSquare,
  Users,
  Trophy,
  Target,
  BookOpen,
  Moon,
  Sun,
  LogOut,
  ChevronRight,
} from 'lucide-react-native';
import {useTheme} from '../../app/providers/theme-provider';
import {useAuth} from '../../shared/hooks/use-auth';
import {spacing, typography, borderRadius} from '../../shared/theme';
import type {MoreStackParamList} from '../../app/config/types';

type MoreNav = NativeStackNavigationProp<MoreStackParamList>;

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  colors: any;
}

function MenuItem({icon, label, onPress, colors}: MenuItemProps) {
  return (
    <Pressable
      style={({pressed}) => [
        styles.menuItem,
        {backgroundColor: colors.card, borderColor: colors.border},
        pressed && styles.pressed,
      ]}
      onPress={onPress}>
      <View style={styles.menuItemLeft}>
        {icon}
        <Text style={[typography.body, {color: colors.foreground}]}>{label}</Text>
      </View>
      <ChevronRight size={20} color={colors.mutedForeground} />
    </Pressable>
  );
}

export function MoreScreen() {
  const {colors, isDark, setMode} = useTheme();
  const {logout} = useAuth();
  const navigation = useNavigation<MoreNav>();

  const menuItems = [
    {icon: <MessageSquare size={20} color={colors.primary} />, label: 'Chat', route: 'Chat' as const},
    {icon: <Users size={20} color={colors.primary} />, label: 'Guilds', route: 'Guild' as const},
    {icon: <Trophy size={20} color={colors.primary} />, label: 'Leaderboard', route: 'Leaderboard' as const},
    {icon: <Target size={20} color={colors.primary} />, label: 'Quests', route: 'Quests' as const},
    {icon: <BookOpen size={20} color={colors.primary} />, label: 'Lordpedia', route: 'Lordpedia' as const},
  ];

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[typography.h2, {color: colors.foreground}]}>More</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          {menuItems.map(item => (
            <MenuItem
              key={item.route}
              icon={item.icon}
              label={item.label}
              onPress={() => navigation.navigate(item.route)}
              colors={colors}
            />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={[typography.caption, {color: colors.mutedForeground}, styles.sectionLabel]}>Settings</Text>
          <Pressable
            style={({pressed}) => [
              styles.menuItem,
              {backgroundColor: colors.card, borderColor: colors.border},
              pressed && styles.pressed,
            ]}
            onPress={() => setMode(isDark ? 'light' : 'dark')}>
            <View style={styles.menuItemLeft}>
              {isDark ? <Sun size={20} color={colors.primary} /> : <Moon size={20} color={colors.primary} />}
              <Text style={[typography.body, {color: colors.foreground}]}>
                {isDark ? 'Light Mode' : 'Dark Mode'}
              </Text>
            </View>
          </Pressable>
          <Pressable
            style={({pressed}) => [
              styles.menuItem,
              {backgroundColor: colors.card, borderColor: colors.border},
              pressed && styles.pressed,
            ]}
            onPress={logout}>
            <View style={styles.menuItemLeft}>
              <LogOut size={20} color={colors.destructive} />
              <Text style={[typography.body, {color: colors.destructive}]}>Disconnect</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.8,
  },
});
