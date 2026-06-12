import type { FaceFeatures, ScaledFeatures } from "../../types/face";
import { featuresToArray } from "./extractor";

/**
 * 정규화된 특징값을 정수로 스케일링합니다.
 * Python 코드: int(val * 10000)
 *
 * @param features 정규화된 특징값 객체
 * @returns 정수화된 특징값 배열 (10개)
 */
export function scaleFeatures(features: FaceFeatures): ScaledFeatures {
  const normalizedArray = featuresToArray(features);

  const scaled = normalizedArray.map((val) =>
    Math.round(val * 10000)
  ) as ScaledFeatures;

  return scaled;
}

/**
 * 정규화된 특징값 배열을 정수로 스케일링합니다.
 *
 * @param features 정규화된 특징값 배열
 * @returns 정수화된 특징값 배열 (10개)
 */
export function scaleFeaturesFromArray(features: number[]): ScaledFeatures {
  if (features.length !== 10) {
    throw new Error(
      `Invalid features array length: ${features.length}. Expected 10.`
    );
  }

  const scaled = features.map((val) =>
    Math.round(val * 10000)
  ) as ScaledFeatures;

  return scaled;
}

/**
 * @param features 정규화된 특징값 객체
 * @returns 정수화된 특징값
 */
export function normalizeAndHash(features: FaceFeatures): {
  scaledFeatures: ScaledFeatures;
} {
  const scaledFeatures = scaleFeatures(features);

  return {
    scaledFeatures,
  };
}
