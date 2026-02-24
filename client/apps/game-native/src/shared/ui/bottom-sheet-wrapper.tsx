import React, {forwardRef, useCallback, useMemo} from 'react';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../../app/providers/theme-provider';
import {spacing, typography} from '../theme';

interface BottomSheetWrapperProps {
  children: React.ReactNode;
  snapPoints?: (string | number)[];
  title?: string;
  onClose?: () => void;
}

export const BottomSheetWrapper = forwardRef<BottomSheet, BottomSheetWrapperProps>(
  ({children, snapPoints, title, onClose}, ref) => {
    const {colors} = useTheme();
    const defaultSnapPoints = useMemo(() => snapPoints ?? ['50%', '90%'], [snapPoints]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
      ),
      [],
    );

    return (
      <BottomSheet
        ref={ref}
        snapPoints={defaultSnapPoints}
        enablePanDownToClose
        onClose={onClose}
        backdropComponent={renderBackdrop}
        backgroundStyle={{backgroundColor: colors.card}}
        handleIndicatorStyle={{backgroundColor: colors.mutedForeground}}
        index={-1}>
        <BottomSheetView style={styles.content}>
          {title && (
            <View style={styles.header}>
              <Text style={[typography.h3, {color: colors.foreground}]}>{title}</Text>
            </View>
          )}
          {children}
        </BottomSheetView>
      </BottomSheet>
    );
  },
);

BottomSheetWrapper.displayName = 'BottomSheetWrapper';

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  header: {
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
  },
});
