import { SensorSpec, SensorType } from '../core/types'

/**
 * Sensor reading event structure matching android.hardware.SensorEvent
 */
export interface SensorEventReading {
  sensorType: SensorType
  accuracy: number
  timestampNs: number
  values: number[]
}

/**
 * Android SensorManager compatibility & controlled deterministic sensor simulation module.
 */
export class SensorConfiguration {
  private readonly sensors: SensorSpec[]

  constructor(sensors: SensorSpec[]) {
    this.sensors = [...sensors]
  }

  public getSensors(): SensorSpec[] {
    return [...this.sensors]
  }

  public getSensorByType(type: SensorType): SensorSpec | undefined {
    return this.sensors.find((s) => s.type === type)
  }

  public hasSensor(type: SensorType): boolean {
    return this.sensors.some((s) => s.type === type)
  }

  /**
   * Deterministic test sensor simulation hook.
   * Produces reproducible sensor event values for automated QA testing.
   */
  public generateDeterministicReading(type: SensorType, stepIndex: number = 0): SensorEventReading | null {
    const sensor = this.getSensorByType(type)
    if (!sensor) return null

    const baseTimestamp = 1700000000000000000 // Fixed deterministic epoch baseline in ns
    const timestampNs = baseTimestamp + stepIndex * 20000000 // 50Hz (20ms) interval

    let values: number[] = [0, 0, 0]

    switch (type) {
      case SensorType.ACCELEROMETER:
        // Baseline earth gravity on Z-axis (9.81 m/s^2) with slight deterministic variation
        values = [
          Math.sin(stepIndex * 0.1) * 0.05,
          Math.cos(stepIndex * 0.1) * 0.05,
          9.80665 + Math.sin(stepIndex * 0.05) * 0.02
        ]
        break

      case SensorType.GYROSCOPE:
        // Angular velocity in rad/s
        values = [
          Math.sin(stepIndex * 0.2) * 0.01,
          Math.cos(stepIndex * 0.2) * 0.01,
          0.005
        ]
        break

      case SensorType.MAGNETIC_FIELD:
        // Ambient geomagnetic field in uT (typical ~45-50 uT)
        values = [19.2, -5.4, 42.1]
        break

      case SensorType.LIGHT:
        // Ambient light in SI lux
        values = [300.0] // 300 lux normal room lighting
        break

      case SensorType.PROXIMITY:
        // Distance in cm (5.0 cm far, 0.0 cm near)
        values = [5.0]
        break

      case SensorType.STEP_COUNTER:
        // Cumulative steps taken since boot
        values = [100 + stepIndex]
        break

      case SensorType.STEP_DETECTOR:
        // Emitted when a step is taken
        values = [1.0]
        break

      case SensorType.ROTATION_VECTOR:
        // Quaternion [x*sin(theta/2), y*sin(theta/2), z*sin(theta/2), cos(theta/2)]
        values = [0.0, 0.0, 0.0, 1.0]
        break

      default:
        values = [0.0]
        break
    }

    return {
      sensorType: type,
      accuracy: 3, // SENSOR_STATUS_ACCURACY_HIGH
      timestampNs,
      values
    }
  }
}
