import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../../../../app/providers/theme-provider';
import {spacing, typography} from '../../../../shared/theme';

export function WorldStructuresSection() {
  const {colors} = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[typography.body, {color: colors.foreground}]}>
        World Structures are special buildings that exist on the map outside of
        realms. They provide powerful bonuses to whoever controls them.
      </Text>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Hyperstructures are the most important — building and controlling them
        is key to winning the game. They require massive resource investment
        from multiple players.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.md},
});
