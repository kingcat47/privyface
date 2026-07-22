# 백엔드 마이그레이션 — o1js → snarkjs

> 프론트엔드를 circom + snarkjs로 교체하면서 백엔드도 함께 수정한 내용.
> 백엔드 위치: `C:\Users\leetaegyeom\Desktop\zkpj`

---

## 배경

프론트가 snarkjs groth16 proof를 생성해서 보내기 시작했는데,
백엔드는 여전히 o1js 기반으로 검증하고 있었음.
두 시스템이 서로 다른 ZKP 형식과 해시 함수를 쓰고 있어서 검증이 절대 통과될 수 없는 상태였음.

---

## 문제 1: Merkle 검증에 o1js Poseidon 사용

**기존 코드 (`zkp-verification.service.ts`)**
```ts
import { Field, Poseidon } from 'o1js';

currentHash = Poseidon.hash([currentHash, sibling]); // o1js (Pasta 곡선)
```

**문제**
백엔드가 o1js의 Poseidon(Pasta 곡선, Mina Protocol용)으로 머클 루트를 재계산하고
`.env`의 `MERKLE_ROOT`와 비교했음.

하지만 프론트는 circomlib Poseidon(BN128 곡선)으로 만든 데이터를 보내고 있어서
같은 입력이어도 해시 결과가 달라 루트가 절대 일치하지 않음.

**수정**
`circomlibjs`의 `buildPoseidon()`으로 교체:
```ts
import { buildPoseidon } from 'circomlibjs';

const poseidon = await buildPoseidon();
const hash = (...inputs: string[]) => {
  const result = poseidon(inputs.map(BigInt));
  return poseidon.F.toString(result);
};
currentHash = hash(currentHash, sibling); // circomlibjs (BN128 곡선)
```

---

## 문제 2: Face ZKP 검증에 o1js 사용

**기존 코드**
```ts
import { FaceVerificationProgram } from './circuits/face-verification-program';
import { VerificationKey, Proof } from 'o1js';

const vkData = JSON.parse(zkProof.verificationKey);
const verificationKey = VerificationKey.fromJSON(vkData);   // o1js
const faceProof = await FaceVerificationProgram.Proof.fromJSON(jsonProof); // o1js
await faceProof.verify();                                   // o1js PLONK 검증
```

**문제**
백엔드가 o1js의 `ZkProgram.Proof.fromJSON()`으로 proof를 복원하고 `proof.verify()`로 검증하는데,
프론트가 보내는 proof는 snarkjs groth16 형식(`pi_a`, `pi_b`, `pi_c`)이라 파싱 자체가 실패함.

두 proof 형식 비교:
| | o1js proof | snarkjs groth16 proof |
|---|---|---|
| 형식 | `{ maxProofsVerified, proof, publicInput, publicOutput }` | `{ pi_a, pi_b, pi_c, protocol, curve }` |
| 검증 방식 | PLONK / KZG | Groth16 pairing check |
| 곡선 | Pasta (Pallas) | BN128 (alt_bn128) |

**수정**
`snarkjs.groth16.verify()`로 교체:
```ts
import * as snarkjs from 'snarkjs';

const proof = JSON.parse(zkProof.proof);
const isValid = await snarkjs.groth16.verify(
  verificationKey,   // groth16 vk 객체
  publicSignals,     // [root, threshold]
  proof,             // { pi_a, pi_b, pi_c }
);
```

---

## 문제 3: publicInput 필드명 및 기대값 불일치

**기존 코드**
```ts
// DTO
publicInput: string[]; // 필드명 publicInput

// 검증 로직
if (zkProof.publicInput[0] !== '1') return false; // "1" 기대
```

**문제**
- 필드명: 프론트는 `publicSignals`를 보내는데 백엔드 DTO는 `publicInput`으로 받음 → undefined
- 기대값: o1js 시절엔 publicInput이 `['1']`(유사도 통과 여부)이었지만,
  snarkjs groth16의 publicSignals는 회로의 public input인 `[root, threshold]`

**수정**
- DTO 필드명 `publicInput` → `publicSignals`로 변경
- `publicInput[0] !== '1'` 체크 제거 (snarkjs.groth16.verify()가 모든 검증을 담당)

---

## 문제 4: verificationKey 타입 불일치

**기존 코드**
```ts
// DTO
verificationKey: string; // 문자열로 기대

// 로직
zkProof.verificationKey.substring(0, 50) // 문자열 메서드 호출
JSON.parse(zkProof.verificationKey)      // 파싱해서 사용
```

**문제**
프론트가 `verificationKey`를 이미 파싱된 객체로 보내는데 백엔드는 문자열로 기대함.

**수정**
- DTO: `verificationKey: string` → `verificationKey: object`
- 백엔드에서 직접 `snarkjs.groth16.verify(verificationKey, ...)` 에 전달 (파싱 불필요)

---

## 문제 5: .env MERKLE_ROOT 값

**기존 값** (o1js Poseidon 기준)
```
MERKLE_ROOT = 4041534543159854687984238186366163703328051953185635023444461187988033966095
```

**새 값** (circomlibjs Poseidon 기준, `scripts/rebuild-merkle.mjs`로 재계산)
```
MERKLE_ROOT = 8084332926463310671314126536261206652787176814375728514045642604635732139957
```

---

## 수정된 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/zkp/zkp-verification.service.ts` | o1js 전부 제거, circomlibjs + snarkjs로 교체 |
| `src/zkp/dto/verify-identity.dto.ts` | `publicInput` → `publicSignals`, `verificationKey: string` → `object` |
| `.env` | `MERKLE_ROOT` 새 값으로 업데이트 |

## 설치된 패키지

```bash
npm install snarkjs circomlibjs
```

---

## 검증 흐름 (수정 후)

```
[1단계] Merkle 검증
  leafHash → circomlibjs Poseidon으로 루트 재계산 → .env MERKLE_ROOT와 비교

[2단계] Face ZKP 검증
  snarkjs.groth16.verify(verificationKey, publicSignals, proof)
  → true면 통과 (얼굴 유사도 + 머클 트리 검증이 회로 안에서 이미 증명됨)
```
