# circom으로 전환하는 이유

## 배경

기존 구현은 o1js(Mina Protocol) 라이브러리를 사용해 ZKP를 생성했다.
라이브러리가 추상화를 다 해주는 구조라 동작은 하지만, 실제로 어떤 제약 조건이
생성되는지 회로 레벨에서 제어할 수 없고 속도 문제도 있었다.

---

## 전환 이유 1: 속도

### o1js의 병목

o1js는 ZkProgram을 **브라우저 런타임에서 실시간으로 컴파일**한다.

```ts
// 이 줄이 첫 실행 시 30초~수분 걸림
const { verificationKey } = await FaceVerificationProgram.compile();
```

TypeScript로 작성한 회로를 R1CS로 변환하는 작업을 매 세션 첫 실행마다 수행한다.
모듈 레벨 캐시로 두 번째 이후는 스킵되지만, 첫 번째는 피할 수 없다.

### circom + snarkjs는 컴파일을 오프라인에서 미리 끝냄

```
[개발 시 1회] circom 컴파일 → .wasm + .zkey 생성 → public/circuits/에 배포
[브라우저]    .wasm + .zkey 로드 → snarkjs.groth16.fullProve() 바로 실행
```

브라우저에서 컴파일 단계 자체가 없다.

### 이 회로의 제약 수 추정

```
유클리드 거리 계산 (diff × 10, square × 10, 합산)  ≈    30개
LessThan(252) — 비트 분해                           ≈   252개
Poseidon(10)  — 리프 해시                           ≈  수백개
Poseidon(2) × 2 — 머클 2레벨                        ≈  수백개
─────────────────────────────────────────────────────────────
총합                                                ≈ 1,000~2,000개
```

Groth16은 회로가 작을수록 proof 생성이 빠르다. 이 크기에서는 **5~15초** 수준으로 예상.

### 증명 시스템 비교

| | o1js | circom + snarkjs |
|---|---|---|
| 증명 시스템 | Kimchi (Mina 자체 개발) | Groth16 (범용 최적화 구현) |
| 컴파일 위치 | 브라우저 런타임 | 오프라인 사전 컴파일 |
| 첫 실행 proof 생성 | 수십 초 이상 | 5~15초 예상 |
| 반복 실행 | compile() 캐시로 단축 | 동일하게 빠름 |

---

## 전환 이유 2: 직접 구현 학습

o1js는 ZkProgram 추상화 뒤에 실제 회로 구조를 숨긴다.
circom은 제약 조건(constraint)을 직접 작성하므로:

- 어떤 연산이 몇 개의 제약을 만드는지 눈에 보임
- 회로 최적화를 직접 제어 가능
- R1CS, witness, Groth16 proof의 실제 흐름을 이해할 수 있음

---

## 부수 효과: SharedArrayBuffer 헤더 제거 가능

o1js는 멀티스레딩을 위해 SharedArrayBuffer를 사용하므로 현재 vite.config.ts에
아래 헤더가 필요하다:

```ts
"Cross-Origin-Opener-Policy": "same-origin",
"Cross-Origin-Embedder-Policy": "require-corp",
```

이 헤더가 있으면 외부 CDN 리소스 로딩에 제약이 생긴다 (MediaPipe CDN 등).
snarkjs는 이 헤더 없이도 동작하므로 해당 제약이 사라진다.

---

## 주의사항

- `.zkey` 파일이 수십 MB일 수 있어 최초 다운로드 시간이 병목이 될 수 있음 → 브라우저 캐시로 해결
- Groth16은 trusted setup이 필요 (Powers of Tau 의식) → 프로덕션에선 공신력 있는 ceremony 사용 필요
- 실제 속도 수치는 벤치마크 전까지는 추정값
