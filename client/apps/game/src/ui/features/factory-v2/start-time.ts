export function resolveFactoryStartDatePart(startAt: string) {
  const [datePart = ""] = startAt.split("T");
  return datePart;
}

export function resolveFactoryStartTimePart(startAt: string) {
  const [, timePart = ""] = startAt.split("T");
  return timePart.slice(0, 5);
}

export function buildFactoryStartAtValue(nextDate: string, nextTime: string, currentStartAt: string) {
  const resolvedDate = nextDate || resolveFactoryStartDatePart(currentStartAt);
  const resolvedTime = nextTime || resolveFactoryStartTimePart(currentStartAt);

  if (!resolvedDate || !resolvedTime) {
    return currentStartAt;
  }

  return `${resolvedDate}T${resolvedTime}`;
}
