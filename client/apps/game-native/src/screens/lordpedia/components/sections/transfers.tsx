import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../../../../app/providers/theme-provider';
import {spacing, typography} from '../../../../shared/theme';

export function TransfersSection() {
  const {colors} = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Resources can be transferred between realms using donkeys. Each donkey
        can carry a limited amount of resources, and travel time depends on
        distance.
      </Text>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Plan your transfers carefully — donkeys travelling through dangerous
        territory may be intercepted by enemy armies.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.md},
});
