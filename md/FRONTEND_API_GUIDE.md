# 프론트엔드 개발자 가이드 - 서버 API 연동

## API 엔드포인트

**로컬 개발 환경:**

```
POST http://localhost:3000/zkp/verify
```

## 요청 형식

### Content-Type

```
application/json
```

### 요청 Body (o1js Proof 형식)

```json
{
  "timestamp": 1766553168570,
  "proofType": "o1js",
  "publicInput": [
    "21839566587697326871835113890655501266171373272607877046308523795024443950535"
  ],
  "maxProofsVerified": 0,
  "proof": "KChzdGF0ZW1lbnQoKHByb29mX3N0YXRlKChkZWZlcnJlZF92YWx1ZXMoKHBsb25rKChhbHBoYSgoaW5uZXIoZjc3OTUyYTNjMGRh..."
}
```

### 필드 설명

- `timestamp`: Proof 생성 시각 (Unix timestamp)
- `proofType`: "o1js" (고정값)
- `publicInput`: 머클 루트 등 공개 값 배열 (문자열 배열)
- `maxProofsVerified`: 검증된 Proof 개수 (일반적으로 0)
- `proof`: base64 인코딩된 Proof 문자열 (수천 자의 매우 긴 문자열)

## 응답 형식

### 성공 응답 (200 OK)

```json
{
  "success": true,
  "message": "신원 확인 성공",
  "timestamp": 1766553168570,
  "publicInput": "21839566587697326871835113890655501266171373272607877046308523795024443950535"
}
```

### 실패 응답 (200 OK, success: false)

```json
{
  "success": false,
  "message": "Proof 검증 실패"
}
```

또는

```json
{
  "success": false,
  "message": "머클 루트가 일치하지 않습니다"
}
```

## 구현 예시

### JavaScript/TypeScript (fetch 사용)

```typescript
const verifyProof = async (proofData: {
  timestamp: number;
  proofType: string;
  publicInput: string[];
  maxProofsVerified: number;
  proof: string;
}) => {
  try {
    const response = await fetch("http://localhost:3000/zkp/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(proofData),
    });

    if (!response.ok) {
      throw new Error(
        `서버 응답 오류: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("검증 요청 실패:", error);
    throw error;
  }
};

// 사용 예시
const proofData = {
  timestamp: Date.now(),
  proofType: "o1js",
  publicInput: [
    "21839566587697326871835113890655501266171373272607877046308523795024443950535",
  ],
  maxProofsVerified: 0,
  proof:
    "KChzdGF0ZW1lbnQoKHByb29mX3N0YXRlKChkZWZlcnJlZF92YWx1ZXMoKHBsb25rKChhbHBoYSgoaW5uZXIoZjc3OTUyYTNjMGRh...",
};

const result = await verifyProof(proofData);
if (result.success) {
  console.log("검증 성공:", result.message);
} else {
  console.error("검증 실패:", result.message);
}
```

### Axios 사용 (선택사항)

```typescript
import axios from "axios";

const verifyProof = async (proofData: any) => {
  try {
    const response = await axios.post(
      "http://localhost:3000/zkp/verify",
      proofData,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("검증 요청 실패:", error);
    throw error;
  }
};
```

## 주의사항

### 1. 서버 실행 확인

- 백엔드 서버가 `http://localhost:3000`에서 실행 중이어야 합니다
- 서버가 실행되지 않으면 네트워크 오류가 발생합니다

### 2. CORS 설정

- 백엔드에서 CORS가 활성화되어 있어야 합니다
- 로컬 개발 환경에서는 모든 origin을 허용하도록 설정되어 있습니다

### 3. 포트 변경

- 백엔드가 다른 포트에서 실행되는 경우, 요청 URL을 변경하세요
- 예: `http://localhost:3001/zkp/verify`

### 4. 에러 처리

- 네트워크 오류: 서버가 실행 중인지 확인
- 검증 실패: Proof 데이터가 올바른지 확인
- 서버 오류: 백엔드 로그 확인

## 현재 구현 상태

프론트엔드 코드(`src/pages/FaceScan/index.tsx`)에 이미 서버 전송 로직이 구현되어 있습니다:

1. Proof 생성 후 자동으로 서버로 전송
2. 서버 응답에 따라 성공/실패 메시지 표시
3. 네트워크 오류 시 사용자에게 안내

## 테스트 방법

1. 백엔드 서버 실행: `npm run start:dev` (포트 3000)
2. 프론트엔드 실행: `npm run dev`
3. 얼굴 스캔 후 "정부 DB와 비교" 버튼 클릭
4. 콘솔에서 서버 전송 및 응답 확인

## 디버깅

### 콘솔 로그 확인

- `서버로 Proof 전송 중...`: 요청 시작
- `요청 주소: http://localhost:3000/zkp/verify`: 요청 URL
- `서버 검증 결과: {...}`: 서버 응답
- `서버 전송 실패: ...`: 오류 발생

### 네트워크 탭 확인

- 브라우저 개발자 도구 → Network 탭
- `zkp/verify` 요청 확인
- 요청/응답 데이터 확인
