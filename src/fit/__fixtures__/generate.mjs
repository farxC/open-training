// Synthetic fixtures, no personal workout data. Rebuild with: node src/fit/__fixtures__/generate.mjs
import { Encoder } from '@garmin/fitsdk';
import { writeFileSync } from 'node:fs';

const start = new Date('2026-10-10T10:00:00Z');
const at = (seconds) => new Date(start.getTime() + seconds * 1000);
function build(name, { sport = 1, summaryOnly = false, secondSession = false, identity = true, packedCadence = false } = {}) {
  const encoder = new Encoder();
  encoder.onMesg(0, { type: 4, manufacturer: 339, product: 12, productName: 'Synthetic runner',
    ...(identity ? { serialNumber: 123456, timeCreated: start } : {}) });
  if (!summaryOnly) {
    for (const [seconds, heartRate, cadence, fractionalCadence] of [[0, 130, 80, 0.25], [300, 150, 85, 0.5], [600, 140, 0, 0], [1200, 160, 90, 0]]) {
      encoder.onMesg(20, { timestamp: at(seconds), heartRate,
        ...(packedCadence ? { cadence256: cadence + fractionalCadence } : { cadence, fractionalCadence }) });
    }
    encoder.onMesg(19, { startTime: start, timestamp: at(600), totalElapsedTime: 600, totalTimerTime: 550, totalDistance: 2000 });
    encoder.onMesg(19, { startTime: at(600), timestamp: at(1200), totalElapsedTime: 600, totalTimerTime: 550, totalDistance: 3000 });
  }
  const session = { sport, startTime: start, timestamp: at(1200), totalElapsedTime: 1200, totalTimerTime: 1100,
    totalDistance: 5000, avgHeartRate: 145, maxHeartRate: 160, avgCadence: 82, avgFractionalCadence: 0.5,
    maxCadence: 90, maxFractionalCadence: 0.25 };
  encoder.onMesg(18, session);
  if (secondSession) encoder.onMesg(18, { ...session, sport: 2, startTime: at(1200), timestamp: at(1800), totalElapsedTime: 600, totalTimerTime: 600 });
  encoder.onMesg(34, { timestamp: at(1200), numSessions: secondSession ? 2 : 1, totalTimerTime: 1100, type: 0 });
  writeFileSync(new URL(name, import.meta.url), encoder.close());
}
build('running.fit');
build('summary.fit', { summaryOnly: true });
build('cycling.fit', { sport: 2 });
build('multisport.fit', { secondSession: true });
build('no-identity.fit', { identity: false });
build('packed-cadence.fit', { packedCadence: true });
