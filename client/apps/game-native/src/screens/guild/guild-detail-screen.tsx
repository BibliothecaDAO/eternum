import React, {useRef} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRoute, RouteProp} from '@react-navigation/native';
import BottomSheet from '@gorhom/bottom-sheet';
import {Users, Trophy} from 'lucide-react-native';
import {useTheme} from '../../app/providers/theme-provider';
import {spacing, typography} from '../../shared/theme';
import {Badge, Button, Card, SectionHeader} from '../../shared/ui';
import type {MoreStackParamList} from '../../app/config/types';
import {useGuildDetail} from './hooks/use-guild-detail';
import {MemberRow} from './components/member-row';
import {GuildActionSheet} from './sheets/guild-action-sheet';

export function GuildDetailScreen() {
  const {colors} = useTheme();
  const route = useRoute<RouteProp<MoreStackParamList, 'GuildDetail'>>();
  const {guild, onlineMembers, offlineMembers} = useGuildDetail(
    route.params.guildId,
  );
  const sheetRef = useRef<BottomSheet>(null);

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: colors.background}]}
      edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Card>
          <View style={styles.guildHeader}>
            <Text style={[typography.h2, {color: colors.foreground}]}>
              {guild.name}
            </Text>
            <Badge label={`Rank #${guild.rank}`} variant="warning" size="sm" />
          </View>
          <Text style={[typography.body, {color: colors.mutedForeground}]}>
            {guild.description}
          </Text>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Users size={16} color={colors.mutedForeground} />
              <Text style={[typography.label, {color: colors.foreground}]}>
                {guild.memberCount}/{guild.maxMembers}
              </Text>
            </View>
            <View style={styles.stat}>
              <Trophy size={16} color={colors.mutedForeground} />
              <Text style={[typography.label, {color: colors.foreground}]}>
                {guild.totalPoints.toLocaleString()} pts
              </Text>
            </View>
          </View>
          <Button
            title="Join Guild"
            variant="primary"
            onPress={() => sheetRef.current?.snapToIndex(0)}
          />
        </Card>

        {onlineMembers.length > 0 && (
          <SectionHeader title={`Online (${onlineMembers.length})`}>
            {onlineMembers.map(member => (
              <MemberRow key={member.id} member={member} />
            ))}
          </SectionHeader>
        )}

        {offlineMembers.length > 0 && (
          <SectionHeader title={`Offline (${offlineMembers.length})`}>
            {offlineMembers.map(member => (
              <MemberRow key={member.id} member={member} />
            ))}
          </SectionHeader>
        )}
      </ScrollView>

      <GuildActionSheet
        ref={sheetRef}
        guildName={guild.name}
        isMember={false}
        onConfirm={() => {
          // TODO: Implement join/leave guild
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xxxl * 2,
    gap: spacing.lg,
  },
  guildHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
  },
  stat: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
});
