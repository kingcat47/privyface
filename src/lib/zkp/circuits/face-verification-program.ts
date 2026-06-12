/**
 * Face Verification zkProgram using o1js
 * 얼굴 유사도 검증을 위한 ZK-SNARK 회로
 */

import { Field, Provable, Struct, ZkProgram } from "o1js";

/**
 * 얼굴 특징값 구조
 */
export class FaceFeatures extends Struct({
  features: Provable.Array(Field, 10),
}) {}

/**
 * Face Verification ZkProgram
 *
 * Private Input: 정부 DB 특징값, 웹캠 특징값, 임계값
 * Public Input: 유사도 결과 (1 = 통과, 0 = 실패)
 */
export const FaceVerificationProgram = ZkProgram({
  name: "FaceVerification",
  publicInput: Field, // 유사도 결과 (1 또는 0)

  methods: {
    proveMatch: {
      privateInputs: [FaceFeatures, FaceFeatures, Field], // [정부 DB 특징값, 웹캠 특징값, 임계값]

      async method(
        publicInput: Field, // Public Input: 유사도 결과 (1 또는 0)
        governmentFeatures: FaceFeatures,
        userFeatures: FaceFeatures,
        threshold: Field
      ): Promise<void> {
        // 유클리드 거리 계산 (제곱합)
        let distance = Field(0);
        for (let i = 0; i < 10; i++) {
          const diff = governmentFeatures.features[i].sub(
            userFeatures.features[i]
          );
          distance = distance.add(diff.mul(diff));
        }

        // 임계값과 비교: distance <= threshold
        const isSimilar = distance.lessThanOrEqual(threshold);

        // Public Input 검증: 통과하면 1, 실패하면 0
        // publicInput이 1이면 isSimilar도 true여야 함
        const expectedPublicInput = Provable.if(isSimilar, Field(1), Field(0));
        expectedPublicInput.assertEquals(
          publicInput,
          "유사도 검증 결과가 Public Input과 일치하지 않습니다"
        );
      },
    },
  },
});
