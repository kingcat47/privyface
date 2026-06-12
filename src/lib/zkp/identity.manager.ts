/**
 * Identity Manager
 * 유저 데이터와 ZK 로직을 연결하는 메인 클래스
 */

import { Field } from "o1js";
import type { UserFaceData } from "../../government/UserInfo";
import type { MerkleProofData, ServerProofPayload } from "./types";
import { checkFaceSimilarity } from "../../hooks/useFaceSimilarity";
import { DEFAULT_SIMILARITY_THRESHOLD } from "./config";
import {
  FaceVerificationProgram,
  FaceFeatures,
} from "./circuits/face-verification-program";

// 모듈 레벨에서 verificationKey 캐시 (모든 인스턴스가 공유)
let cachedVerificationKey: any = null;

export class IdentityManager {
  /**
   * 정부 DB 데이터에서 머클 트리 증명 정보를 추출합니다.
   *
   * @param userFaceData 정부 DB에서 가져온 사용자 데이터
   * @returns 머클 트리 증명 정보
   */
  async extractMerkleProof(
    userFaceData: UserFaceData
  ): Promise<MerkleProofData> {
    // 1. leafHash: featureHash를 Poseidon 해시에 넣은 값
    const leafHash = userFaceData.identityData.featureHash;

    // 2. siblings: pathElements[0] (옆에 노드), pathElements[2] (부모 노드의 옆에 노드)
    const siblings = [
      userFaceData.merkleProof.pathElements[0],
      userFaceData.merkleProof.pathElements[2],
    ];

    // 3. isLeft: leafIndex가 짝수면 true, 홀수면 false
    const leafIndex = userFaceData.merkleProof.leafIndex;
    const parentIndex = userFaceData.merkleProof.parentIndex; // 부모 노드 인덱스

    const isLeft = [
      leafIndex % 2 === 0, // 첫 번째 레벨 (siblings[0])
      parentIndex % 2 === 0, // 두 번째 레벨 (siblings[1])
    ];

    return {
      leafHash,
      siblings,
      isLeft,
    };
  }

