import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../../../../app/providers/theme-provider';
import {spacing, typography} from '../../../../shared/theme';

export function RealmsSection() {
  const {colors} = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Realms are the foundation of your empire. Each realm has a unique set of
        resources it can produce, determined by the original Realms NFT
        attributes.
      </Text>
      <Text style={[typography.body, {color: colors.foreground}]}>
        A realm can produce up to 7 different resources. The rarer the resource
        combination, the more valuable your realm becomes in the broader economy.
      </Text>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Build structures on your realm to increase production, defend against
        attacks, and expand your capabilities.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.md},
});
