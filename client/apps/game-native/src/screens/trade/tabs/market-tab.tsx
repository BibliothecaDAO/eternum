import React, {useCallback, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import BottomSheet from '@gorhom/bottom-sheet';
import {ArrowUpDown} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography} from '../../../shared/theme';
import {Button} from '../../../shared/ui/button';
import {SwapInput} from '../components/swap-input';
import {MarketPairCard} from '../components/market-pair-card';
import {SwapConfirmSheet} from '../sheets/swap-confirm-sheet';
import {useMarketPairs} from '../hooks/use-market-pairs';
import type {MarketPair, SwapPreview} from '../types';

export function MarketTab() {
  const {colors} = useTheme();
  const {pairs} = useMarketPairs();
  const confirmSheetRef = useRef<BottomSheet>(null);

  const [sellResourceId, setSellResourceId] = useState(29); // Lords
  const [sellResourceName, setSellResourceName] = useState('Lords');
  const [buyResourceId, setBuyResourceId] = useState(1);
  const [buyResourceName, setBuyResourceName] = useState('Stone');
  const [sellAmount, setSellAmount] = useState('');
  const [buyAmount, setBuyAmount] = useState('');

  // TODO: Replace with real MarketManager calculations
  const mockPreview: SwapPreview | null = sellAmount
    ? {
        inputAmount: Number(sellAmount),
        outputAmount: Math.floor(Number(sellAmount) * 2.38),
        pricePerUnit: 0.42,
        slippage: Number(sellAmount) > 10000 ? 3.2 : 0.8,
        lpFee: Math.floor(Number(sellAmount) * 0.03),
        ownerFee: Math.floor(Number(sellAmount) * 0.01),
      }
    : null;

  const handleSwapDirection = useCallback(() => {
    setSellResourceId(prev => {
      setBuyResourceId(sellResourceId);
      return buyResourceId;
    });
    setSellResourceName(prev => {
      setBuyResourceName(sellResourceName);
      return buyResourceName;
    });
    setSellAmount('');
    setBuyAmount('');
  }, [sellResourceId, buyResourceId, sellResourceName, buyResourceName]);

  const handlePairPress = useCallback((pair: MarketPair) => {
    setSellResourceId(29);
    setSellResourceName('Lords');
    setBuyResourceId(pair.resourceId);
    setBuyResourceName(pair.resourceName);
    setSellAmount('');
    setBuyAmount('');
  }, []);

  const handleSwapConfirm = useCallback(() => {
    // TODO: Wire to real buy_resources / sell_resources system call
    confirmSheetRef.current?.close();
    setSellAmount('');
    setBuyAmount('');
  }, []);

  return (
    <View style={styles.container}>
      {/* Swap Interface */}
      <View style={styles.swapSection}>
        <SwapInput
          direction="sell"
          resourceId={sellResourceId}
          resourceName={sellResourceName}
          amount={sellAmount}
          balance={50000}
          onAmountChange={(val) => {
            setSellAmount(val);
            // TODO: Auto-calculate buy amount from MarketManager
            if (val) {
              setBuyAmount(String(Math.floor(Number(val) * 2.38)));
            } else {
              setBuyAmount('');
            }
          }}
          onResourcePress={() => {/* TODO: Resource picker */}}
        />

        <View style={styles.swapButtonWrapper}>
          <Button
            title=""
            variant="secondary"
            size="sm"
            onPress={handleSwapDirection}
            style={{...styles.swapButton, borderColor: colors.border}}
          />
          <View style={styles.swapIconOverlay} pointerEvents="none">
            <ArrowUpDown size={18} color={colors.primary} />
          </View>
        </View>

        <SwapInput
          direction="buy"
          resourceId={buyResourceId}
          resourceName={buyResourceName}
          amount={buyAmount}
          balance={12000}
          onAmountChange={setBuyAmount}
          onResourcePress={() => {/* TODO: Resource picker */}}
        />

        {mockPreview && (
          <View style={styles.previewRow}>
            <Text style={[typography.caption, {color: colors.mutedForeground}]}>
              1 {buyResourceName} = {mockPreview.pricePerUnit.toFixed(4)} LORDS
            </Text>
            <Text style={[typography.caption, {color: colors.mutedForeground}]}>
              Slippage: {mockPreview.slippage.toFixed(1)}%
            </Text>
          </View>
        )}

        <Button
          title="Swap"
          onPress={() => confirmSheetRef.current?.snapToIndex(0)}
          disabled={!sellAmount || Number(sellAmount) <= 0}
        />
      </View>

      {/* Market Pairs */}
      <View style={styles.pairsSection}>
        <Text style={[typography.label, {color: colors.foreground}]}>Markets</Text>
        <FlashList
          data={pairs}
          renderItem={({item}) => <MarketPairCard pair={item} onPress={handlePairPress} />}
          estimatedItemSize={70}
          keyExtractor={item => String(item.resourceId)}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
        />
      </View>

      <SwapConfirmSheet
        ref={confirmSheetRef}
        sellResourceId={sellResourceId}
        sellResourceName={sellResourceName}
        sellAmount={Number(sellAmount) || 0}
        buyResourceId={buyResourceId}
        buyResourceName={buyResourceName}
        preview={mockPreview}
        onConfirm={handleSwapConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.lg,
  },
  swapSection: {
    gap: spacing.xs,
  },
  swapButtonWrapper: {
    alignItems: 'center',
    zIndex: 1,
    marginVertical: -spacing.sm,
  },
  swapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
  },
  swapIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  pairsSection: {
    flex: 1,
    gap: spacing.sm,
  },
  separator: {
    height: spacing.sm,
  },
});
