import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../../../../app/providers/theme-provider';
import {spacing, typography} from '../../../../shared/theme';

export function TheWorldSection() {
  const {colors} = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Eternum is a persistent, onchain world where players compete for
        dominance through resource management, diplomacy, and warfare. The world
        exists entirely on the Starknet blockchain, making every action
        permanent and verifiable.
      </Text>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Each season brings new challenges and opportunities. Players must
        establish realms, gather resources, build armies, and forge alliances to
        survive and thrive.
      </Text>
      <Text style={[typography.body, {color: colors.foreground}]}>
        The world operates in real-time with a tick-based system that drives
        resource production, troop movement, and building construction.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.md},
});