  /**
   * 얼굴 유사도 ZKP Proof를 생성합니다.
   *
   * @param userFeatures 웹캠으로 추출한 특징값 (10개 정수 배열)
   * @param governmentFeatures 정부 DB 특징값 (10개 정수 배열)
   * @param threshold 유사도 임계값 (선택적)
   * @returns faceZkProof 객체
   */
  async generateFaceZkProof(
    userFeatures: number[],
    governmentFeatures: number[],
    threshold: number = DEFAULT_SIMILARITY_THRESHOLD
  ): Promise<{
    proof: string;
    publicInput: string[];
    verificationKey: string;
  }> {
    // 1. 얼굴 유사도 검증 (참고용, 최종 검증은 백엔드에서 수행)
    const similarityResult = checkFaceSimilarity(
      userFeatures,
      governmentFeatures,
      threshold
    );

    // 검증 실패해도 proof 생성 (최종 검증은 백엔드에서 결정)
    if (!similarityResult.isSimilar) {
      console.warn(
        `얼굴 유사도 검증 실패: 거리(${similarityResult.distance}) > 임계값(${threshold})`
      );
      console.warn(
        "하지만 proof는 생성하여 서버로 전송합니다. 최종 검증은 백엔드에서 수행됩니다."
      );
    }

    // 2. ZkProgram 컴파일 (첫 실행 시에만, 이후 캐시 사용)
    // 모듈 레벨 캐시를 사용하여 인스턴스가 새로 생성되어도 컴파일 결과 재사용
    if (!cachedVerificationKey) {
      console.log("Face Verification Program 컴파일 중...");
      const { verificationKey } = await FaceVerificationProgram.compile();
      cachedVerificationKey = verificationKey;
      console.log("컴파일 완료 (캐시에 저장됨)");

      // verificationKey 디버깅
      console.log("verificationKey 디버깅:");
      try {
        // verificationKey는 { data: string, hash: Field } 형태일 수 있음
        const vkJson = {
          data: (verificationKey as any).data || "",
          hash: (verificationKey as any).hash?.toString() || "",
        };
        console.log("1. verificationKey 구조:", verificationKey);
        console.log("2. 변환 결과:", vkJson);
        console.log("3. JSON.stringify 결과:", JSON.stringify(vkJson));
        console.log("4. 길이:", JSON.stringify(vkJson).length);
        console.log("5. 실제 내용:", JSON.stringify(vkJson).substring(0, 200));
      } catch (e) {
        console.error("verificationKey 디버깅 실패:", e);
      }
    } else {
      console.log("컴파일 결과를 캐시에서 재사용합니다.");
    }

    // 3. 입력 데이터를 Field 타입으로 변환
    const govFeatures = new FaceFeatures({
      features: governmentFeatures.map((f) => Field(f)),
    });
    const usrFeatures = new FaceFeatures({
      features: userFeatures.map((f) => Field(f)),
    });
    const thresholdField = Field(threshold);

    // 4. Public Input: 유사도 결과 (1 = 통과, 0 = 실패)
    // 실제 검증 결과에 따라 설정 (최종 검증은 백엔드에서 수행)
    const publicInput = Field(similarityResult.isSimilar ? 1 : 0);

    // 5. Proof 생성
    console.log("Proof 생성 중...");
    const proofResult = await FaceVerificationProgram.proveMatch(
      publicInput,
      govFeatures,
      usrFeatures,
      thresholdField
    );

    // 6. Proof를 JSON으로 직렬화 (o1js 공식 방법)
    // proofResult는 { proof: Proof, auxiliaryOutput: undefined } 형태
    const proof = proofResult.proof;

    // Proof.toJSON()으로 JsonProof 객체를 얻고, JSON.stringify()로 문자열 변환
    let proofString: string;
    try {
      const proofJson = proof.toJSON();
      proofString = JSON.stringify(proofJson);
    } catch (e) {
      throw new Error(`Proof 직렬화 실패: ${e}`);
    }

    // 7. Public Input을 문자열 배열로 변환
    // publicInput은 Field 타입이므로 toString()으로 변환 후 배열로 감싸기
    const publicInputArray = [publicInput.toString()];

    // 8. verificationKey를 JSON 문자열로 직렬화
    let verificationKeyJson = "";
    try {
      if (!cachedVerificationKey) {
        throw new Error(
          "verificationKey가 없습니다. compile()이 실행되었는지 확인하세요."
        );
      }

      // o1js verificationKey는 { data: string, hash: Field } 형태
      // toJSON() 메서드가 없으므로 직접 구조 추출
      const vkJson = {
        data: (cachedVerificationKey as any).data || "",
        hash: (cachedVerificationKey as any).hash?.toString() || "",
      };

      // 디버깅: verificationKey 내용 확인
      console.log("verificationKey 직렬화 디버깅:");
      console.log("  - verificationKey 타입:", typeof cachedVerificationKey);
      console.log("  - verificationKey 구조:", cachedVerificationKey);
      console.log("  - vkJson:", vkJson);
      console.log("  - JSON.stringify(vkJson):", JSON.stringify(vkJson));
      console.log("  - 길이:", JSON.stringify(vkJson).length);

      verificationKeyJson = JSON.stringify(vkJson);

      if (
        !verificationKeyJson ||
        verificationKeyJson === "{}" ||
        verificationKeyJson === ""
      ) {
        console.error("verificationKey가 빈 문자열 또는 빈 객체입니다!");
        console.error("  - verificationKey:", cachedVerificationKey);
        console.error("  - vkJson:", vkJson);
        throw new Error("verificationKey 직렬화 결과가 비어있습니다.");
      }
    } catch (e) {
      console.error("verificationKey 직렬화 실패:", e);
      throw new Error(
        `verificationKey 직렬화 실패: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }

    const faceZkProof = {
      proof: proofString, // JSON.stringify(proof.toJSON()) 결과
      publicInput: publicInputArray, // [publicInput.toString()]
      verificationKey: verificationKeyJson, // JSON.stringify(verificationKey.toJSON())
    };

    // 최종 payload 디버깅
    console.log("최종 faceZkProof:");
    console.log("  - proof 길이:", faceZkProof.proof.length);
    console.log("  - publicInput:", faceZkProof.publicInput);
    console.log(
      "  - verificationKey 길이:",
      faceZkProof.verificationKey.length
    );
    console.log(
      "  - verificationKey 미리보기:",
      faceZkProof.verificationKey.substring(0, 200)
    );

    return faceZkProof;
  }

  /**
   * 완전한 서버 전송용 Proof를 생성합니다.
   *
   * @param userFeatures 웹캠으로 추출한 특징값
   * @param userFaceData 정부 DB 사용자 데이터
   * @param options Proof 생성 옵션 (선택적)
   * @param threshold 유사도 임계값 (선택적)
   * @returns 서버 전송용 Proof
   */
  async createProofForUser(
    userFeatures: number[],
    userFaceData: UserFaceData,
    _options?: { metadata?: Record<string, any> },
    threshold: number = DEFAULT_SIMILARITY_THRESHOLD
  ): Promise<ServerProofPayload> {
    // 1. 머클 트리 증명 정보 추출
    const merkleProof = await this.extractMerkleProof(userFaceData);

    // 2. 얼굴 유사도 ZKP Proof 생성
    const faceZkProof = await this.generateFaceZkProof(
      userFeatures,
      userFaceData.identityData.features,
      threshold
    );

    return {
      merkleProof,
      faceZkProof,
    };
  }
}
