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

export function formatFactoryStartDateLabel(datePart: string) {
  if (!datePart) {
    return "Pick a date";
  }

  const displayDate = new Date(`${datePart}T12:00:00`);

  if (!Number.isFinite(displayDate.getTime())) {
    return datePart;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(displayDate);
}

export function formatFactoryStartTimeLabel(timePart: string) {
  if (!timePart) {
    return "Pick a time";
  }

  const displayTime = new Date(`2000-01-01T${timePart}`);

  if (!Number.isFinite(displayTime.getTime())) {
    return timePart;
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(displayTime);
}
