export interface NumericSampleSummary {
  avg: number;
  min: number;
  max: number;
  last: number;
  p50: number;
  p95: number;
  sampleCount: number;
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function getNearestRankPercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  const clampedPercentile = Math.max(0, Math.min(1, percentile));
  const rank = Math.max(1, Math.ceil(clampedPercentile * sortedValues.length));
  return sortedValues[rank - 1] ?? sortedValues[sortedValues.length - 1] ?? 0;
}

export function summarizeNumericSamples(samples: number[], lastValue: number = 0): NumericSampleSummary {
  const finiteSamples = samples.filter(isFiniteNumber);
  const safeLastValue = isFiniteNumber(lastValue) ? lastValue : 0;

  if (finiteSamples.length === 0) {
    return {
      avg: 0,
      min: 0,
      max: 0,
      last: safeLastValue,
      p50: 0,
      p95: 0,
      sampleCount: 0,
    };
  }

  const sortedSamples = [...finiteSamples].sort((a, b) => a - b);
  const total = finiteSamples.reduce((sum, value) => sum + value, 0);

  return {
    avg: total / finiteSamples.length,
    min: sortedSamples[0] ?? 0,
    max: sortedSamples[sortedSamples.length - 1] ?? 0,
    last: safeLastValue,
    p50: getNearestRankPercentile(sortedSamples, 0.5),
    p95: getNearestRankPercentile(sortedSamples, 0.95),
    sampleCount: finiteSamples.length,
  };
}
