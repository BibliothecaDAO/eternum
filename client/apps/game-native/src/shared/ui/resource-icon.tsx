import React from 'react';
import {Image, StyleSheet, View} from 'react-native';

interface ResourceIconProps {
  resourceId: number;
  size?: number;
}

const RESOURCE_IMAGE_BASE_URL = 'https://eternum-prod.vercel.app/images/resources';

export function ResourceIcon({resourceId, size = 24}: ResourceIconProps) {
  return (
    <View style={[styles.container, {width: size, height: size}]}>
      <Image
        source={{uri: `${RESOURCE_IMAGE_BASE_URL}/${resourceId}.png`}}
        style={{width: size, height: size}}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
