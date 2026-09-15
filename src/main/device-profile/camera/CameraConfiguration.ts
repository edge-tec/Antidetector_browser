import { CameraSpec, LensFacing } from '../core/types'

/**
 * Android Camera2 API compatibility abstraction.
 * Encapsulates multi-camera characteristics and configuration queries.
 */
export class CameraConfiguration {
  private readonly cameras: CameraSpec[]

  constructor(cameras: CameraSpec[]) {
    this.cameras = [...cameras]
  }

  public getCameras(): CameraSpec[] {
    return [...this.cameras]
  }

  public getCameraById(id: string): CameraSpec | undefined {
    return this.cameras.find((c) => c.cameraId === id)
  }

  public getBackCameras(): CameraSpec[] {
    return this.cameras.filter((c) => c.facing === LensFacing.BACK)
  }

  public getFrontCameras(): CameraSpec[] {
    return this.cameras.filter((c) => c.facing === LensFacing.FRONT)
  }

  public getPrimaryBackCamera(): CameraSpec | undefined {
    return this.getBackCameras()[0]
  }

  public getPrimaryFrontCamera(): CameraSpec | undefined {
    return this.getFrontCameras()[0]
  }

  /**
   * Produces an Android CameraCharacteristics descriptor compatible with android.hardware.camera2
   */
  public toCameraCharacteristicsMap(): Record<string, any> {
    const map: Record<string, any> = {}
    for (const cam of this.cameras) {
      map[cam.cameraId] = {
        'android.lens.facing': cam.facing === LensFacing.BACK ? 'LENS_FACING_BACK' : 'LENS_FACING_FRONT',
        'android.sensor.info.pixelArraySize': {
          width: cam.activeArrayWidth,
          height: cam.activeArrayHeight
        },
        'android.lens.info.availableFocalLengths': [cam.focalLengthMm],
        'android.lens.info.availableApertures': [cam.apertureFNumber],
        'android.flash.info.available': cam.hasFlash,
        'android.control.afAvailableModes': cam.hasAutofocus ? ['AF_MODE_AUTO', 'AF_MODE_CONTINUOUS_PICTURE', 'AF_MODE_CONTINUOUS_VIDEO'] : ['AF_MODE_OFF'],
        'android.lens.opticalStabilization': cam.hasOpticalStabilization,
        'android.scaler.streamConfigurationMap': {
          formats: cam.supportedImageFormats,
          videoSizes: cam.supportedVideoResolutions
        }
      }
    }
    return map
  }
}
