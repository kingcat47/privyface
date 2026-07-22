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

## 현재 상태 요약 (2026-07-12 기준)

**circom 마이그레이션은 완료됐다.** proof 생성 → 백엔드 전송 → 백엔드 검증까지 전부 작동함.

**단, 현재 실제 인증은 실패한다.** 이유: 등록과 검증의 feature 추출 파이프라인이 달라서
intra-class 거리(같은 사람)가 inter-class 거리(다른 사람)보다 커버렸음.
threshold 조정으로는 해결 불가. 아래 "남은 문제" 섹션 참고.

**ogui에 웹 기반 얼굴 등록 페이지가 추가됐다.** (`ogui/web/`) → 아래 참고.

---

## 완료된 작업 전체 목록

### Phase 1 — 구조 정리 (초기)
- 루트에 흩어져 있던 MD 파일들 → `md/` 폴더로 이동
- `main.circom` → `circom/circuits/face-verification.circom` 으로 이동 및 정리
- `src/lib/zkp/circom/` 폴더 생성
- `.gitignore`에 circom 빌드 산출물 추가

### Phase 2 — 회로 수정
`circom/circuits/face-verification.circom`:
- **버그 수정**: leafHasher가 `userFeatures`를 해싱하고 있었으나 `governmentFeatures`로 교체
- **포매팅**: `\n` 리터럴 포함된 한 줄짜리 → 정상 멀티라인으로 재작성
- **signal 선언 위치 수정**: circom 2.0은 루프 안에서 signal 선언 불가 → 배열로 밖에 선언
- **주석 추가**: circom 문법 설명 포함

### Phase 3 — 빌드 파이프라인
- circom 2.x 소스 빌드 (`cargo build --release`) — npm global circom은 v1이라 안 됨
- 회로 컴파일: `face-verification.wasm`, `.r1cs`, `.sym` 생성
- Trusted Setup: Powers of Tau + zkey 생성
- 빌드 산출물 → `public/circuits/` 에 배치
- 상세 내용 → `md/feat-circom-zkp/build-troubleshooting.md`

### Phase 4 — 프론트엔드 교체
- `src/lib/zkp/circom/prover.ts` 작성 (snarkjs.groth16.fullProve 기반)
  - 거리 측정 로그 포함: `console.log("[prover] 실제 제곱거리:", squaredDist)`
- `src/lib/zkp/identity.manager.ts` 교체 (o1js 완전 제거)
  - `circomPathElements = [pathElements[0], pathElements[2]]` — pathElements[1]은 부모노드로 circom에 불필요
- `src/lib/zkp/types.ts` 수정 — proof: string, publicSignals: string[], verificationKey: object
- 상세 내용 → `md/feat-circom-zkp/o1js-to-snarkjs-migration.md`

### Phase 5 — 백엔드 교체 (`C:\Users\leetaegyeom\Desktop\zkpj`)
- `zkpj/src/zkp/zkp-verification.service.ts`: o1js → snarkjs + circomlibjs
- `zkpj/src/zkp/dto/verify-identity.dto.ts`: `publicInput` → `publicSignals`, verificationKey 타입 변경
- `zkpj/.env`: MERKLE_ROOT 업데이트 (circomlibjs 기준 새 루트)
- 상세 내용 → `md/feat-circom-zkp/backend-migration.md`

### Phase 6 — ogui 도구 교체 (`C:\Users\leetaegyeom\Desktop\ogui`)
- `poseidon_hash.js`: o1js → circomlibjs (BN128 곡선 맞춤)
- `merkle_tree.ts`: o1js → circomlibjs, main() async화
- `package.json`: `--transpile-only` 플래그 추가
- `UserInfo.ts` 머클 루트/내부노드 업데이트 (circomlibjs 기준 재계산)
- 상세 내용 → `ogui/MIGRATION.md`

### Phase 7 — Threshold 분석
- 원인 분석: threshold 3,000,000이 너무 커서 다른 사람도 통과됨
- 800,000으로 변경 (`src/lib/zkp/config.ts`)
- 실측 결과: intra-class 거리(같은 사람 웹캠 vs 저장 사진) = **5,933,182** → threshold 조정으로 해결 불가
- 상세 분석 → `md/feat-circom-zkp/threshold-analysis.md`

