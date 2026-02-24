import React, {useRef, useImperativeHandle, forwardRef, useCallback} from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import {Hammer} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography} from '../../../shared/theme';
import {BottomSheetWrapper} from '../../../shared/ui/bottom-sheet-wrapper';
import {Card} from '../../../shared/ui/card';
import {Button} from '../../../shared/ui/button';
import {ResourceAmount} from '../../../shared/ui/resource-amount';

export interface BuildSheetRef {
  open: () => void;
  close: () => void;
}

interface BuildSheetProps {
  realmEntityId: number;
}

// TODO: Replace with real building costs from configManager
interface BuildOption {
  id: string;
  name: string;
  description: string;
  costs: {resourceId: number; amount: number}[];
}

const MOCK_BUILD_OPTIONS: BuildOption[] = [
  {
    id: 'lumber_mill',
    name: 'Lumber Mill',
    description: 'Produces Wood over time',
    costs: [{resourceId: 2, amount: 500}, {resourceId: 5, amount: 200}],
  },
  {
    id: 'quarry',
    name: 'Quarry',
    description: 'Produces Stone over time',
    costs: [{resourceId: 1, amount: 400}, {resourceId: 5, amount: 150}],
  },
  {
    id: 'farm',
    name: 'Farm',
    description: 'Produces Wheat over time',
    costs: [{resourceId: 1, amount: 300}, {resourceId: 2, amount: 200}],
  },
];

export const BuildSheet = forwardRef<BuildSheetRef, BuildSheetProps>(
  ({realmEntityId}, ref) => {
    const sheetRef = useRef<BottomSheet>(null);

    useImperativeHandle(ref, () => ({
      open: () => sheetRef.current?.snapToIndex(0),
      close: () => sheetRef.current?.close(),
    }));

    const handleBuild = useCallback((buildingId: string) => {
      // TODO: Execute build system call via Dojo
      console.log('Build', buildingId, 'on realm', realmEntityId);
      sheetRef.current?.close();
    }, [realmEntityId]);

    return (
      <BottomSheetWrapper ref={sheetRef} title="Build" snapPoints={['60%', '90%']}>
        <FlatList
          data={MOCK_BUILD_OPTIONS}
          keyExtractor={item => item.id}
          renderItem={({item}) => <BuildOptionRow option={item} onBuild={handleBuild} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </BottomSheetWrapper>
    );
  },
);

BuildSheet.displayName = 'BuildSheet';

function BuildOptionRow({option, onBuild}: {option: BuildOption; onBuild: (id: string) => void}) {
  const {colors} = useTheme();

  return (
    <Card style={styles.optionCard}>
      <View style={styles.optionHeader}>
        <View style={styles.optionInfo}>
          <Hammer size={18} color={colors.primary} />
          <View style={styles.optionText}>
            <Text style={[typography.label, {color: colors.foreground}]}>{option.name}</Text>
            <Text style={[typography.caption, {color: colors.mutedForeground}]}>{option.description}</Text>
          </View>
        </View>
      </View>
      <View style={styles.costsRow}>
        <Text style={[typography.caption, {color: colors.mutedForeground}]}>Cost:</Text>
        {option.costs.map(cost => (
          <ResourceAmount key={cost.resourceId} resourceId={cost.resourceId} amount={cost.amount} size="sm" />
        ))}
      </View>
      <Button title="Build" variant="primary" size="sm" onPress={() => onBuild(option.id)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  listContent: {
    gap: spacing.sm,
  },
  optionCard: {
    gap: spacing.md,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  optionText: {
    flex: 1,
  },
  costsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  separator: {
    height: spacing.sm,
  },
});
