export interface HealthSample {
  time: number;
  value: number;
}

export interface HealthSeries {
  externalId: string;
  modifiedAt: string | null;
  device: string | null;
  samples: HealthSample[];
}

/** A versioned snapshot of one explicitly selected workout and its source data.
 * No Health Connect permissions, tokens or cursors are part of this payload. */
export interface HealthWorkout {
  version: 1;
  externalId: string;
  origin: string;
  title: string;
  start: string;
  end: string;
  modifiedAt: string | null;
  distanceKm: number | null;
  heartRate: HealthSeries[] | null;
  cadence: HealthSeries[] | null;
  heartRateAverage: number | null;
  cadenceAverage: number | null;
}

export interface HealthImport {
  uuid: string;
  sourceScope: string;
  workout: HealthWorkout;
}

export interface HealthRun {
  externalId: string;
  origin: string;
  title: string;
  start: string;
  end: string;
}
