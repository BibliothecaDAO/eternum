import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../../../../app/providers/theme-provider';
import {spacing, typography} from '../../../../shared/theme';

export function KeyConceptsSection() {
  const {colors} = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[typography.h3, {color: colors.foreground}]}>Ticks</Text>
      <Text style={[typography.body, {color: colors.foreground}]}>
        The world operates on a tick system. Each tick advances the game state -
        resources are produced, troops move, and buildings progress.
      </Text>
      <Text style={[typography.h3, {color: colors.foreground}]}>Lords</Text>
      <Text style={[typography.body, {color: colors.foreground}]}>
        $LORDS is the native token of Eternum. It is used for trading,
        building, and all economic activities within the game.
      </Text>
      <Text style={[typography.h3, {color: colors.foreground}]}>Donkeys</Text>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Donkeys are the backbone of your economy. They transport resources
        between realms and trading posts. Without donkeys, your resources
        cannot move.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.md},
});
