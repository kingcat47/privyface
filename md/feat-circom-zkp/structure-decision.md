# feat/circom-zkp 브랜치 구조 결정 문서

## 배경

기존에 o1js(Mina Protocol) 라이브러리로 구현되어 있던 ZKP 로직을
circom + snarkjs 조합으로 직접 구현하기 위한 브랜치.

기존 코드를 유지하면서 circom 구현을 병렬로 개발하고,
최종적으로 `identity.manager.ts` 하나만 교체하는 전략을 채택.

---

## 폴더 구조 결정

### `circom/`

```
circom/
├── circuits/
│   └── face-verification.circom
└── scripts/
    ├── compile.sh
    └── setup.sh
```

**이유:**
- circom 회로 파일은 런타임 JS/TS 코드가 아니라 오프라인 컴파일 작업물
- `src/`는 브라우저/Node에서 실행되는 코드만, `circom/`은 회로 정의와 빌드 파이프라인
- 컴파일 스크립트(compile.sh), trusted setup(setup.sh)도 같은 맥락의 작업이라 함께 묶음
- 나중에 회로를 수정하거나 키를 재생성할 때 `circom/` 하나만 보면 됨

**컴파일 결과물은 `public/circuits/`에 배치:**
- `.wasm`, `.zkey`는 브라우저가 fetch로 다운로드해야 하므로 public 디렉토리 필수
- 이 파일들은 수십 MB에 달할 수 있어 gitignore 처리 (빌드 산출물)
- `verification_key.json`은 작고 공개해도 되므로 커밋 가능

---

### `src/lib/zkp/circom/`

```
src/lib/zkp/
├── circom/
│   └── prover.ts       ← 신규: snarkjs 기반 proof 생성
├── circuits/
│   └── face-verification-program.ts  ← 기존 o1js (보존)
├── identity.manager.ts ← 최종 교체 대상
├── config.ts
└── types.ts
```

**이유:**
- 기존 o1js 코드(`circuits/face-verification-program.ts`)를 건드리지 않고
  circom 구현을 `circom/` 서브폴더에 병렬 개발
- 롤백이 필요하면 `identity.manager.ts`만 되돌리면 됨
- `prover.ts` 하나에 snarkjs 의존성을 집중시켜 교체 범위를 최소화

---

### `md/`

```
md/
├── feat-circom-zkp/       ← 이 브랜치 관련 문서
│   └── structure-decision.md
└── (기존 문서들)
```

**이유:**
- 기존 MD 파일들이 루트에 산발적으로 흩어져 있어 정리
- 브랜치별 의사결정 기록을 남겨두기 위한 구조
- 소스코드와 문서를 명확히 분리

---

## 핵심 설계 원칙

1. **기존 o1js 코드 보존** - 비교 및 롤백을 위해 삭제하지 않음
2. **교체 지점 최소화** - `identity.manager.ts` 한 파일만 최종 교체
3. **컴파일 산출물 gitignore** - `.wasm`, `.zkey`, `.r1cs`, `.sym` 은 빌드 후 생성
4. **회로와 앱 코드 분리** - `circom/`과 `src/`는 역할이 다른 레이어

---

## main.circom 버그 수정 내역

기존 `main.circom`에서 merkle leaf를 `userFeatures`로 해싱하고 있었으나,
머클 트리는 `governmentFeatures` 해시로 구성되어 있어 검증이 불가능했음.

```circom
// 수정 전 (버그)
leafHasher.inputs[i] <== userFeatures[i];

// 수정 후
leafHasher.inputs[i] <== governmentFeatures[i];
```
