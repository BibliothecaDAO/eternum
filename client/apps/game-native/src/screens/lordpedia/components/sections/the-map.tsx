import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../../../../app/providers/theme-provider';
import {spacing, typography} from '../../../../shared/theme';

export function TheMapSection() {
  const {colors} = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[typography.body, {color: colors.foreground}]}>
        The world map is a hex-based grid where all realms, armies, and
        structures exist. Distance on the map directly affects travel time for
        armies and caravans.
      </Text>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Explore the map to discover unclaimed territories, resource deposits,
        and strategic positions. The fog of war lifts as your armies scout new
        areas.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.md},
});
