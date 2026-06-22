# MediaPipe Face Landmarker 모델 파일 설정

## 모델 파일 다운로드

Python 코드에서 사용하는 것과 동일한 MediaPipe Face Landmarker 모델 파일이 필요합니다.

1. 다음 링크에서 모델 파일을 다운로드하세요:

   - https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task

2. 다운로드한 `face_landmarker.task` 파일을 `public` 폴더에 복사하세요:
   ```
   public/
     └── face_landmarker.task
   ```

## 확인

모델 파일이 올바르게 배치되었는지 확인:

- 파일 경로: `public/face_landmarker.task`
- 파일 크기: 약 10-20MB

## 참고

- 이 모델 파일은 Python 코드에서 사용하는 것과 동일한 MediaPipe Face Landmarker 모델입니다.
- 웹에서도 동일한 랜드마크 인덱스와 좌표를 사용하므로 Python과 동일한 특징값을 추출할 수 있습니다.
