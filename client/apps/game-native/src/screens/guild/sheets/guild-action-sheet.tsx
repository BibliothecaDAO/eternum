import React, {forwardRef} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import {useTheme} from '../../../app/providers/theme-provider';
import {spacing, typography} from '../../../shared/theme';
import {BottomSheetWrapper, Button} from '../../../shared/ui';
import {hapticMedium} from '../../../shared/lib/haptics';

interface GuildActionSheetProps {
  guildName: string;
  isMember: boolean;
  onConfirm: () => void;
}

export const GuildActionSheet = forwardRef<BottomSheet, GuildActionSheetProps>(
  ({guildName, isMember, onConfirm}, ref) => {
    const {colors} = useTheme();

    return (
      <BottomSheetWrapper
        ref={ref}
        title={isMember ? 'Leave Guild' : 'Join Guild'}
        snapPoints={['30%']}>
        <View style={styles.container}>
          <Text style={[typography.body, {color: colors.foreground}]}>
            {isMember
              ? `Are you sure you want to leave ${guildName}?`
              : `Join ${guildName}?`}
          </Text>
          <Button
            title={isMember ? 'Leave' : 'Join'}
            variant={isMember ? 'destructive' : 'primary'}
            onPress={() => {
              hapticMedium();
              onConfirm();
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

GuildActionSheet.displayName = 'GuildActionSheet';

const styles = StyleSheet.create({
  container: {gap: spacing.lg},
});
