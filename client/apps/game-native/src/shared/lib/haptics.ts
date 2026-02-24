import {Vibration, Platform} from 'react-native';

export function hapticLight() {
  if (Platform.OS === 'ios') {
    Vibration.vibrate(10);
  }
}

export function hapticMedium() {
  Vibration.vibrate(20);
}

export function hapticSuccess() {
  Vibration.vibrate([0, 10, 50, 10]);
}

export function hapticError() {
  Vibration.vibrate([0, 10, 50, 10, 50, 10]);
}
