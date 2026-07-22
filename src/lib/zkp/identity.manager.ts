/**
 * Identity Manager
 * 유저 데이터와 ZK 로직을 연결하는 메인 클래스 (circom + snarkjs 버전)
 */

import type { UserFaceData } from "../../government/UserInfo";
import type { MerkleProofData, ServerProofPayload } from "./types";
import { DEFAULT_SIMILARITY_THRESHOLD } from "./config";
import { generateProof } from "./circom/prover";

export class IdentityManager {
  /**
   * 정부 DB 데이터에서 머클 트리 증명 정보를 추출한다.
   */
  async extractMerkleProof(
    userFaceData: UserFaceData
  ): Promise<MerkleProofData> {
    const leafHash = userFaceData.identityData.featureHash;

    const siblings = [
      userFaceData.merkleProof.pathElements[0],
      userFaceData.merkleProof.pathElements[2],
    ];

    const leafIndex = userFaceData.merkleProof.leafIndex;
    const parentIndex = userFaceData.merkleProof.parentIndex;

    const isLeft = [
      leafIndex % 2 === 0,
      parentIndex % 2 === 0,
    ];

    return { leafHash, siblings, isLeft };
  }

  /**
   * circom + snarkjs로 groth16 proof를 생성한다.
   *
   * @param userFeatures       웹캠 특징값 10개
   * @param governmentFeatures 정부 DB 특징값 10개
   * @param pathElements       머클 경로 형제 해시 (전체 3개 중 인덱스 0, 1 사용)
   * @param pathIndices        머클 경로 방향 (2개)
   * @param root               머클 루트
   * @param threshold          유사도 임계값
   */
  async generateFaceZkProof(
    userFeatures: number[],
    governmentFeatures: number[],
    pathElements: string[],
    pathIndices: number[],
    root: string,
    threshold: number = DEFAULT_SIMILARITY_THRESHOLD
  ) {
    // UserInfo.ts의 pathElements 구조:
    //   [0] = 리프 레벨 형제 노드
    //   [1] = 부모 노드 자신 (머클 증명에 불필요)
    //   [2] = 루트 레벨 형제 노드
    // 회로(levels=2)에는 [0]과 [2]만 필요
    const circomPathElements = [pathElements[0], pathElements[2]];

    let proof, publicSignals;
    try {
      ({ proof, publicSignals } = await generateProof(
        governmentFeatures,
        userFeatures,
        circomPathElements,
        pathIndices,
        root,
        threshold
      ));
    } catch (err) {
      // circom 회로의 lt.out === 1 제약이 실패한 경우:
      // 거리 > threshold → 얼굴이 DB와 일치하지 않음
      // WASM 내부 에러를 사용자 친화적 메시지로 변환
      throw new Error("얼굴이 일치하지 않습니다. (거리가 임계값을 초과했습니다)");
    }

    // verification key를 런타임에 fetch해서 payload에 포함
    // 백엔드가 별도로 파일을 가지고 있다면 이 필드는 생략 가능
    const vkResponse = await fetch("/circuits/verification_key.json");
    const verificationKey = await vkResponse.json();

    // 백엔드가 proof를 문자열로 기대함 (proof.substring() 호출)
    // o1js 시절과 동일하게 JSON.stringify로 직렬화해서 전송
    return { proof: JSON.stringify(proof), publicSignals, verificationKey };
  }

  /**
   * 서버 전송용 전체 payload를 생성한다.
   */
  async createProofForUser(
    userFeatures: number[],
    userFaceData: UserFaceData,
    _options?: { metadata?: Record<string, any> },
    threshold: number = DEFAULT_SIMILARITY_THRESHOLD
  ): Promise<ServerProofPayload> {
    const merkleProof = await this.extractMerkleProof(userFaceData);

    const faceZkProof = await this.generateFaceZkProof(
      userFeatures,
      userFaceData.identityData.features,
      userFaceData.merkleProof.pathElements,
      userFaceData.merkleProof.pathIndices,
      userFaceData.merkleProof.root,
      threshold
    );

    return { merkleProof, faceZkProof };
  }
}
