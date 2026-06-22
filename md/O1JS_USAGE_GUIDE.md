# o1js 사용 가이드

## o1js vs Circom 비교

### Circom 방식 (기존)

```
1. .circom 파일 작성
2. circom 명령어로 컴파일 → main.wasm, main.r1cs 생성
3. snarkjs로 Trusted Setup → main_0001.zkey 생성
4. snarkjs.groth16.fullProve()로 Proof 생성
```

### o1js 방식 (새로운)

```
1. TypeScript로 zkProgram 작성
2. zkProgram.compile() 한 번만 실행 (자동 캐싱)
3. zkProgram.verify()로 직접 Proof 생성
4. WASM/ZKEY 파일 불필요!
```

## 핵심 차이점

| 항목          | Circom                      | o1js                      |
| ------------- | --------------------------- | ------------------------- |
| 파일 형식     | .circom                     | .ts                       |
| 컴파일 결과물 | WASM, R1CS, ZKEY            | 캐시된 컴파일 결과 (자동) |
| Trusted Setup | 필요                        | 불필요 (자동 처리)        |
| Proof 생성    | snarkjs.groth16.fullProve() | zkProgram.verify()        |
| 파일 관리     | 수동 관리 필요              | 자동 관리                 |

## o1js 사용 단계

### 1단계: zkProgram 작성

```typescript
// src/lib/zkp/circuits/face-verification-program.ts
export const FaceVerificationProgram = ZkProgram({
  name: "FaceVerification",
  publicInput: Field, // root
  methods: {
    verify: {
      privateInputs: [FaceFeatures, MerklePath],
      method(
        root: Field,
        features: FaceFeatures,
        merklePath: MerklePath
      ): Bool {
        // 검증 로직
      },
    },
  },
});
```

### 2단계: 컴파일 (한 번만, 자동 캐싱)

```typescript
// 첫 실행 시에만 컴파일 (약간의 시간 소요)
// 이후에는 캐시된 결과 사용 (빠름)
const { verificationKey } = await FaceVerificationProgram.compile();
```

### 3단계: Proof 생성

```typescript
// Private Inputs 준비
const features = new FaceFeatures({
  governmentFeatures: [Field(418), Field(5951), ...],
  userFeatures: [Field(418), Field(5951), ...],
  threshold: Field(5000),
});

const merklePath = new MerklePath({
  pathElements: [Field("..."), Field("...")],
  pathIndices: [Field(0), Field(0)],
  root: Field("..."),
});

// Public Input
const root = Field("...");

// Proof 생성
const proof = await FaceVerificationProgram.verify(
  root,
  features,
  merklePath
);
```

### 4단계: Proof 검증

```typescript
const isValid = await FaceVerificationProgram.verify(proof);
```

## 컴파일 과정

**중요**: o1js는 **첫 실행 시에만 컴파일**합니다.

1. `zkProgram.compile()` 호출
2. o1js가 내부적으로 회로를 컴파일
3. 결과를 캐시 디렉토리에 저장 (보통 `.cache` 폴더)
4. 다음 실행부터는 캐시 사용 (빠름)

**캐시 위치**: 프로젝트 루트의 `.cache` 폴더 (자동 생성)

## 장점

1. **간편함**: WASM/ZKEY 파일 관리 불필요
2. **자동화**: 컴파일과 캐싱 자동 처리
3. **TypeScript 통합**: 같은 언어로 회로와 앱 코드 작성
4. **최신 기술**: 최신 ZK 프레임워크 활용

## 주의사항

- 첫 컴파일은 시간이 걸릴 수 있음 (복잡한 회로의 경우)
- 캐시를 삭제하면 다시 컴파일됨
- 브라우저에서는 컴파일이 느릴 수 있으므로, Node.js 환경에서 컴파일 후 사용 권장
