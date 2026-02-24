import React, {useRef, useImperativeHandle, forwardRef, useCallback} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import {Cog, Pause, Play} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography} from '../../../shared/theme';
import {BottomSheetWrapper} from '../../../shared/ui/bottom-sheet-wrapper';
import {Card} from '../../../shared/ui/card';
import {Button} from '../../../shared/ui/button';
import {ResourceIcon} from '../../../shared/ui/resource-icon';
import {Badge} from '../../../shared/ui/badge';

export interface ProductionSheetRef {
  open: (buildingId: string) => void;
  close: () => void;
}

interface ProductionSheetProps {
  realmEntityId: number;
}

export const ProductionSheet = forwardRef<ProductionSheetRef, ProductionSheetProps>(
  ({realmEntityId}, ref) => {
    const sheetRef = useRef<BottomSheet>(null);
    const [activeBuildingId, setActiveBuildingId] = React.useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      open: (buildingId: string) => {
        setActiveBuildingId(buildingId);
        sheetRef.current?.snapToIndex(0);
      },
      close: () => sheetRef.current?.close(),
    }));

    const {colors} = useTheme();

    const handleToggle = useCallback(() => {
      // TODO: Execute pause/resume system call via Dojo
      console.log('Toggle production for', activeBuildingId, 'on realm', realmEntityId);
    }, [activeBuildingId, realmEntityId]);

    // TODO: Replace with real building data from Dojo context
    const mockBuilding = {
      name: 'Lumber Mill',
      resourceId: 1,
      ratePerHour: 120,
      isActive: true,
    };

    return (
      <BottomSheetWrapper ref={sheetRef} title="Production Settings" snapPoints={['45%']}>
        <Card style={styles.buildingInfo}>
          <View style={styles.buildingRow}>
            <ResourceIcon resourceId={mockBuilding.resourceId} size={32} />
            <View style={styles.buildingText}>
              <Text style={[typography.label, {color: colors.foreground}]}>{mockBuilding.name}</Text>
              <Text style={[typography.caption, {color: colors.mutedForeground}]}>
                +{mockBuilding.ratePerHour}/hr
              </Text>
            </View>
            <Badge
              label={mockBuilding.isActive ? 'Active' : 'Paused'}
              variant={mockBuilding.isActive ? 'success' : 'destructive'}
              size="sm"
            />
          </View>
        </Card>

        <View style={styles.actions}>
          <Button
            title={mockBuilding.isActive ? 'Pause Production' : 'Resume Production'}
            variant={mockBuilding.isActive ? 'destructive' : 'primary'}
            size="md"
            onPress={handleToggle}
          />
        </View>
      </BottomSheetWrapper>
    );
  },
);

ProductionSheet.displayName = 'ProductionSheet';

const styles = StyleSheet.create({
  buildingInfo: {
    marginBottom: spacing.lg,
  },
  buildingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  buildingText: {
    flex: 1,
  },
  actions: {
    gap: spacing.sm,
  },
});
