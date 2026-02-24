import React, {useCallback, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import BottomSheet from '@gorhom/bottom-sheet';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing} from '../../../shared/theme';
import {Button} from '../../../shared/ui/button';
import {EmptyState} from '../../../shared/ui/empty-state';
import {TabBar} from '../../../shared/ui/tab-bar';
import {OrderCard} from '../components/order-card';
import {CreateOrderSheet} from '../sheets/create-order-sheet';
import {AcceptOrderSheet} from '../sheets/accept-order-sheet';
import {useTradeOrders} from '../hooks/use-trade-orders';
import type {TradeOrder} from '../types';

const ORDER_TABS = [
  {key: 'available', label: 'Available'},
  {key: 'mine', label: 'My Orders'},
];

export function OrdersTab() {
  const {colors} = useTheme();
  const {availableOrders, myOrders} = useTradeOrders();
  const [activeTab, setActiveTab] = useState('available');
  const createSheetRef = useRef<BottomSheet>(null);
  const acceptSheetRef = useRef<BottomSheet>(null);
  const selectedOrderRef = useRef<TradeOrder | null>(null);

  const orders = activeTab === 'available' ? availableOrders : myOrders;

  const handleOrderPress = useCallback((order: TradeOrder) => {
    if (order.isOwn) {
      // TODO: Show order detail / cancel sheet
      return;
    }
    selectedOrderRef.current = order;
    acceptSheetRef.current?.snapToIndex(0);
  }, []);

  const handleCreateConfirm = useCallback(
    (_sellId: number, _sellAmount: number, _buyId: number, _buyAmount: number) => {
      // TODO: Wire to real create_order system call
      createSheetRef.current?.close();
    },
    [],
  );

  const handleAcceptConfirm = useCallback((_tradeId: number) => {
    // TODO: Wire to real accept_order system call
    acceptSheetRef.current?.close();
    selectedOrderRef.current = null;
  }, []);

  const renderOrderItem = useCallback(
    ({item}: {item: TradeOrder}) => (
      <OrderCard order={item} onPress={handleOrderPress} />
    ),
    [handleOrderPress],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TabBar tabs={ORDER_TABS} activeTab={activeTab} onTabChange={setActiveTab} />
        <Button
          title="+ New Order"
          variant="secondary"
          size="sm"
          onPress={() => createSheetRef.current?.snapToIndex(0)}
        />
      </View>

      {orders.length === 0 ? (
        <EmptyState
          title={activeTab === 'available' ? 'No Available Orders' : 'No Active Orders'}
          message={
            activeTab === 'available'
              ? 'No trade orders from other players right now.'
              : 'Create your first order to start trading.'
          }
        />
      ) : (
        <FlashList
          data={orders}
          renderItem={renderOrderItem}
          estimatedItemSize={130}
          keyExtractor={item => String(item.tradeId)}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}

      <CreateOrderSheet
        ref={createSheetRef}
        onConfirm={handleCreateConfirm}
      />
      <AcceptOrderSheet
        ref={acceptSheetRef}
        order={selectedOrderRef.current}
        onConfirm={handleAcceptConfirm}
        onClose={() => {
          selectedOrderRef.current = null;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: spacing.xxxl,
  },
  separator: {
    height: spacing.sm,
  },
});
