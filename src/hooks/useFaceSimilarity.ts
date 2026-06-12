/**
 * 얼굴 유사도 검증 유틸리티
 */

import type { FaceSimilarityResult } from "../lib/zkp/types";
import { DEFAULT_SIMILARITY_THRESHOLD } from "../lib/zkp/config";

/**
 * 정부 DB 특징값과 웹캠으로 추출한 특징값을 비교하여 얼굴 유사도를 검증합니다.
 *
 * @param userFeatures 웹캠으로 추출한 특징값 (10개 정수 배열)
 * @param governmentFeatures 정부 DB 특징값 (10개 정수 배열)
 * @param threshold 유사도 임계값 (선택적, 기본값: DEFAULT_SIMILARITY_THRESHOLD)
 * @returns 얼굴 유사도 검증 결과
 */
export function checkFaceSimilarity(
  userFeatures: number[],
  governmentFeatures: number[],
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD
): FaceSimilarityResult {
  // 배열 길이 검증
  if (userFeatures.length !== 10 || governmentFeatures.length !== 10) {
    throw new Error(
      `특징값 배열 길이가 올바르지 않습니다. userFeatures: ${userFeatures.length}, governmentFeatures: ${governmentFeatures.length} (기대값: 10)`
    );
  }

  // 유클리드 거리 계산 (제곱합)
  let distance = 0;
  const differences: number[] = [];

  for (let i = 0; i < 10; i++) {
    const diff = governmentFeatures[i] - userFeatures[i];
    const squared = diff * diff;
    differences.push(diff);
    distance += squared;
  }

  // 임계값과 비교
  const isSimilar = distance <= threshold;

  return {
    isSimilar,
    distance,
    threshold,
    differences,
  };
}
