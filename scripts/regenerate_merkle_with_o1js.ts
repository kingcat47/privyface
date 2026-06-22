/**
 * o1js Poseidon 해시를 사용하여 머클 트리를 재생성하는 스크립트
 *
 * 사용법: npm run regenerate:merkle
 *
 * 이 스크립트는 o1js의 Poseidon.hash()를 사용하여 머클 트리를 재생성합니다.
 * 정부 DB는 circomlibjs로 생성되었지만, o1js 회로는 o1js의 Poseidon.hash()를 사용하므로
 * o1js의 Poseidon 해시 방식을 사용하도록 재생성해야 합니다.
 */

import { Field, Poseidon } from "o1js";

// 정부 DB 특징값 (UserInfo.ts에서 가져온 값)
const governmentFeatures = [
  [746, 5600, 8670, 3438, 4212, 4044, 9553, 16532, 14412, 1001], // 차은우
  [735, 5351, 8600, 3455, 4692, 4072, 9707, 15512, 13717, 920], // 이태겸
  [714, 5448, 8341, 3134, 4399, 4200, 9755, 16333, 14571, 837], // 곽원영
  [709, 4872, 8084, 3253, 4276, 4352, 9871, 16338, 14300, 880], // 한유찬
];

const userNames = ["차은우", "이태겸", "곽원영", "한유찬"];

/**
 * 두 해시값을 결합하여 부모 노드 해시 생성
 */
function poseidonHashPair(left: Field, right: Field): Field {
  return Poseidon.hash([left, right]);
}

/**
 * 머클 트리 구성
 */
function buildMerkleTree(leafHashes: Field[]): {
  root: Field;
  tree: Field[][];
} {
  const tree: Field[][] = [leafHashes];
  let currentLevel = leafHashes;

  while (currentLevel.length > 1) {
    const nextLevel: Field[] = [];

    // 홀수 개수 처리
    if (currentLevel.length % 2 === 1) {
      currentLevel.push(currentLevel[currentLevel.length - 1]);
    }

    // 두 개씩 묶어서 부모 노드 생성
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1];
      const parent = poseidonHashPair(left, right);
      nextLevel.push(parent);
    }

    tree.push(nextLevel);
    currentLevel = nextLevel;
  }

  return {
    root: currentLevel[0],
    tree: tree,
  };
}

/**
 * 머클 증명 생성
 */
function generateMerkleProof(
  leafIndex: number,
  tree: Field[][]
): {
  pathElements: Field[];
  pathIndices: number[];
} {
  const siblings: Field[] = [];
  const pathIndices: number[] = [];
  let currentIndex = leafIndex;

  for (let level = 0; level < tree.length - 1; level++) {
    const currentLevel = tree[level];

    // 형제 노드 인덱스 계산
    let siblingIndex: number;
    if (currentIndex % 2 === 0) {
      siblingIndex = currentIndex + 1;
      pathIndices.push(0); // 왼쪽 노드
    } else {
      siblingIndex = currentIndex - 1;
      pathIndices.push(1); // 오른쪽 노드
    }

    // 형제 노드가 존재하는지 확인
    if (siblingIndex < currentLevel.length) {
      siblings.push(currentLevel[siblingIndex]);
    } else {
      // 형제가 없으면 자신을 복제
      siblings.push(currentLevel[currentIndex]);
    }

    currentIndex = Math.floor(currentIndex / 2);
  }

  return {
    pathElements: siblings,
    pathIndices: pathIndices,
  };
}

async function main() {
  console.log("=".repeat(60));
  console.log("o1js Poseidon 해시를 사용한 머클 트리 재생성");
  console.log("=".repeat(60));

  // 1. 각 특징값을 o1js Poseidon 해시로 변환
  console.log("\n1. 리프 노드 해시 계산 (o1js Poseidon)...");
  const leafHashes: Field[] = [];
  const leafHashesString: string[] = [];

  for (let i = 0; i < governmentFeatures.length; i++) {
    const features = governmentFeatures[i];
    const featuresField = features.map((f) => Field(f));
    const leafHash = Poseidon.hash(featuresField);
    const leafHashString = leafHash.toString();

    leafHashes.push(leafHash);
    leafHashesString.push(leafHashString);

    console.log(`   [${i}] ${userNames[i]}:`);
    console.log(`       특징값: [${features.join(", ")}]`);
    console.log(`       해시: ${leafHashString}`);
  }

  // 2. 머클 트리 구성
  console.log("\n2. 머클 트리 구성 중...");
  const merkleTree = buildMerkleTree(leafHashes);
  const rootString = merkleTree.root.toString();

  console.log(`\n   머클 루트: ${rootString}`);

  // 3. 각 리프에 대한 머클 증명 생성
  console.log("\n3. 머클 증명 생성 중...");
  const proofs: Array<{
    userId: number;
    userName: string;
    features: number[];
    featureHash: string;
    merkleProof: {
      root: string;
      pathElements: string[];
      pathIndices: number[];
      leafIndex: number;
    };
  }> = [];

  for (let i = 0; i < leafHashes.length; i++) {
    const proof = generateMerkleProof(i, merkleTree.tree);
    proofs.push({
      userId: i,
      userName: userNames[i],
      features: governmentFeatures[i],
      featureHash: leafHashesString[i],
      merkleProof: {
        root: rootString,
        pathElements: proof.pathElements.map((p) => p.toString()),
        pathIndices: proof.pathIndices,
        leafIndex: i,
      },
    });

    console.log(`   [${i}] ${userNames[i]}:`);
    console.log(
      `       pathElements: [${proof.pathElements
        .map((p) => p.toString().substring(0, 20) + "...")
        .join(", ")}]`
    );
    console.log(`       pathIndices: [${proof.pathIndices.join(", ")}]`);
  }

  // 4. 결과 출력 (TypeScript 형식)
  console.log("\n" + "=".repeat(60));
  console.log("UserInfo.ts에 사용할 코드:");
  console.log("=".repeat(60));
  console.log("\nexport const governmentDB: UserFaceData[] = [");

  for (const proof of proofs) {
    console.log("  {");
    console.log(`    userId: ${proof.userId},`);
    console.log(`    userName: "${proof.userName}",`);
    console.log("    identityData: {");
    console.log(`      features: [${proof.features.join(", ")}],`);
    console.log(`      featureHash: "${proof.featureHash}",`);
    console.log("    },");
    console.log("    merkleProof: {");
    console.log(`      root: "${proof.merkleProof.root}",`);
    console.log("      pathElements: [");
    for (const elem of proof.merkleProof.pathElements) {
      console.log(`        "${elem}",`);
    }
    console.log("      ],");
    console.log(
      `      pathIndices: [${proof.merkleProof.pathIndices.join(", ")}],`
    );
    console.log(`      leafIndex: ${proof.merkleProof.leafIndex},`);
    console.log("    },");
    console.log("  },");
  }

  console.log("];");
  console.log("\n" + "=".repeat(60));
  console.log("✅ 완료!");
  console.log(
    "\n위 코드를 복사하여 src/government/UserInfo.ts에 붙여넣으세요."
  );
}

main().catch(console.error);
