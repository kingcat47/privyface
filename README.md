# PrivyFace

얼굴 인식과 영지식 증명(Zero-Knowledge Proof)을 결합한 프라이버시 보호 신원 인증 시스템입니다.

실제 얼굴 데이터를 노출하지 않고도 **"내가 정부 DB에 등록된 사람임"** 을 수학적으로 증명할 수 있습니다.

---

## 핵심 아이디어

기존 얼굴 인식은 서버에 얼굴 데이터를 전송해야 합니다. PrivyFace는 다릅니다.

- 얼굴 특징값은 디바이스 안에서만 처리 (Private Input)
- 서버에는 수학적 증명(proof)과 공개 신호값만 전송
- circom 회로 + groth16을 통해 서버가 직접 데이터를 보지 않고도 검증 가능

---

## 동작 흐름

```
1. 유저 선택 (홈 화면)
        ↓
2. 웹캠으로 60프레임 수집 (MediaPipe)
        ↓
3. 468개 얼굴 랜드마크에서 10가지 기하학적 특징 추출
   (코 길이, 입 너비, 눈썹 간격 등 — 눈 사이 거리로 정규화 후 × 10000 정수화)
        ↓
4. circom 회로 + snarkjs로 groth16 Proof 생성 (브라우저 내부)
   - Private Input: 실시간 특징값, 정부 DB 특징값, 머클 경로
   - Public Input: 머클 루트, 유사도 임계값
   - 회로가 증명하는 것: sum((govFeature[i] - userFeature[i])²) ≤ threshold
        ↓
5. Merkle Proof + Face ZK Proof를 백엔드로 전송
        ↓
6. 백엔드에서 Merkle 검증 + groth16.verify() 수행 후 신원 인증 완료
```

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | React 19, TypeScript, Vite |
| 얼굴 인식 | MediaPipe Tasks Vision |
| ZKP 회로 | circom 2.x + snarkjs 0.7.5 (groth16, BN128) |
| 해시 | Poseidon Hash (circomlibjs) |
| 백엔드 | NestJS (localhost:3000) |
| 스타일 | SCSS Modules |

---

## 프로젝트 구조

```
privyface_web/          # 이 레포 (프론트엔드)
├── public/circuits/
│   ├── face-verification.wasm   # circom 컴파일 산출물
│   └── face-verification.zkey   # trusted setup 키
├── src/
│   ├── pages/
│   │   ├── Home/                # 유저 목록
│   │   └── FaceScan/            # 스캔 + Proof 생성
│   ├── components/face-scan/
│   │   ├── VideoStream/         # 웹캠 + MediaPipe
│   │   ├── ScanProgress/        # 진행 상황 표시
│   │   └── FeatureDisplay/      # 추출된 특징값 표시
│   ├── lib/
│   │   ├── mediapipe/           # 얼굴 감지기
│   │   ├── face-features/       # 특징 추출 / 정규화 / 스케일링
│   │   └── zkp/
│   │       ├── circom/
│   │       │   └── prover.ts    # snarkjs.groth16.fullProve() 호출
│   │       ├── identity.manager.ts
│   │       ├── config.ts        # threshold 설정 (현재 800,000)
│   │       └── types.ts
│   └── government/
│       └── UserInfo.ts          # 정부 DB 시뮬레이션 (features, featureHash, merkleProof)
```

---

## 관련 레포

| 레포 | 역할 |
|------|------|
| `privyface_web` (이 레포) | 프론트엔드: 얼굴 스캔 + proof 생성 |
| `zkpj` | 백엔드: groth16.verify() + Merkle 검증 (NestJS) |
| `ogui` | 어드민: 웹캠으로 얼굴 등록 → UserInfo.ts + .env 값 생성 |

---

## 실행 방법

### 1. 프론트엔드

```bash
cd privyface_web
npm install
npm run dev
```

### 2. 백엔드

```bash
cd zkpj
npm install
npm run start:dev
```

`.env`에 다음 값이 필요합니다:

```env
MERKLE_ROOT=<circomlibjs Poseidon 머클 루트값>
```

### 3. 유저 등록 (ogui)

DB에 새 유저를 등록하거나 기존 유저를 재등록할 때 사용합니다.

```bash
cd ogui
npm install
npm run web    # localhost:5173
```

스캔 완료 후 출력되는 값을 아래에 반영합니다:
- `MERKLE_ROOT` → `zkpj/.env`
- 전체 `governmentDB` → `privyface_web/src/government/UserInfo.ts`

---

## Proof 검증 구조

서버(`POST /api/verify-identity`)가 받는 payload:

```json
{
  "merkleProof": {
    "leafHash": "...",
    "siblings": ["...", "..."],
    "isLeft": [true, false]
  },
  "faceZkProof": {
    "proof": "{ pi_a, pi_b, pi_c, ... }",
    "publicSignals": ["<merkleRoot>", "<threshold>"]
  }
}
```

서버 검증 순서:
1. `merkleProof`를 Poseidon 해시로 재계산 → `.env`의 `MERKLE_ROOT`와 비교
2. `publicSignals[0]` (root) 및 `publicSignals[1]` (threshold) 서버 기대값과 비교
3. `snarkjs.groth16.verify(verificationKey, publicSignals, proof)` 실행
