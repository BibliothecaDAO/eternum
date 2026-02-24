import React, {useEffect, useState} from 'react';
import {ActivityIndicator, View, StyleSheet} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ThemeProvider} from './providers/theme-provider';
import {QueryProvider} from './providers/query-provider';
import {DojoProvider} from './providers/dojo-provider';
import {AppNavigator} from './config/navigation';
import {storage} from '../shared/lib/storage';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    storage.init().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryProvider>
            <DojoProvider>
              <BottomSheetModalProvider>
                <AppNavigator />
              </BottomSheetModalProvider>
            </DojoProvider>
          </QueryProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  loading: {flex: 1, justifyContent: 'center', alignItems: 'center'},
});
