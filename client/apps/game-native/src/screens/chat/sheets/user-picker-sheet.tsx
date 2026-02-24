import React, {forwardRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import {BottomSheetWrapper} from '../../../shared/ui';
import {UserListItem} from '../components/user-list-item';
import type {User} from '../../../features/chat';

interface UserPickerSheetProps {
  users: User[];
  onSelectUser: (userId: string) => void;
}

export const UserPickerSheet = forwardRef<BottomSheet, UserPickerSheetProps>(
  ({users, onSelectUser}, ref) => {
    return (
      <BottomSheetWrapper ref={ref} title="Select User" snapPoints={['60%']}>
        <View style={styles.list}>
          {users.map(user => (
            <UserListItem
              key={user.id}
              user={user}
              onSelect={userId => {
                onSelectUser(userId);
                if (ref && 'current' in ref && ref.current) {
                  ref.current.close();
                }
              }}
            />
          ))}
        </View>
      </BottomSheetWrapper>
    );
  },
);

UserPickerSheet.displayName = 'UserPickerSheet';

const styles = StyleSheet.create({
  list: {gap: 8},
});
