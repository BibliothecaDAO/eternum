import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../../../../app/providers/theme-provider';
import {spacing, typography} from '../../../../shared/theme';

export function CombatSection() {
  const {colors} = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Combat in Eternum uses a rock-paper-scissors system. Knights beat
        archers, archers beat cavalry, and cavalry beats knights.
      </Text>
      <Text style={[typography.h3, {color: colors.foreground}]}>Armies</Text>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Create armies from your military buildings and send them to attack enemy
        realms, raid caravans, or defend strategic positions.
      </Text>
      <Text style={[typography.h3, {color: colors.foreground}]}>Raiding</Text>
      <Text style={[typography.body, {color: colors.foreground}]}>
        Armies can raid enemy realms to steal resources. Successful raids depend
        on army strength versus the defender's garrison.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.md},
});
