import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../../../../app/providers/theme-provider';
import {spacing, typography} from '../../../../shared/theme';

export function TribesSection() {
  const {colors} = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Tribes (guilds) are player-formed alliances that work together toward
        common goals. Members share resources, coordinate attacks, and build
        hyperstructures together.
      </Text>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Join a tribe to access shared resources, coordinated defense, and the
        social aspects of Eternum. Lone players rarely survive long.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.md},
});
