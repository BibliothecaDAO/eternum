import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../../../../app/providers/theme-provider';
import {spacing, typography} from '../../../../shared/theme';

export function TradingSection() {
  const {colors} = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Trading is essential to building a thriving empire. No single realm
        produces all resources, so trade is necessary for growth.
      </Text>
      <Text style={[typography.h3, {color: colors.foreground}]}>AMM (Market)</Text>
      <Text style={[typography.body, {color: colors.foreground}]}>
        The Automated Market Maker allows instant swaps between resources at
        market-determined rates. Prices shift based on supply and demand.
      </Text>
      <Text style={[typography.h3, {color: colors.foreground}]}>P2P Orders</Text>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Create direct orders specifying what you want and what you offer.
        Other players can accept your orders, and donkeys handle delivery.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.md},
});
