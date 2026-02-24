import React, {useState, useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ChevronLeft} from 'lucide-react-native';
import {useTheme} from '../../app/providers/theme-provider';
import {spacing, typography} from '../../shared/theme';
import {TabBar} from '../../shared/ui/tab-bar';
import {RealmInfoHeader} from './components/realm-info-header';
import {ResourcesTab} from './tabs/resources-tab';
import {BuildingsTab} from './tabs/buildings-tab';
import {MilitaryTab} from './tabs/military-tab';
import {ActionsTab} from './tabs/actions-tab';
import {useRealmSummaries} from './hooks/use-realm-summary';

const TABS = [
  {key: 'resources', label: 'Resources'},
  {key: 'buildings', label: 'Buildings'},
  {key: 'military', label: 'Military'},
  {key: 'actions', label: 'Actions'},
];

interface RealmDetailScreenProps {
  route: {params: {realmEntityId: number}};
  navigation: {goBack: () => void};
}

export function RealmDetailScreen({route, navigation}: RealmDetailScreenProps) {
  const {colors} = useTheme();
  const {realmEntityId} = route.params;
  const [activeTab, setActiveTab] = useState('resources');

  const realms = useRealmSummaries();
  const realm = useMemo(
    () => realms.find(r => r.entityId === realmEntityId),
    [realms, realmEntityId],
  );

  if (!realm) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
        <View style={styles.notFound}>
          <Text style={[typography.h3, {color: colors.foreground}]}>Realm Not Found</Text>
          <Pressable onPress={navigation.goBack}>
            <Text style={[typography.body, {color: colors.primary}]}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={[styles.backBar, {borderBottomColor: colors.border}]}>
        <Pressable
          onPress={navigation.goBack}
          style={({pressed}) => [styles.backButton, pressed && styles.pressed]}>
          <ChevronLeft size={24} color={colors.foreground} />
          <Text style={[typography.body, {color: colors.foreground}]}>Realms</Text>
        </Pressable>
      </View>

      <RealmInfoHeader realm={realm} lordsBalance={12450} />

      <View style={styles.tabBarContainer}>
        <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      </View>

      <View style={styles.tabContent}>
        {activeTab === 'resources' && <ResourcesTab entityId={realm.entityId} />}
        {activeTab === 'buildings' && <BuildingsTab realm={realm} />}
        {activeTab === 'military' && <MilitaryTab realm={realm} />}
        {activeTab === 'actions' && <ActionsTab realm={realm} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
  tabBarContainer: {
    paddingVertical: spacing.md,
  },
  tabContent: {
    flex: 1,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
});