### Phase 8 — ogui 웹 등록 페이지 추가 (2026-07-12)

**배경**: 등록(Python face_analysis.py)과 검증(브라우저 MediaPipe) 파이프라인이 달라서
feature 값이 서로 달라지는 근본 문제를 해결하기 위해,
ogui(정부 DB 관리 도구)에 브라우저 MediaPipe 기반 웹 등록 페이지를 추가함.

**추가된 파일** (`C:\Users\leetaegyeom\Desktop\ogui`):
```
ogui/
  web/
    index.html
    main.tsx
    App.tsx           ← 메인 등록 로직 (웹캠 스캔 → 해시 → 머클 트리 → 출력)
    App.css
    lib/
      types.ts        ← 타입 정의 (privyface_web에서 복사)
      calculator.ts   ← 랜드마크 거리 계산
      extractor.ts    ← 10개 feature 추출 + 스케일링 + 중앙값
      face-detector.ts ← MediaPipe FaceLandmarker 래퍼
      poseidon.ts     ← circomlibjs BN128 Poseidon 해시
      merkle-builder.ts ← 4-leaf 머클 트리 빌더
  vite.config.ts
  tsconfig.web.json
```

**실행 방법**:
```bash
cd C:\Users\leetaegyeom\Desktop\ogui
npm install   # 처음 한 번만
npm run web   # localhost:5173 열림
```

**등록 플로우**:
1. 유저 선택 (user_ceu / user_ltg / user_kwy / user_hyc)
2. 웹캠으로 60프레임 스캔 (중앙값으로 feature 계산)
3. Poseidon(BN128)으로 featureHash 계산
4. 4-leaf 머클 트리 재계산
5. 3개 출력 블록 복사:
   - `MERKLE_ROOT=...` → `zkpj/.env`
   - 해당 유저 features + featureHash → 참고용
   - 전체 `governmentDB` 배열 → `privyface_web/src/government/UserInfo.ts` 교체

**중요**: `ogui/web/App.tsx` 상단의 `CURRENT_DB` 상수가
다른 유저들의 현재 featureHash를 담고 있음.
한 명 재등록 후 나머지 3명의 featureHash도 바뀌었으면 이 값도 업데이트해야 함.

**privyface_web에서 제거된 것**:
- `src/pages/Register/` 폴더 전체 (역할이 ogui로 이동)
- `src/lib/zkp/circom/poseidon.ts`
- `src/lib/zkp/circom/merkle-builder.ts`
- `VideoStream`의 `overlayChildren` prop은 유지 (선택적 prop, 기존 동작 무영향)

---

## 남은 문제 — 핵심 이슈

### 문제: intra-class 거리 > inter-class 거리

`prover.ts`에 거리 로그를 추가해 실측한 결과:

```
[prover] 실제 제곱거리: 5,933,182   ← 같은 사람 (웹캠 vs 저장 사진)
inter-class 최솟값: ~620,000        ← 다른 사람들 간 거리
```

같은 사람이 타인보다 9배 "다르게" 나온다. **threshold를 어떻게 잡아도 해결 불가.**

### 원인: 파이프라인 불일치

| 단계 | 파이프라인 |
|------|-----------|
| 등록 (정부 DB) | `face_analysis.py` → 정적 이미지 → Python |
| 검증 (실시간) | 브라우저 MediaPipe → 웹캠 영상 |

같은 알고리즘이어도 해상도/조명/스케일 차이로 feature 값이 크게 달라짐.

### 왜 예전 o1js 시연은 됐냐
- o1js 회로는 distance > threshold여도 proof 생성이 실패하지 않음
- 그냥 `publicInput = 0` (실패 상태)으로 proof를 만들고, 백엔드가 거부하는 구조
- 시연 당시엔 조건이 우연히 맞아서 거리가 3,000,000 이하였던 것
- circom은 threshold 초과 시 proof 자체를 못 만듦 (하드 컨스트레인트)

---

## 다음에 해야 할 작업

> **ogui 웹 등록 페이지는 완성됐다. 이제 실제 등록을 진행하면 된다.**

