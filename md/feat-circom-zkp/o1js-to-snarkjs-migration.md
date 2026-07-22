# o1js → circom + snarkjs 마이그레이션 과정

> ZKP 구현을 o1js에서 circom + snarkjs로 교체하면서 겪은 문제들과 해결 과정.

---

## 전체 흐름

```
[목표]
웹캠 → MediaPipe → 10개 특징값 → snarkjs.groth16.fullProve() → 서버
```

교체 전에는 `snarkjs.groth16.fullProve()` 자리에 `o1js ZkProgram.proveMatch()`가 있었다.
교체 작업은 크게 세 단계로 진행됐다.

1. circom 회로 컴파일 + trusted setup
2. TypeScript 코드 교체 (prover.ts 작성, identity.manager.ts 교체)
3. UserInfo.ts 머클 트리 데이터 재계산

---

## 단계 1: circom 회로 컴파일

### 문제 1-1: circom 버전 불일치

**증상**
```
Parse error on line 1: pragma circom 2.0.0;
```

**원인**
npm global로 설치된 `circom`은 구버전(0.5.46, v1).
회로는 `pragma circom 2.0.0`을 선언하는데 v1 파서는 이 문법을 모름.
circom v2는 npm 패키지가 아니라 Rust 바이너리로 배포됨.

**해결**
Rust(rustup)로 circom v2 소스를 직접 빌드:
```bash
git clone https://github.com/iden3/circom.git circom_src
cd circom_src
cargo build --release
# 바이너리: circom_src/target/release/circom.exe
```
이후 컴파일 시 npm circom 대신 이 바이너리를 직접 지정해서 사용.

---

### 문제 1-2: circomlib 미설치

**증상**
```
error[P1014]: The file node_modules/circomlib/circuits/poseidon.circom to be included has not been found
```

**원인**
`package.json`에 `circomlibjs`(JS 버전)와 `circom_runtime`은 있었지만,
`.circom` 파일을 포함하는 `circomlib`(회로 라이브러리)는 없었음.

**해결**
```bash
npm install circomlib
```

---

### 문제 1-3: `-l` include 경로 플래그 사용법

**증상**
circomlib 설치 후에도 같은 "파일을 찾을 수 없음" 에러 반복.

**원인**
`-l node_modules`로 지정하면 circom이 `node_modules/`를 include root로 인식해서
회로의 `node_modules/circomlib/...` 경로를 `node_modules/node_modules/circomlib/...`에서 탐색함.
회로 파일의 include 경로 자체가 `node_modules/circomlib/...` 형태이므로
include root는 프로젝트 루트(`.`)여야 함.

**해결**
```bash
circom circuits/face-verification.circom --r1cs --wasm --sym -o build/ -l .
```

---

## 단계 2: TypeScript 코드 교체

### 작성/수정한 파일

| 파일 | 작업 |
|------|------|
| `src/lib/zkp/circom/prover.ts` | 신규 작성. snarkjs `groth16.fullProve()` 래퍼 |
| `src/lib/zkp/identity.manager.ts` | o1js 전부 제거, snarkjs prover 연결 |
| `src/lib/zkp/types.ts` | `ServerProofPayload`의 faceZkProof 타입을 groth16 형식으로 교체 |

### 문제 2-1: pathElements 인덱스 오류

**증상**
브라우저 실행 후:
```
ERROR: 4 Error in template FaceVerification_152 line: 192
```
line 192는 회로의 `currentHash[levels] === root` — 머클 루트 불일치.

**원인**
`UserInfo.ts`의 `pathElements`는 3개짜리 배열인데 구조가 이렇다:
```
pathElements[0] = 리프 레벨 형제 노드       ← 회로에 필요
pathElements[1] = 부모 노드 자신 (참고용)   ← 회로에 불필요
pathElements[2] = 루트 레벨 형제 노드       ← 회로에 필요
```

처음에 `[0]`과 `[1]`을 회로에 넣었는데,
`[1]`은 "내가 만들어낸 부모 노드"라 당연히 루트가 안 맞음.

**해결**
```ts
// 수정 전
const circomPathElements = [pathElements[0], pathElements[1]];

// 수정 후
const circomPathElements = [pathElements[0], pathElements[2]];
```

---

## 단계 3: UserInfo.ts 머클 트리 데이터 재계산

### 문제 3-1: Poseidon 구현체 불일치 (핵심 문제)

**증상**
pathElements 인덱스를 고친 후에도 같은 line 192 에러 반복.

**원인**
`UserInfo.ts`의 머클 트리(root, internal node 해시)가 **o1js의 Poseidon**으로 만들어져 있었음.
그런데 회로는 **circomlib의 Poseidon**을 사용.

이 둘은 완전히 다른 구현이다:

| | o1js Poseidon | circomlib Poseidon |
|---|---|---|
| 타깃 곡선 | Pasta (Pallas/Vesta) | BN128 (alt_bn128) |
| 필드 크기 | ~255비트 (Mina Protocol) | ~254비트 (Ethereum) |
| 라운드 상수 | 다름 | 다름 |
| 같은 입력 → 출력 | 대부분 다름 | 대부분 다름 |

따라서 o1js로 만든 내부 노드 해시와 root를 회로에서 검증하면 절대 일치하지 않음.

흥미롭게도 **리프 해시(featureHash)는 두 구현이 우연히 같은 값**이 나왔는데,
내부 노드(2개 해시를 합칠 때)부터 달라지기 시작했다.

**해결**
`scripts/rebuild-merkle.mjs` 스크립트를 작성해서
`circomlibjs`(circomlib과 동일한 BN128 Poseidon)로 전체 트리를 재계산:

```bash
node scripts/rebuild-merkle.mjs
```

재계산 결과 (변경된 값):
```
# 기존 root (o1js 기반)
4041534543159854687984238186366163703328051953185635023444461187988033966095

# 새 root (circomlib 기반)
8084332926463310671314126536261206652787176814375728514045642604635732139957
```

내부 노드도 전부 새 값으로 교체. `UserInfo.ts` 업데이트 완료.

---

## 교훈

circom 생태계에는 같은 이름의 도구가 버전별/언어별로 여러 개 존재한다:

| 패키지 | 용도 |
|--------|------|
| `circom` (npm, 구버전) | v1 컴파일러. pragma 2.0.0 회로 컴파일 불가 |
| `circom` (Rust 바이너리) | v2 컴파일러. 이걸 써야 함 |
| `circomlib` (npm) | `.circom` 회로 파일 모음 (Poseidon, Comparators 등) |
| `circomlibjs` (npm) | circomlib의 JS 구현체. Poseidon 출력값은 circomlib과 동일 |
| `circom_runtime` (npm) | snarkjs가 내부적으로 사용하는 witness 계산 런타임 |

**Poseidon 구현체를 혼용하면 반드시 해시 불일치가 발생한다.**
머클 트리 데이터를 생성할 때와 회로에서 검증할 때 **동일한 Poseidon 구현**을 써야 한다.
이 프로젝트는 circomlib(BN128) 기준으로 통일했다.
