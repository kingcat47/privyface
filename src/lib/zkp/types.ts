/**
 * ZKP 관련 타입 정의
 */

/**
 * 머클 트리 증명 정보
 */
export interface MerkleProofData {
  /** 주민증 특징 해시 (Leaf Hash) */
  leafHash: string;
  /** 형제 노드들 (siblings) */
  siblings: string[];
  /** 위치 정보 (true = 왼쪽, false = 오른쪽) */
  isLeft: boolean[];
}

/**
 * 얼굴 유사도 검증 결과
 */
export interface FaceSimilarityResult {
  /** 검증 통과 여부 */
  isSimilar: boolean;
  /** 계산된 유클리드 거리 (제곱합) */
  distance: number;
  /** 사용된 임계값 */
  threshold: number;
  /** 각 특징값별 차이 */
  differences: number[];
}

/**
 * 서버로 전송할 최종 Proof 형식 (snarkjs groth16 기준)
 */
export interface ServerProofPayload {
  /** 머클 트리 증명 */
  merkleProof: MerkleProofData;
  /** 얼굴 유사도 ZKP 증명 */
  faceZkProof: {
    /** groth16 proof (JSON.stringify된 문자열, 백엔드 호환용) */
    proof: string;
    /** 회로의 public input 값들 (root, threshold) */
    publicSignals: string[];
  };
}

/**
 * Proof 생성 옵션
 */
export interface ProofGenerationOptions {
  /** 추가 메타데이터 */
  metadata?: Record<string, any>;
}
