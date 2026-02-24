import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../../../../app/providers/theme-provider';
import {spacing, typography} from '../../../../shared/theme';

export function BuildingsSection() {
  const {colors} = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Buildings enhance your realm's capabilities. Each building type serves a
        specific purpose — from resource production boosts to military training.
      </Text>
      <Text style={[typography.h3, {color: colors.foreground}]}>Economic</Text>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Farms and fishing villages produce food. Mines and lumber mills increase
        base resource output. Markets enable local trading.
      </Text>
      <Text style={[typography.h3, {color: colors.foreground}]}>Military</Text>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Barracks train infantry, archery ranges produce archers, and stables
        breed cavalry. Each unit type has strengths and weaknesses.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.md},
});
