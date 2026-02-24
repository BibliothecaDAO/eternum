import React from 'react';
import {View, Text, StyleSheet, Pressable} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '../../app/providers/theme-provider';
import {useAuth} from '../../shared/hooks/use-auth';

export function MoreScreen() {
  const {colors, isDark, setMode} = useTheme();
  const {logout} = useAuth();

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.content}>
        <Text style={[styles.title, {color: colors.foreground}]}>More</Text>
        <Text style={[styles.subtitle, {color: colors.mutedForeground}]}>
          Settings & Social - Phase 5
        </Text>
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionButton, {backgroundColor: colors.secondary}]}
            onPress={() => setMode(isDark ? 'light' : 'dark')}>
            <Text style={{color: colors.secondaryForeground}}>
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.actionButton,
              {backgroundColor: colors.destructive},
            ]}
            onPress={logout}>
            <Text style={{color: colors.destructiveForeground}}>
              Disconnect
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {fontSize: 24, fontWeight: '700'},
  subtitle: {fontSize: 14},
  actions: {marginTop: 24, gap: 12, width: '60%'},
  actionButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
});
