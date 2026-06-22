# Proof 구조 및 검증 과정 상세 설명

## Proof에 들어있는 정보

### 직접적으로 들어있지 않은 것

Proof 문자열 자체에는 다음이 **직접적으로** 들어있지 않습니다:
- "머클 트리 인증"이라는 텍스트
- "원본값 해시"라는 텍스트  
- "얼굴 유사도"라는 텍스트

### 실제로 들어있는 것

Proof는 **모든 조건이 만족되었다는 수학적 증명**입니다:

1. **타원곡선 위의 점들** (pi_a, pi_b, pi_c)
   - 모든 제약 조건이 만족되었음을 증명하는 수학적 좌표
   - 직접적인 데이터가 아닌, 계산 결과의 암호학적 표현

2. **Public Input** (공개 입력값)
   - 머클 루트 (root): `publicInput[0]`
   - 이 값은 공개되어 있어서 Proof와 함께 전송됩니다

3. **Private Input** (비공개 입력값 - Proof 안에 숨겨짐)
   - 정부 DB 특징값 (원본값): `governmentFeatures[10]`
   - 카메라 특징값: `userFeatures[10]`
   - 머클 경로: `pathElements[2]`, `pathIndices[2]`
   - 임계값: `threshold`
   - 이 값들은 Proof 생성에 사용되지만, Proof 자체에는 직접 보이지 않습니다

## Proof 생성 과정 (3가지 검증이 어떻게 결합되는지)

### 1단계: 얼굴 유사도 검증

```typescript
// face-verification-program.ts의 prove 메서드

// 1. 유사도 검증 (카메라 특징값 vs 정부 DB 특징값)
const isSimilar = features.isSimilar();

// isSimilar() 내부:
// - 유클리드 거리 계산: sum((governmentFeatures[i] - userFeatures[i])^2)
// - 임계값과 비교: distance <= threshold
```

**검증 내용:**
- 정부 DB 특징값과 카메라 특징값의 차이를 계산
- 제곱합이 임계값 이하인지 확인
- 조건 불만족 시 Proof 생성 실패

### 2단계: 원본값 해시 계산

```typescript
// 2. 정부 DB 특징값을 Poseidon 해시로 변환 (Leaf)
const leaf = Poseidon.hash(features.governmentFeatures);
```

**검증 내용:**
- 정부 DB 특징값을 Poseidon 해시로 변환
- 이 해시값이 머클 트리의 리프 노드(leaf)가 됨
- 해시는 원본값을 대표하는 고유한 값

### 3단계: 머클 트리 멤버십 검증

```typescript
// 3. 머클 패스를 따라 루트 계산
const computedRoot = merklePath.computeRoot(leaf);

// 4. 계산된 루트가 제공된 루트와 일치하는지 확인
const rootMatches = computedRoot.equals(root);
```

**검증 내용:**
- 리프 노드(해시값)에서 시작하여 머클 경로를 따라 루트 계산
- 계산된 루트가 제공된 루트와 일치하는지 확인
- 일치하면 정부 DB 특징값이 머클 트리에 포함되어 있음을 증명

### 4단계: 모든 조건 통합 (Proof 생성)

```typescript
// 5. 두 조건 모두 만족해야 Proof 생성 가능
isSimilar.assertTrue("얼굴 유사도가 임계값을 초과했습니다");
rootMatches.assertTrue("머클 루트가 일치하지 않습니다");
```

**통합 과정:**
1. **제약 조건 생성**: 각 `assertTrue()`는 하나의 제약 조건(constraint)을 생성
2. **다항식 변환**: 모든 제약 조건이 다항식으로 변환됨
3. **타원곡선 변환**: 다항식이 타원곡선 위의 점들로 변환됨
4. **Proof 생성**: 타원곡선 점들의 조합이 Proof가 됨

## Proof 구조 시각화

