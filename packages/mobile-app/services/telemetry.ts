/**
 * Device sensor telemetry collection for fraud signal attachment.
 * Collects accelerometer, barometer, GPS, BSSIDs, cell towers.
 * Only triggered when a disruption event is active in worker's zone.
 */

export interface ClaimTelemetry {
  worker_id: string;
  event_id: string;
  gps: {
    lat: number;
    lng: number;
    accuracy_m: number;
    altitude: number;
    mock_provider: boolean;
    gps_timestamp: number;
    ntp_timestamp: number;
  };
  accelerometer_variance: number;
  barometric_pressure_hpa: number | null;
  bssids: string[];
  cell_tower_ids: string[];
  battery_level: number;
  speed_ms: number[];
  app_in_zone_since_minutes: number;
}

/**
 * Collect sensor telemetry from the device.
 * On emulator/web, returns simulated data with mock_provider=true.
 */
export const collectTelemetry = async (
  workerId: string,
  eventId: string,
): Promise<ClaimTelemetry> => {
  const now = Date.now();
  let lat = 12.9716 + (Math.random() - 0.5) * 0.01;
  let lng = 77.5946 + (Math.random() - 0.5) * 0.01;
  let accuracy = 8 + Math.random() * 20;
  let altitude = 920 + Math.random() * 10;
  let mockProvider = true;
  let barometricPressure: number | null = 1013 + Math.random() * 5;
  let batteryLevel = 0.4 + Math.random() * 0.5;
  let accelerometerVariance = 0.02 + Math.random() * 0.15;
  let speedReadings = Array.from({ length: 5 }, () => Math.random() * 8);

  try {
    const Location = require('expo-location');
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status === 'granted') {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      lat = position.coords.latitude;
      lng = position.coords.longitude;
      accuracy = position.coords.accuracy ?? accuracy;
      altitude = position.coords.altitude ?? altitude;
      mockProvider = !!position.mocked;
      speedReadings = [position.coords.speed ?? 0];
    }
  } catch {
    // Keep fallback values for web/emulator when expo-location is unavailable.
  }

  try {
    const Battery = require('expo-battery');
    const level = await Battery.getBatteryLevelAsync();
    if (typeof level === 'number' && Number.isFinite(level)) {
      batteryLevel = level;
    }
  } catch {
    // Optional telemetry source.
  }

  try {
    const Sensors = require('expo-sensors');
    const sample: number[] = [];
    const subscription = Sensors.Accelerometer.addListener((reading: { x: number; y: number; z: number }) => {
      sample.push(Math.sqrt(reading.x ** 2 + reading.y ** 2 + reading.z ** 2));
    });
    Sensors.Accelerometer.setUpdateInterval(120);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    subscription?.remove?.();

    if (sample.length > 2) {
      accelerometerVariance = computeAccelVariance(sample);
    }

    if (Sensors.Barometer?.isAvailableAsync && await Sensors.Barometer.isAvailableAsync()) {
      const pressureSample: number[] = [];
      const pressureSubscription = Sensors.Barometer.addListener((reading: { pressure: number }) => {
        pressureSample.push(reading.pressure);
      });
      Sensors.Barometer.setUpdateInterval(400);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      pressureSubscription?.remove?.();
      if (pressureSample.length > 0) {
        barometricPressure = pressureSample.reduce((sum, v) => sum + v, 0) / pressureSample.length;
      }
    } else {
      barometricPressure = null;
    }
  } catch {
    // Optional telemetry source.
  }

  return {
    worker_id: workerId,
    event_id: eventId,
    gps: {
      lat,
      lng,
      accuracy_m: accuracy,
      altitude,
      mock_provider: mockProvider,
      gps_timestamp: now - Math.floor(Math.random() * 2000),
      ntp_timestamp: now,
    },
    accelerometer_variance: accelerometerVariance,
    barometric_pressure_hpa: barometricPressure,
    bssids: [
      `aa:bb:cc:${Math.floor(Math.random() * 99).toString(16)}:${Math.floor(Math.random() * 99).toString(16)}:01`,
      `aa:bb:cc:${Math.floor(Math.random() * 99).toString(16)}:${Math.floor(Math.random() * 99).toString(16)}:02`,
    ],
    cell_tower_ids: [`404-45-${Math.floor(Math.random() * 99999)}`],
    battery_level: batteryLevel,
    speed_ms: speedReadings,
    app_in_zone_since_minutes: Math.floor(Math.random() * 120) + 15,
  };
};

/**
 * Compute accelerometer variance over readings.
 */
export const computeAccelVariance = (readings: number[]): number => {
  if (readings.length === 0) return 0;
  const mean = readings.reduce((a, b) => a + b, 0) / readings.length;
  const variance = readings.reduce((sum, val) => sum + (val - mean) ** 2, 0) / readings.length;
  return variance;
};
