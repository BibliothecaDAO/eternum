import React, {useEffect, useState} from 'react';
import {Text, ViewStyle} from 'react-native';
import {useTheme} from '../../app/providers/theme-provider';
import {typography} from '../theme';

type CountdownFormat = 'hms' | 'dhms';

interface CountdownTimerProps {
  targetTimestamp: number; // Unix seconds
  onComplete?: () => void;
  format?: CountdownFormat;
  style?: ViewStyle;
}

function formatTime(seconds: number, format: CountdownFormat): string {
  if (seconds <= 0) {
    return format === 'dhms' ? '0d 0h 0m 0s' : '0h 0m 0s';
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (format === 'dhms') {
    return `${d}d ${h}h ${m}m ${s}s`;
  }
  const totalH = d * 24 + h;
  return `${totalH}h ${m}m ${s}s`;
}

export function CountdownTimer({
  targetTimestamp,
  onComplete,
  format = 'hms',
  style,
}: CountdownTimerProps) {
  const {colors} = useTheme();
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, targetTimestamp - Math.floor(Date.now() / 1000)),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const next = Math.max(0, targetTimestamp - Math.floor(Date.now() / 1000));
      setRemaining(next);
      if (next <= 0) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp, onComplete]);

  const isUrgent = remaining > 0 && remaining < 300;

  return (
    <Text
      style={[
        typography.label,
        {color: isUrgent ? colors.destructive : colors.foreground},
        style,
      ]}>
      {formatTime(remaining, format)}
    </Text>
  );
}
