import type { FaceLandmark, PixelLandmark } from "../../types/face";

/**
 * MediaPipe Face Landmarker 결과
 */
export interface FaceDetectionResult {
  landmarks: FaceLandmark[]; // 468개의 랜드마크
  hasFace: boolean;
}

/**
 * 비디오 스트림에서 추출된 특징값 콜백
 */
export interface FaceFeatureCallback {
  (features: {
    landmarks: PixelLandmark[];
    normalizedFeatures: import("../../types/face").FaceFeatures;
    scaledFeatures: import("../../types/face").ScaledFeatures;
    hash: string;
  }): void;
}

/**
 * 스캔 진행 상태
 */
export interface ScanProgress {
  stage:
    | "idle"
    | "detecting"
    | "collecting"
    | "processing"
    | "completed"
    | "error";
  progress: number; // 0-100
  message: string;
  collectedFrames: number;
  totalFrames: number;
}
