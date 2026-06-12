import type { PixelLandmark } from "../../types/face";

/**
 * 두 랜드마크 포인트 사이의 유클리드 거리를 계산합니다.
 * @param landmarks 픽셀 좌표로 변환된 랜드마크 배열
 * @param idx1 첫 번째 랜드마크 인덱스
 * @param idx2 두 번째 랜드마크 인덱스
 * @returns 두 포인트 사이의 거리 (픽셀 단위)
 */
export function getDistance(
  landmarks: PixelLandmark[],
  idx1: number,
  idx2: number
): number {
  const p1 = landmarks[idx1];
  const p2 = landmarks[idx2];

  if (!p1 || !p2) {
    throw new Error(`Invalid landmark indices: ${idx1} or ${idx2}`);
  }

  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 눈 사이 거리를 기준점으로 계산합니다.
 * MediaPipe Face Landmark 인덱스 33과 263 사이의 거리
 * @param landmarks 픽셀 좌표로 변환된 랜드마크 배열
 * @returns 눈 사이 거리 (픽셀 단위)
 */
export function getEyeDistance(landmarks: PixelLandmark[]): number {
  return getDistance(landmarks, 33, 263);
}
