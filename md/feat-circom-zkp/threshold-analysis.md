# 유사도 임계값(threshold) 분석 및 결정 근거

---

## 문제

`config.ts`의 `DEFAULT_SIMILARITY_THRESHOLD = 3000000` 설정 하에서
DB에 등록된 **다른 사람**의 얼굴로 인증을 시도해도 통과되는 현상 발생.

---

## 임계값의 의미

회로는 유클리드 제곱거리(Squared Euclidean Distance)를 계산한다:

```
dist = Σ (userFeatures[i] - governmentFeatures[i])²   (i = 0..9)
```

`dist < threshold` 이면 동일인으로 판단, proof 생성 성공.
`dist ≥ threshold` 이면 proof 생성 자체가 실패 (회로 제약 위반).

---

## 왜 3,000,000이 잘못됐는가

DB에 등록된 4명 간의 실제 제곱거리를 계산하면:

| 비교쌍 | 제곱거리 | 3,000,000 기준 |
|--------|----------|----------------|
| user_ceu vs user_ltg | 1,852,197 | **통과** ← 다른 사람인데 통과 |
| user_ceu vs user_kwy | 약 620,000 | **통과** |
| user_ceu vs user_hyc | 1,173,879 | **통과** |
| user_ltg vs user_kwy | 약 900,000 | **통과** |
| user_ltg vs user_hyc | 약 1,400,000 | **통과** |
| user_kwy vs user_hyc | 약 200,000 | **통과** |

**threshold(3,000,000)가 DB 내 모든 다른 사람 간 거리보다 크다.**
→ 어떤 조합으로도 검증 실패가 불가능한 상태.

---

## 올바른 threshold 산출 방법론

threshold는 아래 두 값 사이에 설정해야 한다:

```
intra-class 최댓값 < threshold < inter-class 최솟값
```

- **intra-class**: 동일인을 다른 조건(조명, 각도, 시간)에서 스캔한 거리 → threshold **이하**여야 함
- **inter-class**: 서로 다른 두 사람 간 거리 → threshold **이상**이어야 함

### intra-class 추정 (이론적 근거)

IPD(눈 간 거리)로 정규화한 기하학적 얼굴 특징은 조명/각도 변화에
CV(변동계수, Coefficient of Variation) **2~5%** 수준의 변동을 보인다.

> 참고: Zhao et al., *"Face Recognition: A Literature Survey"*,
> ACM Computing Surveys, Vol.35, No.4, 2003, pp.399-458.

CV = 3% 기준, 우리 feature 범위에 대입:

| feature 범위 | CV 3% 기준 1개 분산 |
|-------------|---------------------|
| 소형 (~700) | (0.03 × 700)² = 441 |
| 중형 (~5,000) | (0.03 × 5,000)² = 22,500 |
| 대형 (~15,000) | (0.03 × 15,000)² = 202,500 |

10개 feature 합산 추정:
```
대형 2개 × 202,500 = 405,000
중형 5개 × 22,500  = 112,500
소형 3개 × 441     =   1,323
────────────────────────────
합계 ≈ 520,000
```

→ **동일인 반복 스캔 시 제곱거리 상한 추정: ~650,000** (여유 포함)

### inter-class 최솟값 (실측)

DB 4명 간 거리에서 최솟값: **user_ceu vs user_kwy ≈ 620,000**
그러나 이 두 사람이 특별히 비슷하게 생긴 케이스.
나머지 쌍의 최솟값: **~1,173,879**

---

## threshold 결정

```
동일인 상한 추정:   ~650,000
다른 사람 최솟값:  ~1,173,879 (일반적 케이스)
```

두 값 사이의 중간점: **(650,000 + 1,173,879) / 2 ≈ 912,000**

여기에 안전 마진을 고려해 **800,000**으로 설정:
- 동일인 허용 상한(650,000)보다 충분히 큼 → false negative(본인 거부) 방지
- 다른 사람 최솟값(1,173,879)보다 충분히 작음 → false positive(타인 허용) 방지
- 양쪽 마진 각각 약 20~30% 확보