### Step 1 — 4명 전원 ogui 웹으로 재등록 ← **지금 당장 해야 할 것**

```bash
cd C:\Users\leetaegyeom\Desktop\ogui
npm run web   # localhost:5173
```

각 유저(user_ceu, user_ltg, user_kwy, user_hyc)를 차례로 선택해서 웹캠으로 스캔.
스캔 후 나오는 출력값을 아래 두 파일에 반영:

1. **"전체 governmentDB 교체용" 블록** 복사
   → `privyface_web/src/government/UserInfo.ts`의 `governmentDB` 배열 전체 교체

2. **"새 MERKLE_ROOT" 블록** 복사
   → `zkpj/.env`의 `MERKLE_ROOT=...` 값 교체

> **주의**: 한 명 등록할 때마다 머클 루트가 바뀐다.
> 4명 전부 등록하고 나서의 최종 값을 UserInfo.ts와 .env에 반영할 것.
> (중간값으로 교체했다가 다시 바뀌면 귀찮아짐)

### Step 2 — `ogui/web/App.tsx`의 CURRENT_DB 업데이트

4명 재등록이 끝나면 `ogui/web/App.tsx` 상단의 `CURRENT_DB` 상수를
새로 등록된 featureHash 값들로 교체.
(다음에 또 누군가를 재등록할 때 기준이 되는 값)

```ts
// ogui/web/App.tsx 상단
const CURRENT_DB = [
  { userName: "user_ceu", features: [...새값...], featureHash: "...새값..." },
  // ...
];
```

### Step 3 — Threshold 재보정

재등록 후 privyface_web에서 실제 인증 시도.
F12 콘솔에서 `[prover] 실제 제곱거리:` 로그 확인.

- 같은 사람 여러 번 → intra-class 거리 분포 측정
- 다른 사람으로 시도 → inter-class 거리 확인
- 두 값 사이의 중간값으로 threshold 설정
- `privyface_web/src/lib/zkp/config.ts`의 `DEFAULT_SIMILARITY_THRESHOLD` 업데이트

현재 값: 800,000 (파이프라인 불일치 상태에서 측정된 값이므로 재등록 후 재측정 필수)

---

## 핵심 파일 위치

| 파일 | 역할 | 상태 |
|------|------|------|
| `circom/circuits/face-verification.circom` | ZK 회로 소스 | 완료 |
| `public/circuits/face-verification.wasm` | 컴파일된 회로 | 완료 |
| `public/circuits/face-verification.zkey` | proving key | 완료 |
| `public/circuits/verification_key.json` | 검증 키 | 완료 |
| `src/lib/zkp/circom/prover.ts` | snarkjs proof 생성 | 완료 |
| `src/lib/zkp/identity.manager.ts` | ZKP 오케스트레이터 | 완료 |
| `src/lib/zkp/config.ts` | threshold 설정 | 완료 (800,000) |
| `src/lib/zkp/types.ts` | proof 타입 정의 | 완료 |
| `src/government/UserInfo.ts` | 정부 DB 목 데이터 | **재등록 필요** |
| `src/pages/FaceScan/index.tsx` | 얼굴 인식 페이지 | 가이드 오버레이 추가 필요 |
| `C:\...\zkpj\src\zkp\zkp-verification.service.ts` | 백엔드 검증 | 완료 |
| `C:\...\ogui\merkle_tree.ts` | 머클 트리 재계산 도구 | 완료 |

---

## 환경 정보

- circom: 소스에서 직접 빌드 (`circom_src/target/release/circom`)
  - npm global circom은 v1(0.5.46)이라 circom 2.0 문법 파싱 불가 → 절대 사용하지 말 것
- snarkjs: 0.7.5
- circomlib: `node_modules/circomlib/circuits/`
- circomlibjs: `node_modules/circomlibjs/` (JS에서 Poseidon 해시용)

---

## 사용자 관련 참고사항

- circom 문법을 모름 → 코드 작성 시 문법 설명 주석을 항상 포함할 것
- 익숙해지면 본인이 주석을 직접 삭제한다고 했음
- 한국어로 소통
