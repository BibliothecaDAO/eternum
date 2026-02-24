import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {FlashList} from '@shopify/flash-list';
import {Users} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTheme} from '../../app/providers/theme-provider';
import {spacing, typography} from '../../shared/theme';
import {EmptyState, ListItemSkeleton} from '../../shared/ui';
import type {MoreStackParamList} from '../../app/config/types';
import {useGuildList} from './hooks/use-guild-list';
import {GuildCard} from './components/guild-card';
import type {Guild} from './types';

export function GuildScreen() {
  const {colors} = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const {guilds, isLoading} = useGuildList();

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, {backgroundColor: colors.background}]}
        edges={['top']}>
        <View style={styles.header}>
          <Users size={24} color={colors.foreground} />
          <Text style={[typography.h2, {color: colors.foreground}]}>Guilds</Text>
        </View>
        <View style={styles.skeletons}>
          {Array.from({length: 5}).map((_, i) => (
            <ListItemSkeleton key={i} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: colors.background}]}
      edges={['top']}>
      <View style={styles.header}>
        <Users size={24} color={colors.foreground} />
        <Text style={[typography.h2, {color: colors.foreground}]}>Guilds</Text>
      </View>
      {guilds.length === 0 ? (
        <EmptyState
          icon={<Users size={32} color={colors.mutedForeground} />}
          title="No guilds found"
          message="Guilds will appear here"
        />
      ) : (
        <FlashList
          data={guilds}
          renderItem={({item}: {item: Guild}) => (
            <GuildCard
              guild={item}
              onPress={guildId =>
                navigation.navigate('GuildDetail', {guildId})
              }
            />
          )}
          estimatedItemSize={100}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  listContent: {paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl * 2},
  separator: {height: spacing.sm},
  skeletons: {padding: spacing.lg, gap: spacing.sm},
});
