/**
 * circomlib Poseidon 기준으로 featureHash와 머클 트리를 새로 계산하는 스크립트.
 * 실행: node scripts/rebuild-merkle.mjs
 */

import { buildPoseidon } from "circomlibjs";

// 기존 UserInfo.ts의 특징값 (바뀌지 않는 원본 데이터)
const users = [
  { userId: 0, userName: "user_ceu", features: [746, 5600, 8670, 3438, 4212, 4044, 9553, 16532, 14412, 1001] },
  { userId: 1, userName: "user_ltg", features: [735, 5351, 8600, 3455, 4692, 4072, 9707, 15512, 13717, 920] },
  { userId: 2, userName: "user_kwy", features: [714, 5448, 8341, 3134, 4399, 4200, 9755, 16333, 14571, 837] },
  { userId: 3, userName: "user_hyc", features: [709, 4872, 8084, 3253, 4276, 4352, 9871, 16338, 14300, 880] },
];

const poseidon = await buildPoseidon();

// circomlibjs Poseidon은 BigInt 배열을 입력받아 Uint8Array를 반환.
// poseidon.F.toString()으로 10진수 문자열로 변환.
function hash(...inputs) {
  const result = poseidon(inputs.map(BigInt));
  return poseidon.F.toString(result);
}

// 1. 각 유저의 featureHash 계산
const leafHashes = users.map(u => hash(...u.features));

console.log("=== 리프 해시 ===");
leafHashes.forEach((h, i) => console.log(`user[${i}] ${users[i].userName}: ${h}`));

// 2. 4-leaf 머클 트리 구성
//   level 0 (leaves): [hash0, hash1, hash2, hash3]
//   level 1 (internal): [Hash(hash0,hash1), Hash(hash2,hash3)]
//   level 2 (root):    Hash(internal0, internal1)
const internal0 = hash(leafHashes[0], leafHashes[1]);
const internal1 = hash(leafHashes[2], leafHashes[3]);
const root = hash(internal0, internal1);

console.log("\n=== 내부 노드 ===");
console.log("internal[0] (ceu+ltg):", internal0);
console.log("internal[1] (kwy+hyc):", internal1);
console.log("root:", root);

// 3. 각 유저의 머클 증명 구성
//   pathElements[0]: 리프 레벨 형제
//   pathElements[1]: 부모 노드 자신 (참고용)
//   pathElements[2]: 루트 레벨 형제
const result = [
  {
    userId: 0, userName: "user_ceu",
    leafIndex: 0, parentIndex: 0,
    pathElements: [leafHashes[1], internal0, internal1],
    pathIndices: [0, 0],
  },
  {
    userId: 1, userName: "user_ltg",
    leafIndex: 1, parentIndex: 0,
    pathElements: [leafHashes[0], internal0, internal1],
    pathIndices: [1, 0],
  },
  {
    userId: 2, userName: "user_kwy",
    leafIndex: 2, parentIndex: 1,
    pathElements: [leafHashes[3], internal1, internal0],
    pathIndices: [0, 1],
  },
  {
    userId: 3, userName: "user_hyc",
    leafIndex: 3, parentIndex: 1,
    pathElements: [leafHashes[2], internal1, internal0],
    pathIndices: [1, 1],
  },
];

// 4. UserInfo.ts 형식으로 출력
console.log("\n=== UserInfo.ts에 붙여넣을 데이터 ===\n");

const entries = result.map((u, i) => {
  const features = users[i].features;
  return `  {
    userId: ${u.userId},
    userName: "${u.userName}",
    identityData: {
      features: [${features.join(", ")}],
      featureHash: "${leafHashes[i]}",
    },
    merkleProof: {
      root: "${root}",
      pathElements: [
        "${u.pathElements[0]}",
        "${u.pathElements[1]}",
        "${u.pathElements[2]}",
      ],
      pathIndices: [${u.pathIndices.join(", ")}],
      leafIndex: ${u.leafIndex},
      parentIndex: ${u.parentIndex},
    },
  }`;
});

console.log(`export const governmentDB: UserFaceData[] = [\n${entries.join(",\n")},\n];`);
