# o1js 설정 완료

## 완료된 작업

1. **o1js 설치**: `npm install o1js` 완료
2. **회로 파일 작성**: `src/lib/zkp/circuits/face-verification-o1js.ts`
3. **컴파일 스크립트**: `src/lib/zkp/compile-circuit.ts`
4. **디렉토리 생성**: `public/circuits/` 폴더 생성

## 중요 사항

**o1js는 WASM/ZKEY 파일이 필요 없습니다!**

- o1js는 **런타임에 Proof를 직접 생성**합니다
- 별도의 컴파일 과정이나 Trusted Setup이 필요 없습니다
- Verification Key는 Proof 생성 시 자동으로 생성됩니다

## 다음 단계

`identity.manager.ts`를 o1js 방식으로 수정해야 합니다:

1. `snarkjs` 대신 `o1js` API 사용
2. `FaceFeatures`와 `MerklePath` 클래스 사용
3. `verifyFaceIdentity` 함수로 Proof 생성

## 참고 파일

- 회로 파일: `src/lib/zkp/circuits/face-verification-o1js.ts`
- 가이드: `public/circuits/o1js-guide.md`
