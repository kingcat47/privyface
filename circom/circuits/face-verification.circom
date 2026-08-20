pragma circom 2.0.0;

// ============================================================
// [circom 문법 설명]
//
// pragma circom 2.0.0;
//   → 사용할 circom 버전 선언. 파일 맨 위에 반드시 있어야 함.
//
// include "경로";
//   → 다른 circom 파일을 가져옴. circomlib는 검증된 회로 모음 라이브러리.
//   → poseidon.circom: ZKP에 최적화된 해시 함수
//   → comparators.circom: 대소비교 회로 (LessThan 등)
// ============================================================

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/bitify.circom";

// ============================================================
// [circom 문법 설명]
//
// template 이름(파라미터) { ... }
//   → circom의 함수 같은 개념. 회로 구조를 정의함.
//   → 파라미터는 컴파일 타임 상수 (런타임 값 아님).
//   → n_features = 10 (특징값 개수), levels = 2 (머클 트리 높이)
//
// signal input 이름;
//   → 외부에서 입력받는 값. 증인(witness)의 일부.
//   → private input: 증명자만 알고 있는 값 (기본값)
//   → public input: 검증자도 알 수 있는 값 (component main에서 선언)
//
// signal 이름;
//   → 회로 내부에서 계산되는 중간값.
//
// var 이름;
//   → 일반 변수. 컴파일 타임에만 존재하고 제약 조건 생성에 안 씌임.
//
// <== (왼쪽 대입 + 제약 동시)
//   → a <== b * c  : a를 b*c로 설정하고, a == b*c 제약도 추가
//   → signal에만 사용 가능
//
// === (등호 제약만)
//   → a === b  : a와 b가 같아야 한다는 제약만 추가 (대입 아님)
//   → 검증 조건에 사용
//
// component 이름 = 템플릿(파라미터);
//   → 다른 template을 인스턴스화. 다른 언어의 클래스 인스턴스 같은 개념.
// ============================================================

