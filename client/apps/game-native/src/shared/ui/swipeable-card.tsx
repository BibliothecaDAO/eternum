import React from 'react';
import {StyleSheet, View, ViewStyle} from 'react-native';
import {Swipeable} from 'react-native-gesture-handler';
import {useTheme} from '../../app/providers/theme-provider';
import {borderRadius, spacing} from '../theme';

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftContent?: () => React.ReactNode;
  rightContent?: () => React.ReactNode;
  style?: ViewStyle;
}

export function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftContent,
  rightContent,
  style,
}: SwipeableCardProps) {
  const {colors} = useTheme();

  const renderLeftActions = leftContent
    ? () => <View style={styles.actionContainer}>{leftContent()}</View>
    : undefined;

  const renderRightActions = rightContent
    ? () => <View style={styles.actionContainer}>{rightContent()}</View>
    : undefined;

  return (
    <Swipeable
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={direction => {
        if (direction === 'left' && onSwipeRight) {
          onSwipeRight();
        } else if (direction === 'right' && onSwipeLeft) {
          onSwipeLeft();
        }
      }}>
      <View
        style={[
          styles.card,
          {backgroundColor: colors.card, borderColor: colors.border},
          style,
        ]}>
        {children}
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  actionContainer: {
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
});
