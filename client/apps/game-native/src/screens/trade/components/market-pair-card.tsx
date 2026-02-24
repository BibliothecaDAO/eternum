import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {TrendingUp, TrendingDown} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography} from '../../../shared/theme';
import {ResourceIcon} from '../../../shared/ui/resource-icon';
import type {MarketPair} from '../types';

interface MarketPairCardProps {
  pair: MarketPair;
  onPress: (pair: MarketPair) => void;
}

export function MarketPairCard({pair, onPress}: MarketPairCardProps) {
  const {colors} = useTheme();
  const isPositive = pair.change24h >= 0;
  const changeColor = isPositive ? '#2D6A4F' : '#BF2626';

  return (
    <Pressable
      onPress={() => onPress(pair)}
      style={({pressed}) => [
        styles.container,
        {backgroundColor: colors.card, borderColor: colors.border},
        pressed && styles.pressed,
      ]}>
      <View style={styles.left}>
        <ResourceIcon resourceId={pair.resourceId} size={32} />
        <View style={styles.nameSection}>
          <Text style={[typography.body, {color: colors.foreground, fontWeight: '600'}]} numberOfLines={1}>
            {pair.resourceName}
          </Text>
          <Text style={[typography.caption, {color: colors.mutedForeground}]}>
            / LORDS
          </Text>
        </View>
      </View>

      <View style={styles.right}>
        <Text style={[typography.body, {color: colors.foreground, fontWeight: '600'}]}>
          {pair.price.toFixed(2)}
        </Text>
        <View style={styles.changeRow}>
          {isPositive ? (
            <TrendingUp size={12} color={changeColor} />
          ) : (
            <TrendingDown size={12} color={changeColor} />
          )}
          <Text style={[typography.caption, {color: changeColor, fontWeight: '500'}]}>
            {isPositive ? '+' : ''}{pair.change24h.toFixed(1)}%
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: 12,
  },
  pressed: {
    opacity: 0.8,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  nameSection: {
    gap: 2,
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