template FaceVerification(n_features, levels) {

    // ================================================================
    // 입력 신호 선언
    // ================================================================

    // [private inputs] 증명자만 아는 값 — 서버/검증자에게 노출되지 않음
    signal input governmentFeatures[n_features]; // 정부 DB에 등록된 얼굴 특징값 10개
    signal input userFeatures[n_features];        // 웹캠으로 추출한 실시간 특징값 10개
    signal input pathElements[levels];            // 머클 경로의 형제 노드 해시값들
    signal input pathIndices[levels];             // 각 레벨에서 내가 왼쪽(0)인지 오른쪽(1)인지

    // [public inputs] 검증자도 알 수 있는 값 — component main에서 public으로 선언됨
    signal input root;       // 정부가 공인한 머클 루트 해시
    signal input threshold;  // 얼굴 유사도 허용 임계값 (이 값 이하면 동일인으로 판단)


    // ================================================================
    // 1단계: 유클리드 거리 계산 (두 특징값 배열이 얼마나 비슷한지)
    // ================================================================

    // ============================================================
    // [circom 문법 설명]
    //
    // signal 배열은 루프 밖에서 미리 선언해야 함.
    // circom은 루프 안에서 signal을 새로 선언할 수 없음.
    // var는 루프 안에서 써도 됨 (컴파일 타임 변수라서).
    // ============================================================

    // [보안 수정] 특징값 범위 제약 (16비트 이내 강제)
    // private input은 공격자가 아무 값이나 넣을 수 있으므로
    // 범위를 제한하지 않으면 유한체 랩어라운드로 거리 검사를 우회할 수 있음
    component rangeCheckUser[n_features];
    component rangeCheckGov[n_features];
    for (var i = 0; i < n_features; i++) {
        rangeCheckUser[i] = Num2Bits(16);
        rangeCheckUser[i].in <== userFeatures[i];
        rangeCheckGov[i] = Num2Bits(16);
        rangeCheckGov[i].in <== governmentFeatures[i];
    }

    // 특징값 차이 계산
    // diff가 음수일 때 유한체에서 p-k가 되지만, 제곱하면 k²와 동일하므로 거리 계산은 정상 작동
    // 범위 제약이 위에서 걸려있어 diff² 최대값 = 65535² = ~4×10⁹, 10개 합쳐도 ~4×10¹⁰ → 랩어라운드 불가
    signal diff[n_features];
    signal square[n_features];
    var dist_sum = 0;

    for (var i = 0; i < n_features; i++) {
        diff[i]   <== userFeatures[i] - governmentFeatures[i];
        square[i] <== diff[i] * diff[i];
        dist_sum  += square[i];
    }

    // ================================================================
    // 2단계: 거리가 임계값 이하인지 검증
    // ================================================================

    // ============================================================
    // [circom 문법 설명]
    //
    // LessThan(n): n비트 범위에서 a < b 인지 비교하는 회로 (circomlib)
    //   → .in[0] < .in[1] 이면 .out == 1, 아니면 .out == 0
    //   → n=252: 252비트 범위의 수를 비교 (큰 정수 처리용)
    //
    // lt.out === 1;
    //   → out이 반드시 1이어야 한다는 제약 추가
    //   → 이 조건이 안 맞으면 proof 생성 자체가 실패함
    // ============================================================

    // [보안 수정] LessThan(252) → LessThan(40)
    // 특징값이 16비트로 제한되므로 dist_sum 최대값 ≈ 4×10¹⁰ < 2⁴⁰
    // 252비트는 과도하고, 40비트면 충분. 제약 수도 253 → 41개로 감소
    component lt = LessThan(40);
    lt.in[0] <== dist_sum;   // 실제 거리 (제곱합)
    lt.in[1] <== threshold;  // 허용 임계값
    lt.out === 1;             // 거리 < 임계값 이어야만 proof 생성 가능


    // ================================================================
    // 3단계: 정부 DB 특징값의 해시 계산 (머클 트리 리프값)
    // ================================================================

    // ============================================================
    // [circom 문법 설명]
    //
    // Poseidon(n): n개의 입력을 받아 해시값 1개를 출력하는 회로 (circomlib)
    //   → ZKP에 최적화된 해시 함수. 일반 SHA256보다 회로 제약 수가 훨씬 적음.
    //   → .inputs[i]: i번째 입력
    //   → .out: 해시 결과값
    // ============================================================

    component leafHasher = Poseidon(n_features);

    for (var i = 0; i < n_features; i++) {
        leafHasher.inputs[i] <== governmentFeatures[i];
    }

    signal leaf <== leafHasher.out; // 이 사람의 머클 트리 리프 해시값


    // ================================================================
    // 4단계: 머클 트리 경로 검증 (이 리프가 진짜 트리에 있는지)
    // ================================================================

    // ============================================================
    // [circom 문법 설명]
    //
    // 머클 트리 검증 원리:
    //   leaf 에서 시작해서 형제 노드(pathElements)와 Poseidon 해시를 반복해
    //   최종적으로 루트가 나오는지 확인.
    //
    //   pathIndices[i] == 0: 내가 왼쪽 → Hash(나, 형제)
    //   pathIndices[i] == 1: 내가 오른쪽 → Hash(형제, 나)
    //
    // 멀티플렉서(mux) 패턴:
    //   circom에서 if/else를 signal에 쓸 수 없음.
    //   대신 수식으로 조건 분기를 표현:
    //
    //   left  = (1 - idx) * current + idx * sibling
    //   right = idx * current + (1 - idx) * sibling
    //
    //   idx==0: left=current, right=sibling
    //   idx==1: left=sibling, right=current
    // ============================================================

    component hashers[levels];
    signal currentHash[levels + 1]; // currentHash[0]=leaf, currentHash[levels]=루트

    // 루프 안에서 선언 불가능하므로 배열로 미리 선언
    signal left[levels];
    signal right[levels];
    signal temp1[levels];
    signal temp2[levels];
    signal temp3[levels];
    signal temp4[levels];

    currentHash[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        // [보안 수정] pathIndices가 반드시 0 또는 1이어야 함을 강제
        // 이 제약이 없으면 공격자가 임의의 값을 넣어 멀티플렉서를 조작하여
        // 트리에 없는 리프로도 루트를 맞출 수 있음
        pathIndices[i] * (pathIndices[i] - 1) === 0;

        hashers[i] = Poseidon(2);

        // 멀티플렉서: pathIndices에 따라 left/right 결정
        temp1[i] <== (1 - pathIndices[i]) * currentHash[i];
        temp2[i] <== pathIndices[i] * pathElements[i];
        left[i]  <== temp1[i] + temp2[i];

        temp3[i] <== pathIndices[i] * currentHash[i];
        temp4[i] <== (1 - pathIndices[i]) * pathElements[i];
        right[i] <== temp3[i] + temp4[i];

        hashers[i].inputs[0] <== left[i];
        hashers[i].inputs[1] <== right[i];

        currentHash[i + 1] <== hashers[i].out;
    }

    // 최종 계산된 루트가 공개된 루트와 일치해야 함
    currentHash[levels] === root;
}


// ============================================================
// [circom 문법 설명]
//
// component main { public [...] } = 템플릿(파라미터);
//   → 회로의 진입점. 반드시 main이어야 함.
//   → public [...]: 이 안에 있는 input signal만 공개됨.
//     나머지는 자동으로 private (검증자에게 숨겨짐).
//   → FaceVerification(10, 2): n_features=10, levels=2로 인스턴스화
// ============================================================

component main { public [root, threshold] } = FaceVerification(10, 2);
