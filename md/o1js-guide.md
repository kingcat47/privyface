# o1js 사용 가이드

o1js는 별도의 WASM/ZKEY 파일이 필요 없습니다.
Proof는 런타임에 직접 생성됩니다.

## 사용 방법

코드 예시는 src/lib/zkp/circuits/face-verification-o1js.ts를 참고하세요.

## 주의사항

- o1js는 SmartContract 기반이므로, 실제 Proof 생성은 다른 방식이 필요할 수 있습니다.
- identity.manager.ts를 o1js 방식으로 수정해야 합니다.
