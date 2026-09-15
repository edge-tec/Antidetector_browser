import { DisplayMetricsSpec, ScreenOrientation, DisplayCutoutSpec } from '../core/types'

/**
 * Android Display Configuration compatibility helper.
 * Models android.util.DisplayMetrics and android.content.res.Configuration screen features.
 */
export class DisplayConfiguration {
  private metrics: DisplayMetricsSpec

  constructor(metrics: DisplayMetricsSpec) {
    this.metrics = { ...metrics }
  }

  public getMetrics(): DisplayMetricsSpec {
    return { ...this.metrics }
  }

  public getWidth(): number {
    return this.metrics.widthPixels
  }

  public getHeight(): number {
    return this.metrics.heightPixels
  }

  public getDensityDpi(): number {
    return this.metrics.densityDpi
  }

  public getDensity(): number {
    return this.metrics.density
  }

  public getRefreshRate(): number {
    return this.metrics.refreshRate
  }

  public getOrientation(): ScreenOrientation {
    return this.metrics.orientation
  }

  public getCutout(): DisplayCutoutSpec {
    return { ...this.metrics.cutout }
  }

  public setOrientation(orientation: ScreenOrientation): void {
    if (
      (this.metrics.orientation === ScreenOrientation.PORTRAIT &&
        (orientation === ScreenOrientation.LANDSCAPE || orientation === ScreenOrientation.REVERSE_LANDSCAPE)) ||
      (this.metrics.orientation === ScreenOrientation.LANDSCAPE &&
        (orientation === ScreenOrientation.PORTRAIT || orientation === ScreenOrientation.REVERSE_PORTRAIT))
    ) {
      // Swap width and height upon 90/270 deg rotation
      const prevW = this.metrics.widthPixels
      this.metrics.widthPixels = this.metrics.heightPixels
      this.metrics.heightPixels = prevW
    }
    this.metrics.orientation = orientation
  }

  public setRefreshRate(rate: number): void {
    if (!this.metrics.supportedRefreshRates.includes(rate)) {
      throw new Error(`Unsupported refresh rate: ${rate}Hz. Supported: ${this.metrics.supportedRefreshRates.join(', ')}Hz`)
    }
    this.metrics.refreshRate = rate
  }

  /**
   * Helper to format Android-compatible DisplayMetrics output
   */
  public toAndroidDisplayMetrics(): {
    widthPixels: number
    heightPixels: number
    density: number
    densityDpi: number
    scaledDensity: number
    xdpi: number
    ydpi: number
  } {
    return {
      widthPixels: this.metrics.widthPixels,
      heightPixels: this.metrics.heightPixels,
      density: this.metrics.density,
      densityDpi: this.metrics.densityDpi,
      scaledDensity: this.metrics.scaledDensity,
      xdpi: this.metrics.xdpi,
      ydpi: this.metrics.ydpi
    }
  }
}
