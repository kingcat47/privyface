// MediaPipe Face Landmark 타입 정의
export interface FaceLandmark {
  x: number; // 정규화된 X 좌표 (0-1)
  y: number; // 정규화된 Y 좌표 (0-1)
  z: number; // 깊이 정보 (Z 좌표)
}

// 픽셀 좌표로 변환된 랜드마크
export interface PixelLandmark {
  x: number; // 픽셀 X 좌표
  y: number; // 픽셀 Y 좌표
  z: number; // 깊이 정보
}

// 추출된 특징값 (정규화된 값)
export interface FaceFeatures {
  f1_nose_len: number;
  f2_mouth_width: number;
  f3_eye_to_chin: number;
  f4_eye_to_mouth: number;
  f5_nose_width: number;
  f6_inner_eye_dist: number;
  f7_eyebrow_dist: number;
  f8_face_width: number;
  f9_jaw_width: number;
  f10_upper_lip: number;
}

// 정수화된 특징값 배열 (10개)
export type ScaledFeatures = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];
