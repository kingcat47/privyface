# 작업 인수인계 문서 — feat/circom-zkp

> 새 세션을 시작하는 Claude가 읽고 바로 이어서 작업할 수 있도록 작성된 문서.
> 코드를 직접 보기 전에 이 파일부터 읽을 것.

---

## 이 브랜치의 목적

기존에 o1js(Mina Protocol) 라이브러리로 구현된 ZKP 로직을
circom + snarkjs 조합으로 직접 구현하는 것.

왜 바꾸는지 → `md/feat-circom-zkp/why-circom.md` 참고
구조 결정 이유 → `md/feat-circom-zkp/structure-decision.md` 참고

---

## 전체 흐름 (현재 → 목표)

**현재 (o1js)**
```
웹캠 → MediaPipe → 10개 특징값 → o1js ZkProgram.proveMatch() → 서버
```

**목표 (circom + snarkjs)**
```
웹캠 → MediaPipe → 10개 특징값 → snarkjs.groth16.fullProve() → 서버
```

---

## 지금까지 완료된 작업

### 구조 정리
- 루트에 흩어져 있던 MD 파일들 → `md/` 폴더로 이동
- `main.circom` → `circom/circuits/face-verification.circom` 으로 이동 및 정리
- `src/lib/zkp/circom/` 폴더 생성 (snarkjs 코드가 들어갈 자리, 아직 비어있음)
- `.gitignore`에 circom 빌드 산출물 추가 (`*.sym`, `*.r1cs`, `*.wasm`, `*.zkey`, `*.ptau`)

### 회로 수정
`circom/circuits/face-verification.circom` 에서 수정한 것:
- **버그 수정**: leafHasher가 `userFeatures`를 해싱하고 있었으나 `governmentFeatures`로 교체
  (머클 트리는 정부 DB 특징값 해시로 구성되어 있기 때문)
- **포매팅**: 파일이 `\n` 리터럴이 포함된 한 줄짜리였음 → 정상적인 멀티라인으로 재작성
- **signal 선언 위치 수정**: circom 2.0은 루프 안에서 signal 선언 불가 → 배열로 밖에 선언
- **주석 추가**: circom 문법 설명 포함 (사용자가 circom을 처음 배우는 중)

---

## 다음에 해야 할 작업 (순서대로)

### Step 1: 회로 컴파일
```bash
cd circom
circom circuits/face-verification.circom --r1cs --wasm --sym -o build/
```
- `build/` 디렉토리 생성 후 실행
- 결과물: `face-verification.r1cs`, `face-verification.wasm`, `face-verification.sym`
- `.wasm`은 `public/circuits/`로 복사

### Step 2: Trusted Setup (Powers of Tau + zkey)
```bash
# Powers of Tau (회로 제약 수가 ~2000개 이하이므로 power=12면 충분)
snarkjs powersoftau new bn128 12 pot12_0000.ptau
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="contribution"
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau

# Circuit-specific setup
snarkjs groth16 setup build/face-verification.r1cs pot12_final.ptau circuit_0000.zkey
snarkjs zkey contribute circuit_0000.zkey circuit_final.zkey --name="final"
snarkjs zkey export verificationkey circuit_final.zkey public/circuits/verification_key.json
```
- `circuit_final.zkey` → `public/circuits/face-verification.zkey` 로 복사
- `.ptau`, `.zkey`는 gitignore 처리됨

### Step 3: `src/lib/zkp/circom/prover.ts` 작성
snarkjs로 proof를 생성하는 함수. 입력 형식:
```ts
const input = {
  governmentFeatures: number[10],  // 정부 DB 특징값
  userFeatures: number[10],         // 웹캠 특징값
  pathElements: string[2],          // 머클 경로 (BigInt 문자열)
  pathIndices: number[2],           // 0 or 1
  root: string,                     // 머클 루트 (BigInt 문자열)
  threshold: number,                // 유사도 임계값
};
```

### Step 4: `src/lib/zkp/identity.manager.ts` 교체
- `generateFaceZkProof()` 메서드에서 o1js 코드 제거
- `prover.ts`의 snarkjs 함수로 교체
- 기존 o1js 코드(`src/lib/zkp/circuits/`)는 삭제하지 말고 보존

### Step 5: `src/lib/zkp/types.ts` 확인 및 수정
o1js proof 형식과 snarkjs proof 형식이 다름. `ServerProofPayload` 타입 수정 필요.

---

## 핵심 파일 위치

| 파일 | 역할 |
|------|------|
| `circom/circuits/face-verification.circom` | ZK 회로 소스 |
| `src/lib/zkp/circom/` | snarkjs prover 코드 (미작성) |
| `src/lib/zkp/circuits/face-verification-program.ts` | 기존 o1js 코드 (보존) |
| `src/lib/zkp/identity.manager.ts` | 최종 교체 대상 |
| `src/lib/zkp/types.ts` | ServerProofPayload 타입 |
| `src/government/UserInfo.ts` | 정부 DB 목 데이터 (4명) |
| `public/circuits/` | 컴파일된 .wasm, .zkey 배치 위치 |

---

## 환경 정보

- circom: 0.5.46 설치됨 (npm global)
- snarkjs: 0.7.5 (package.json 의존성 포함)
- circomlib: `node_modules/circomlib/circuits/` 에 있음

---

## 사용자 관련 참고사항

- circom 문법을 모름 → 코드 작성 시 문법 설명 주석을 항상 포함할 것
- 익숙해지면 본인이 주석을 직접 삭제한다고 했음
- 한국어로 소통
