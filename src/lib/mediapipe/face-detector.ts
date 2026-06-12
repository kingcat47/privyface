import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { FaceLandmark, PixelLandmark } from "../../types/face";

/**
 * MediaPipe Face Landmarker를 초기화하고 사용하는 클래스
 * Python의 mediapipe.tasks.python.vision.FaceLandmarker와 동일한 기능
 */
export class FaceDetector {
  private _videoElement: HTMLVideoElement | null = null;
  private _canvasElement: HTMLCanvasElement | null = null;
  private _isDetecting = false;
  private animationFrameId: number | null = null;
  private faceLandmarker: FaceLandmarker | null = null;
  private lastVideoTime = -1;

  /**
   * MediaPipe Face Landmarker 초기화
   * @param modelPath 모델 파일 경로 또는 URL (기본값: CDN URL)
   */
  async initialize(modelPath?: string): Promise<void> {
    try {
      // MediaPipe Tasks Vision 리졸버 초기화
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );

      // 모델 경로 설정 (없으면 CDN에서 직접 로드)
      const modelAssetPath =
        modelPath ||
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

      // FaceLandmarker 옵션 설정 (Python 코드와 동일)
      const faceLandmarkerOptions = {
        baseOptions: {
          modelAssetPath: modelAssetPath,
          delegate: "GPU" as const,
        },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO" as const, // 비디오 스트림용
        numFaces: 1,
      };

      // FaceLandmarker 생성
      this.faceLandmarker = await FaceLandmarker.createFromOptions(
        vision,
        faceLandmarkerOptions
      );

      console.log("FaceDetector initialized with MediaPipe", modelAssetPath);
    } catch (error) {
      console.error("FaceDetector initialization error:", error);
      throw new Error(
        `MediaPipe FaceLandmarker 초기화 실패: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`
      );
    }
  }

  /**
   * 비디오 스트림 시작
   * @param videoElement 비디오 엘리먼트
   * @param canvasElement 캔버스 엘리먼트 (랜드마크 그리기용, 선택사항)
   */
  startDetection(
    videoElement: HTMLVideoElement,
    canvasElement?: HTMLCanvasElement
  ): void {
    this._videoElement = videoElement;
    this._canvasElement = canvasElement || null;
    this._isDetecting = true;
    this.lastVideoTime = -1;
  }

  /**
   * 비디오 프레임에서 얼굴 감지
   * Python의 detector.detect(image)와 동일한 기능
   * @param videoElement 비디오 엘리먼트
   * @returns 랜드마크 배열 (정규화된 좌표)
   */
  async detectFace(videoElement: HTMLVideoElement): Promise<FaceLandmark[]> {
    if (!this.faceLandmarker) {
      console.warn("FaceLandmarker가 초기화되지 않았습니다");
      return [];
    }

    if (videoElement.readyState < 2) {
      return [];
    }

    try {
      // 비디오의 현재 시간 (밀리초)
      const videoTime = videoElement.currentTime * 1000;

      // 동일한 프레임을 중복 처리하지 않기 위해
      if (this.lastVideoTime === videoTime) {
        return [];
      }
      this.lastVideoTime = videoTime;

      // MediaPipe로 얼굴 감지 (Python의 detect()와 동일)
      const results = this.faceLandmarker.detectForVideo(
        videoElement,
        videoTime
      );

      // 얼굴이 감지되었는지 확인
      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        // 첫 번째 얼굴의 랜드마크 가져오기 (Python: detection_result.face_landmarks[0])
        const landmarks = results.faceLandmarks[0];

        // MediaPipe 랜드마크를 우리 타입으로 변환
        // Python: landmarks[idx].x, landmarks[idx].y, landmarks[idx].z
        // Python 코드는 468개를 사용하므로 처음 468개만 사용
        const faceLandmarks: FaceLandmark[] = landmarks
          .slice(0, 468) // 처음 468개만 사용 (Python과 동일)
          .map((lm) => ({
            x: lm.x, // 이미 정규화된 좌표 (0-1)
            y: lm.y, // 이미 정규화된 좌표 (0-1)
            z: lm.z || 0, // 깊이 정보
          }));

        return faceLandmarks;
      }

      return [];
    } catch (error) {
      console.error("Face detection error:", error);
      return [];
    }
  }

  /**
   * 정규화된 랜드마크를 픽셀 좌표로 변환
   * Python: lm.x * w, lm.y * h와 동일
   * @param landmarks 정규화된 랜드마크 (0-1)
   * @param width 비디오/캔버스 너비
   * @param height 비디오/캔버스 높이
   * @returns 픽셀 좌표 랜드마크
   */
  convertToPixelCoordinates(
    landmarks: FaceLandmark[],
    width: number,
    height: number
  ): PixelLandmark[] {
    return landmarks.map((lm) => ({
      x: lm.x * width, // Python: lm.x * w
      y: lm.y * height, // Python: lm.y * h
      z: lm.z,
    }));
  }

  /**
   * 감지 중지
   */
  stopDetection(): void {
    this._isDetecting = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 리소스 정리
   */
  dispose(): void {
    this.stopDetection();
    this.faceLandmarker = null;
    this._videoElement = null;
    this._canvasElement = null;
  }
}