```
Proof 생성 과정:

입력 데이터:
├─ Public Input (공개)
│  └─ 머클 루트 (root)
│
└─ Private Input (비공개, Proof 안에 숨겨짐)
   ├─ 정부 DB 특징값 (governmentFeatures)
   ├─ 카메라 특징값 (userFeatures)
   ├─ 머클 경로 (pathElements, pathIndices)
   └─ 임계값 (threshold)

↓ 회로 실행 (face-verification-program.ts)

제약 조건 검증:
├─ 제약 1: 얼굴 유사도 검증
│  └─ 유클리드 거리 <= 임계값
│
└─ 제약 2: 머클 트리 멤버십 검증
   └─ 계산된 루트 == 제공된 루트

↓ 모든 제약 조건이 만족되면

다항식 변환:
└─ 모든 제약 조건 → 다항식 표현

↓ 타원곡선 암호학 변환

Proof 생성:
└─ 다항식 → 타원곡선 위의 점들 (pi_a, pi_b, pi_c)

최종 Proof:
└─ base64 인코딩된 문자열 (수천 자)
   - 타원곡선 점들의 암호학적 표현
   - 모든 조건이 만족되었음을 증명
   - Private Input은 직접 보이지 않음
```

## 핵심 개념

### 1. Proof는 "증명"이지 "데이터"가 아님

- Proof는 "나는 이 조건들을 만족하는 Private Input을 알고 있다"는 증명
- 실제 Private Input 값은 Proof 안에 직접 보이지 않음
- 타원곡선 암호학을 통해 증명만 제공

### 2. 3가지 검증이 하나의 Proof로 통합됨

```
얼굴 유사도 검증
    ↓
원본값 해시 계산
    ↓
머클 트리 멤버십 검증
    ↓
모든 제약 조건 → 다항식 → 타원곡선 점들 → Proof
```

### 3. Public vs Private

**Public Input (공개):**
- 머클 루트: 서버가 알고 있는 값
- Proof와 함께 전송됨

**Private Input (비공개):**
- 정부 DB 특징값: Proof 안에 숨겨짐
- 카메라 특징값: Proof 안에 숨겨짐
- 머클 경로: Proof 안에 숨겨짐
- 임계값: Proof 안에 숨겨짐

## 실제 검증 흐름

### 클라이언트 (Proof 생성)

1. 카메라에서 특징값 추출
2. 정부 DB 특징값과 비교 (유사도 계산)
3. 정부 DB 특징값을 Poseidon 해시
4. 머클 경로로 루트 계산
5. 모든 조건 만족 시 Proof 생성

### 서버 (Proof 검증)

1. Proof와 Public Input(머클 루트) 받음
2. verificationKey로 Proof 검증
3. 검증 성공 = 모든 조건이 만족되었음을 증명
4. Private Input은 모르지만, 조건이 만족되었음을 확인

## 정리

**질문: Proof에 3가지 정보가 들어있나요?**

**답변:**
- 직접적으로는 들어있지 않습니다
- 간접적으로는 모두 포함됩니다:
  1. **얼굴 유사도**: 제약 조건으로 포함 (유클리드 거리 <= 임계값)
  2. **원본값 해시**: Poseidon 해시 계산 과정이 포함
  3. **머클 트리 인증**: 머클 경로 계산 과정이 포함

**질문: 어떻게 섞이나요?**

**답변:**
1. 각 검증이 **제약 조건(constraint)**으로 변환됨
2. 모든 제약 조건이 **다항식**으로 변환됨
3. 다항식이 **타원곡선 위의 점들**로 변환됨
4. 타원곡선 점들의 조합이 **Proof**가 됨

**결론:**
- Proof는 단순한 데이터가 아니라, **모든 조건이 만족되었다는 수학적 증명**입니다
- 3가지 검증이 모두 통과해야 Proof가 생성됩니다
- Proof 자체에는 원본 데이터가 보이지 않지만, 모든 검증이 통과했음을 증명합니다

