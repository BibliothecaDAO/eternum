import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../../../../app/providers/theme-provider';
import {spacing, typography} from '../../../../shared/theme';

export function PointsSection() {
  const {colors} = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Points determine your ranking on the leaderboard. They are earned
        through various activities throughout the game.
      </Text>
      <Text style={[typography.h3, {color: colors.foreground}]}>How to Earn</Text>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Build and upgrade structures, win battles, control world structures,
        complete trades, and contribute to hyperstructures. Each activity
        awards different point amounts.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.md},
});
