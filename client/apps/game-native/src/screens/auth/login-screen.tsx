import React from 'react';
import {View, Text, StyleSheet, Pressable} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '../../app/providers/theme-provider';
import {useAuth} from '../../shared/hooks/use-auth';

export function LoginScreen() {
  const {colors} = useTheme();
  const {login} = useAuth();

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.content}>
        <Text style={[styles.title, {color: colors.foreground}]}>Eternum</Text>
        <Text style={[styles.subtitle, {color: colors.mutedForeground}]}>
          On-chain Strategy
        </Text>
        <Pressable
          style={[styles.button, {backgroundColor: colors.primary}]}
          onPress={login}>
          <Text style={[styles.buttonText, {color: colors.primaryForeground}]}>
            Connect Wallet
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  content: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16},
  title: {fontSize: 36, fontWeight: '700'},
  subtitle: {fontSize: 16, marginBottom: 32},
  button: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {fontSize: 16, fontWeight: '600'},
});
