import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {Mountain, Trees, Wheat, Snowflake, Waves, Wind, MapPin} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {borderRadius, spacing, typography} from '../../../shared/theme';
import type {HexPosition, HexTile} from '../types';

interface NeighborhoodViewProps {
  center: HexPosition;
  neighbors: HexTile[];
  onHexPress?: (hex: HexTile) => void;
}

const BIOME_CONFIG: Record<string, {icon: typeof Mountain; color: string}> = {
  Desert: {icon: Wind, color: '#C2B280'},
  Forest: {icon: Trees, color: '#2D6A4F'},
  Plains: {icon: Wheat, color: '#8B9B3E'},
  Mountains: {icon: Mountain, color: '#6B6B6B'},
  Swamp: {icon: Waves, color: '#4A7C59'},
  Tundra: {icon: Snowflake, color: '#87CEEB'},
  Ocean: {icon: Waves, color: '#2E6B9E'},
};

function HexCell({
  tile,
  isCenter,
  onPress,
}: {
  tile: HexTile | null;
  isCenter?: boolean;
  onPress?: () => void;
}) {
  const {colors} = useTheme();

  if (isCenter) {
    return (
      <View style={[styles.hex, styles.centerHex, {backgroundColor: colors.primary}]}>
        <MapPin size={14} color={colors.primaryForeground} />
        <Text style={[typography.caption, {color: colors.primaryForeground}]}>You</Text>
      </View>
    );
  }

  if (!tile) {
    return <View style={[styles.hex, {backgroundColor: colors.muted, opacity: 0.3}]} />;
  }

  const biomeConfig = BIOME_CONFIG[tile.biome] ?? BIOME_CONFIG.Plains;
  const BiomeIcon = biomeConfig.icon;
  const bgColor = tile.explored ? biomeConfig.color + '30' : colors.muted;
  const borderColor = tile.occupier ? '#BF2626' : tile.explored ? biomeConfig.color + '60' : colors.border;

  return (
    <TouchableOpacity
      style={[styles.hex, {backgroundColor: bgColor, borderColor}]}
      onPress={onPress}
      activeOpacity={0.7}>
      <BiomeIcon size={12} color={tile.explored ? biomeConfig.color : colors.mutedForeground} />
      <Text
        style={[typography.caption, {color: tile.explored ? colors.foreground : colors.mutedForeground, fontSize: 9}]}
        numberOfLines={1}>
        {tile.explored ? tile.biome : '???'}
      </Text>
      {tile.occupier && (
        <View style={styles.occupierDot} />
      )}
    </TouchableOpacity>
  );
}

export function NeighborhoodView({center, neighbors, onHexPress}: NeighborhoodViewProps) {
  const {colors} = useTheme();

  // Arrange 6 neighbors + center in a hex-like grid layout
  // Row 0: [n0] [n1]      (top 2)
  // Row 1: [n2] [center] [n3]  (middle 3)
  // Row 2: [n4] [n5]      (bottom 2)
  const topRow = neighbors.slice(0, 2);
  const midLeft = neighbors[2] ?? null;
  const midRight = neighbors[3] ?? null;
  const botRow = neighbors.slice(4, 6);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[typography.label, {color: colors.foreground}]}>Neighborhood</Text>
        <Text style={[typography.caption, {color: colors.mutedForeground}]}>
          ({center.col}, {center.row})
        </Text>
      </View>

      <View style={styles.grid}>
        <View style={[styles.row, styles.offsetRow]}>
          {topRow.map((tile, i) => (
            <HexCell key={`top-${i}`} tile={tile} onPress={() => onHexPress?.(tile)} />
          ))}
        </View>

        <View style={styles.row}>
          <HexCell tile={midLeft} onPress={() => midLeft && onHexPress?.(midLeft)} />
          <HexCell tile={null} isCenter />
          <HexCell tile={midRight} onPress={() => midRight && onHexPress?.(midRight)} />
        </View>

        <View style={[styles.row, styles.offsetRow]}>
          {botRow.map((tile, i) => (
            <HexCell key={`bot-${i}`} tile={tile} onPress={() => onHexPress?.(tile)} />
          ))}
        </View>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, {backgroundColor: '#2D6A4F'}]} />
          <Text style={[typography.caption, {color: colors.mutedForeground}]}>Explored</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, {backgroundColor: colors.muted}]} />
          <Text style={[typography.caption, {color: colors.mutedForeground}]}>Fog</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, {backgroundColor: '#BF2626'}]} />
          <Text style={[typography.caption, {color: colors.mutedForeground}]}>Enemy</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grid: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  offsetRow: {
    paddingHorizontal: spacing.xl,
  },
  hex: {
    width: 72,
    height: 56,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  centerHex: {
    borderWidth: 2,
  },
  occupierDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#BF2626',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