---

## 중요한 한계

이 값은 **이론적 추정 + DB 4명 데이터** 기반이다.

운영 전 반드시 다음을 수행해야 함:

1. **동일인 반복 스캔 실험**: 등록된 각 사람을 10회 이상 다른 조건(조명, 거리, 각도)에서 스캔해 실제 intra-class 거리 분포 측정
2. **이 측정값의 95th percentile** 이상으로 threshold 하한 결정
3. **inter-class 최솟값** 이하로 threshold 상한 결정
4. 둘 사이에 충분한 gap이 없으면 feature 설계 자체를 재검토

---

## 변경 내용

```ts
// 변경 전
export const DEFAULT_SIMILARITY_THRESHOLD = 3000000;

// 변경 후
export const DEFAULT_SIMILARITY_THRESHOLD = 800000;
```

---

## 실측 결과 및 근본 문제 발견 (2026-07-09)

`prover.ts`에 제곱거리 로깅을 추가해 실제 측정한 결과:

```
[prover] 실제 제곱거리: 5,933,182
[prover] threshold: 800000
[prover] 통과 여부 (dist < threshold): false
```

### 심각한 문제: intra-class > inter-class

| 측정 대상 | 제곱거리 |
|-----------|---------|
| **동일인 — 웹캠 실시간 vs 저장 사진 (intra-class)** | **5,933,182** |
| 다른 사람 간 최솟값 (inter-class) | ~620,000 |
| 다른 사람 간 일반 최솟값 | ~1,173,879 |

**intra-class 거리(5,933,182)가 inter-class 거리 최솟값(620,000)보다 약 9배 크다.**

어떤 threshold를 설정해도 동시에 다음 두 조건을 만족할 수 없다:
- 본인 통과 → threshold > 5,933,182 필요
- 타인 차단 → threshold < 620,000 필요

### 근본 원인

정부 DB 특징값과 실시간 검증 특징값이 **서로 다른 파이프라인**에서 추출된다:

| 단계 | 추출 방식 |
|------|----------|
| **등록 (정부 DB)** | `face_analysis.py` → 정적 이미지 파일 → dlib/MediaPipe |
| **검증 (실시간)** | 브라우저 MediaPipe → 웹캠 영상 프레임 |

같은 알고리즘이어도 아래 요인으로 feature 값이 크게 달라진다:
- 이미지 해상도/품질 차이
- 조명 조건 차이
- 얼굴 스케일 및 크롭 방식 차이
- 정적 이미지 vs 실시간 영상 프레임 차이

### 해결 방향

#### 방법 1: 등록 파이프라인을 검증과 동일하게 맞추기 (권장)
정부 DB feature를 정적 이미지가 아닌 **웹캠으로 재등록**.
즉, 등록 시에도 브라우저 MediaPipe로 feature를 추출하면
동일한 파이프라인이므로 intra-class 거리가 대폭 줄어든다.

```
등록: 웹캠 → 브라우저 MediaPipe → feature → DB 저장
검증: 웹캠 → 브라우저 MediaPipe → feature → ZKP 비교
```

#### 방법 2: Feature 정규화 강화
현재 feature는 IPD(눈 간 거리)로 정규화된 기하학적 수치.
여기에 추가로 조명 불변, 스케일 불변 정규화를 적용하면
파이프라인 차이에 따른 변동을 줄일 수 있다.

#### 방법 3: Feature 설계 재검토
비율 기반 feature(예: 눈 높이/너비 비율, 코-입 간 거리/얼굴 높이 비율 등)를
사용하면 절댓값 의존도가 줄어 파이프라인 간 안정성이 높아진다.

### 현재 상태

threshold 값 자체의 문제가 아닌 **feature 추출 파이프라인 불일치** 문제.
threshold를 아무리 조정해도 해결되지 않음.

**다음 작업**: 등록 파이프라인을 브라우저 MediaPipe 기반으로 통일 (방법 1)하거나,
`face_analysis.py`와 브라우저 MediaPipe가 동일한 feature를 생성하는지 검증.
