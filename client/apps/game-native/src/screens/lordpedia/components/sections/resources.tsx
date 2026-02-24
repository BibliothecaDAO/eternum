import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../../../../app/providers/theme-provider';
import {spacing, typography} from '../../../../shared/theme';

export function ResourcesSection() {
  const {colors} = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[typography.body, {color: colors.foreground}]}>
        There are 22 resources in Eternum, ranging from common materials like
        Wood and Stone to rare resources like Dragonhide and Earthen Shard.
      </Text>
      <Text style={[typography.h3, {color: colors.foreground}]}>Production</Text>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Resources are produced automatically each tick based on your realm's
        attributes and buildings. Production can be boosted through upgrades and
        labor allocation.
      </Text>
      <Text style={[typography.h3, {color: colors.foreground}]}>Food</Text>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Wheat and Fish are special food resources needed to feed your armies and
        workers. Without food, production slows and armies lose strength.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.md},
});
