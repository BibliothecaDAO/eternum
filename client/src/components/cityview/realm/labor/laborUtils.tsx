export const formatSecondsInHoursMinutes = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    return `${hours}h:${minutes}m`;
};

export const formatSecondsLeftInDaysHours = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const secondsLeft = seconds % 86400;
    const hours = Math.floor(secondsLeft / 3600);

    return `${days} days ${hours}h`;
};

export const calculateProductivity = (resources_per_cycle: number, multiplier: number, cycle_length: number): number => {
    let productivity = resources_per_cycle * multiplier / cycle_length;
    // in hours
    return productivity * 3600;
}

// calculates how much you will have when you click on harvest
export const calculateNextHarvest = (balance: number, last_harvest: number, multiplier: number, cycle_length: number, production_per_cycle: number, nextBlockTime: number): number => {
    // in seconds
    let harvest_seconds = nextBlockTime > balance ? balance - last_harvest: nextBlockTime - last_harvest;
    // in units
    let next_harvest_units = Math.floor(harvest_seconds / cycle_length);
    // return production
    return next_harvest_units * production_per_cycle * multiplier;
}