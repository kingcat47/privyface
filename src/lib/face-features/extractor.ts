import type { PixelLandmark, FaceFeatures } from "../../types/face";
import { getDistance, getEyeDistance } from "./calculator";

/**
 * MediaPipe Face Landmarks에서 10가지 기하학적 특징을 추출합니다.
 * Python 코드와 동일한 로직을 사용합니다.
 *
 * @param landmarks 픽셀 좌표로 변환된 랜드마크 배열 (468개)
 * @returns 정규화된 특징값 객체 (눈 사이 거리로 나눈 비율)
 */
export function extractFeatures(landmarks: PixelLandmark[]): FaceFeatures {
  if (landmarks.length < 468) {
    throw new Error(
      `Invalid landmarks array length: ${landmarks.length}. Expected 468.`
    );
  }

  // 기준점: 눈 사이 거리
  const distEyes = getEyeDistance(landmarks);

  if (distEyes === 0) {
    throw new Error("Eye distance is zero. Cannot normalize features.");
  }

  // 10가지 특징 추출 (Python 코드와 동일한 인덱스 사용)
  const features: FaceFeatures = {
    f1_nose_len: getDistance(landmarks, 1, 4) / distEyes,
    f2_mouth_width: getDistance(landmarks, 61, 291) / distEyes,
    f3_eye_to_chin: getDistance(landmarks, 1, 152) / distEyes,
    f4_eye_to_mouth: getDistance(landmarks, 1, 13) / distEyes,
    f5_nose_width: getDistance(landmarks, 102, 331) / distEyes,
    f6_inner_eye_dist: getDistance(landmarks, 133, 362) / distEyes,
    f7_eyebrow_dist: getDistance(landmarks, 105, 334) / distEyes,
    f8_face_width: getDistance(landmarks, 234, 454) / distEyes,
    f9_jaw_width: getDistance(landmarks, 58, 288) / distEyes,
    f10_upper_lip: getDistance(landmarks, 0, 13) / distEyes,
  };

  return features;
}

/**
 * FaceFeatures 객체를 배열로 변환합니다.
 * Python 코드의 features.values()와 동일한 순서입니다.
 *
 * @param features 특징값 객체
 * @returns 특징값 배열 (10개)
 */
export function featuresToArray(features: FaceFeatures): number[] {
  return [
    features.f1_nose_len,
    features.f2_mouth_width,
    features.f3_eye_to_chin,
    features.f4_eye_to_mouth,
    features.f5_nose_width,
    features.f6_inner_eye_dist,
    features.f7_eyebrow_dist,
    features.f8_face_width,
    features.f9_jaw_width,
    features.f10_upper_lip,
  ];
}
