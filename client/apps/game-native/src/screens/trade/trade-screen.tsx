import React, {useCallback, useState} from 'react';
import {RefreshControl, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeftRight} from 'lucide-react-native';
import {useTheme} from '../../app/providers/theme-provider';
import {spacing, typography} from '../../shared/theme';
import {Badge} from '../../shared/ui/badge';
import {TabBar} from '../../shared/ui/tab-bar';
import {MarketTab} from './tabs/market-tab';
import {OrdersTab} from './tabs/orders-tab';
import {CaravansTab} from './tabs/caravans-tab';
import {useTradeOrders} from './hooks/use-trade-orders';
import {useCaravans} from './hooks/use-caravans';

const TRADE_TABS = [
  {key: 'market', label: 'Market'},
  {key: 'orders', label: 'Orders'},
  {key: 'caravans', label: 'Caravans'},
];

export function TradeScreen() {
  const {colors} = useTheme();
  const [activeTab, setActiveTab] = useState('market');
  const [refreshing, setRefreshing] = useState(false);
  const {openOrders} = useTradeOrders();
  const {readyToClaim} = useCaravans();

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // TODO: Re-fetch from Torii
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: colors.background}]}
      edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <ArrowLeftRight size={24} color={colors.foreground} />
          <Text style={[typography.h2, {color: colors.foreground}]}>Trade</Text>
        </View>
        <View style={styles.statusSummary}>
          <Badge label={`${openOrders.length} Orders`} variant="outline" size="sm" />
          {readyToClaim.length > 0 && (
            <Badge label={`${readyToClaim.length} Ready`} variant="success" size="sm" />
          )}
        </View>
      </View>

      <TabBar tabs={TRADE_TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }>
        {activeTab === 'market' && <MarketTab />}
        {activeTab === 'orders' && <OrdersTab />}
        {activeTab === 'caravans' && <CaravansTab />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusSummary: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
    gap: spacing.lg,
  },
});
