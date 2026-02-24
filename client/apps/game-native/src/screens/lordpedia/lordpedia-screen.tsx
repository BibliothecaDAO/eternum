import React, {useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {BookOpen} from 'lucide-react-native';
import {useTheme} from '../../app/providers/theme-provider';
import {spacing, typography} from '../../shared/theme';
import {TabBar} from '../../shared/ui';
import {HintSection, SECTIONS} from './types';
import {SectionContent} from './components/section-content';

const TABS = SECTIONS.map(s => ({key: s.id, label: s.label}));

export function LordpediaScreen() {
  const {colors} = useTheme();
  const [activeSection, setActiveSection] = useState<HintSection>(
    HintSection.TheWorld,
  );

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: colors.background}]}
      edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <BookOpen size={24} color={colors.foreground} />
          <Text style={[typography.h2, {color: colors.foreground}]}>
            Lordpedia
          </Text>
        </View>
      </View>

      <TabBar
        tabs={TABS}
        activeTab={activeSection}
        onTabChange={key => setActiveSection(key as HintSection)}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <SectionContent section={activeSection} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  content: {flex: 1},
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xxxl * 2,
  },
});
