import React, {forwardRef} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import {Gift} from 'lucide-react-native';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography} from '../../../shared/theme';
import {BottomSheetWrapper, Button} from '../../../shared/ui';
import {hapticSuccess} from '../../../shared/lib/haptics';
import type {Quest} from '../types';

interface ClaimRewardSheetProps {
  quest: Quest | null;
  onClaim: () => void;
}

export const ClaimRewardSheet = forwardRef<BottomSheet, ClaimRewardSheetProps>(
  ({quest, onClaim}, ref) => {
    const {colors} = useTheme();

    if (!quest) return null;

    return (
      <BottomSheetWrapper ref={ref} title="Claim Reward" snapPoints={['35%']}>
        <View style={styles.container}>
          <View style={styles.reward}>
            <Gift size={32} color={colors.primary} />
            <Text style={[typography.h2, {color: colors.foreground}]}>
              {quest.reward.amount} {quest.reward.type}
            </Text>
            <Text style={[typography.bodySmall, {color: colors.mutedForeground}]}>
              Reward for completing "{quest.title}"
            </Text>
          </View>
          <Button
            title="Claim"
            variant="primary"
            onPress={() => {
              hapticSuccess();
              onClaim();
              if (ref && 'current' in ref && ref.current) {
                ref.current.close();
              }
            }}
          />
        </View>
      </BottomSheetWrapper>
    );
  },
);

ClaimRewardSheet.displayName = 'ClaimRewardSheet';

const styles = StyleSheet.create({
  container: {gap: spacing.lg},
  reward: {alignItems: 'center', gap: spacing.sm},
});
