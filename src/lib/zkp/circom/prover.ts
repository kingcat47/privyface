/**
 * circom + snarkjs 기반 ZK Proof 생성기
 *
 * snarkjs.groth16.fullProve()를 사용해서
 * 얼굴 특징값과 머클 트리 정보로 proof를 만든다.
 */

import * as snarkjs from "snarkjs";

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────

/**
 * circom 회로에 넣을 입력값들.
 * 필드 이름이 face-verification.circom의 signal input 이름과 정확히 일치해야 함.
 */
export interface CircomInput {
  governmentFeatures: string[]; // 정부 DB 특징값 10개 (BigInt 문자열)
  userFeatures: string[];       // 웹캠 특징값 10개 (BigInt 문자열)
  pathElements: string[];       // 머클 경로 형제 노드 해시 2개 (BigInt 문자열)
  pathIndices: string[];        // 머클 경로 방향 2개 ("0" 또는 "1")
  root: string;                 // 머클 루트 (BigInt 문자열)
  threshold: string;            // 유사도 임계값 (BigInt 문자열)
}

/**
 * snarkjs가 반환하는 groth16 proof 구조.
 * 백엔드에서 그대로 검증에 사용됨.
 */
export interface Groth16Proof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
  curve: string;
}

/**
 * fullProve() 결과물.
 */
export interface ProveResult {
  proof: Groth16Proof;
  publicSignals: string[]; // 회로의 public input/output 값들 (root, threshold 순서)
}

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

// public/ 폴더에 배치한 빌드 산출물 경로
const WASM_PATH = "/circuits/face-verification.wasm";
const ZKEY_PATH = "/circuits/face-verification.zkey";

// ─────────────────────────────────────────────
// 메인 함수
// ─────────────────────────────────────────────

/**
 * groth16 proof를 생성한다.
 *
 * @param governmentFeatures 정부 DB 특징값 (number[] 10개)
 * @param userFeatures       웹캠 특징값 (number[] 10개)
 * @param pathElements       머클 경로 형제 해시 (string[] 2개, BigInt 문자열)
 * @param pathIndices        머클 경로 방향 (number[] 2개, 0 또는 1)
 * @param root               머클 루트 (string, BigInt 문자열)
 * @param threshold          유사도 임계값 (number)
 * @returns proof와 publicSignals
 */
export async function generateProof(
  governmentFeatures: number[],
  userFeatures: number[],
  pathElements: string[],
  pathIndices: number[],
  root: string,
  threshold: number
): Promise<ProveResult> {
  // circom 회로의 signal input에 넣을 입력 객체 구성.
  // snarkjs는 모든 값을 BigInt 문자열 또는 숫자로 받음.
  const input: CircomInput = {
    governmentFeatures: governmentFeatures.map(String),
    userFeatures: userFeatures.map(String),
    pathElements: pathElements,
    pathIndices: pathIndices.map(String),
    root: root,
    threshold: String(threshold),
  };

  // 실제 제곱거리 계산 (회로 통과 여부 미리 확인용)
  const squaredDist = governmentFeatures.reduce(
    (sum, gf, i) => sum + (gf - userFeatures[i]) ** 2,
    0
  );
  console.log("[prover] 실제 제곱거리:", squaredDist);
  console.log("[prover] threshold:", threshold);
  console.log("[prover] 통과 여부 (dist < threshold):", squaredDist < threshold);

  console.log("[prover] proof 생성 시작");
  console.log("[prover] input:", input);

  // snarkjs.groth16.fullProve:
  //   입력값 → witness 계산 → proof 생성 을 한 번에 수행.
  //   wasm: witness 계산용 WebAssembly 파일
  //   zkey: proving key (groth16 파라미터)
  console.time("[prover] proof 생성 시간");
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    WASM_PATH,
    ZKEY_PATH
  );
  console.timeEnd("[prover] proof 생성 시간");

  console.log("[prover] proof 생성 완료");
  console.log("[prover] publicSignals:", publicSignals);

  return { proof: proof as Groth16Proof, publicSignals };
}
