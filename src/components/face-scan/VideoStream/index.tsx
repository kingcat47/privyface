import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  FaceFeatures,
  PixelLandmark,
  ScaledFeatures,
} from "../../../types/face";
import { extractFeatures } from "../../../lib/face-features/extractor";
import { normalizeAndHash } from "../../../lib/face-features/normalizer";
import { FaceDetector } from "../../../lib/mediapipe/face-detector";
import type { ScanProgress } from "../../../lib/mediapipe/types";
import styles from "./styles.module.scss";

interface VideoStreamProps {
  onFeaturesExtracted?: (data: {
    landmarks: PixelLandmark[];
    normalizedFeatures: FaceFeatures;
    scaledFeatures: ScaledFeatures;
  }) => void;
  onProgressChange?: (progress: ScanProgress) => void;
  onError?: (error: Error) => void;
  overlayChildren?: ReactNode;
}

export function VideoStream({
  onFeaturesExtracted,
  onProgressChange,
  onError,
  overlayChildren,
}: VideoStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<FaceDetector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const collectionTimeoutRef = useRef<number | null>(null);

  // 카메라 스트림 시작
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        const video = videoRef.current;

        // 비디오가 준비될 때까지 기다리기
        await new Promise<void>((resolve, reject) => {
          const onLoadedMetadata = () => {
            video.removeEventListener("loadedmetadata", onLoadedMetadata);
            resolve();
          };

          const onError = () => {
            video.removeEventListener("error", onError);
            reject(new Error("비디오 로드 실패"));
          };

          video.addEventListener("loadedmetadata", onLoadedMetadata);
          video.addEventListener("error", onError);

          video.srcObject = stream;
        });

        // 비디오 재생 시도 (에러 무시 - 이미 재생 중일 수 있음)
        try {
          await video.play();
        } catch (playError) {
          // AbortError는 무시 (이미 재생 중이거나 중단됨)
          if (playError instanceof Error && playError.name !== "AbortError") {
            console.warn("비디오 재생 오류:", playError);
          }
        }

        setIsStreaming(true);

        // 카메라 시작 상태 업데이트
        onProgressChange?.({
          stage: "detecting",
          progress: 0,
          message: "얼굴을 카메라에 맞춰주세요",
          collectedFrames: 0,
          totalFrames: 60,
        });

        // MediaPipe 초기화 및 시작
        if (!detectorRef.current) {
          detectorRef.current = new FaceDetector();
          // 모델 파일 경로 전달 (없으면 CDN에서 자동 로드)
          // 로컬 파일 사용 시: await detectorRef.current.initialize("/face_landmarker.task");
          await detectorRef.current.initialize();
        }

        if (videoRef.current && canvasRef.current) {
          detectorRef.current.startDetection(
            videoRef.current,
            canvasRef.current
          );
        }

        // 얼굴 감지 시작
        startFaceDetection();
      }
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("카메라 접근 실패");
      onError?.(err);
      console.error("Camera access error:", error);
    }
  };

  // 카메라 종료
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  };

  // 얼굴 감지 및 특징값 수집
  const startFaceDetection = async () => {
    if (!videoRef.current || !detectorRef.current) {
      console.warn("startFaceDetection: videoRef 또는 detectorRef가 없습니다");
      return;
    }

    const video = videoRef.current;
    let frameCount = 0;
    const collectedFrames: FaceFeatures[] = [];

    console.log("얼굴 감지 시작", {
      videoReady: video.readyState,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
    });

    const detectFrame = async () => {
      // streamRef를 체크하여 실제 스트림 상태 확인 (클로저 문제 해결)
      if (!videoRef.current || !detectorRef.current || !streamRef.current) {
        console.warn("detectFrame: 조건 불만족", {
          hasVideo: !!videoRef.current,
          hasDetector: !!detectorRef.current,
          hasStream: !!streamRef.current,
        });
        return;
      }

      try {
        // MediaPipe로 얼굴 감지
        const normalizedLandmarks = await detectorRef.current.detectFace(video);

        if (normalizedLandmarks.length === 468) {
          // 픽셀 좌표로 변환
          const pixelLandmarks = detectorRef.current.convertToPixelCoordinates(
            normalizedLandmarks,
            video.videoWidth,
            video.videoHeight
          );

          // 특징 추출
          const features = extractFeatures(pixelLandmarks);
          collectedFrames.push(features);
          frameCount++;

          // 진행 상태 업데이트
          onProgressChange?.({
            stage: frameCount < 30 ? "collecting" : "processing",
            progress: Math.min((frameCount / 60) * 100, 100),
            message:
              frameCount < 30
                ? `얼굴 감지됨, ${Math.ceil(
                    (30 - frameCount) / 30
                  )}초간 유지해주세요`
                : "특징값 처리 중...",
            collectedFrames: frameCount,
            totalFrames: 60,
          });

          // 60프레임 수집 완료 (약 2초, 30fps 기준)
          if (frameCount >= 60) {
            processCollectedFeatures(collectedFrames, pixelLandmarks);
            return;
          }
        } else {
          // 얼굴 미감지
          if (normalizedLandmarks.length === 0) {
            console.log("얼굴 미감지: 랜드마크가 없습니다", {
              videoReady: video.readyState,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
            });
          } else {
            console.warn(
              `얼굴 미감지: 랜드마크 개수 불일치 (${normalizedLandmarks.length}/468)`
            );
          }

          onProgressChange?.({
            stage: "detecting",
            progress: 0,
            message: "얼굴을 카메라에 맞춰주세요",
            collectedFrames: 0,
            totalFrames: 60,
          });
        }

        // 다음 프레임 감지 (30fps로 제한)
        setTimeout(() => {
          requestAnimationFrame(detectFrame);
        }, 1000 / 30);
      } catch (error) {
        const err =
          error instanceof Error ? error : new Error("얼굴 감지 실패");
        onError?.(err);
        console.error("Face detection error:", error);
      }
    };

    // 1초 대기 후 수집 시작 (사용자 안정화)
    collectionTimeoutRef.current = window.setTimeout(() => {
      requestAnimationFrame(detectFrame);
    }, 1000);
  };

  // 수집된 특징값 처리 (중앙값 계산)
  const processCollectedFeatures = async (
    featuresArray: FaceFeatures[],
    lastPixelLandmarks: PixelLandmark[]
  ) => {
    try {
      // 중앙값 계산 (이상치 제거)
      const medianFeatures = calculateMedianFeatures(featuresArray);

      // 정수화
      const { scaledFeatures } = normalizeAndHash(medianFeatures);

      // 카메라 종료
      stopCamera();

      // 결과 전달
      onFeaturesExtracted?.({
        landmarks: lastPixelLandmarks,
        normalizedFeatures: medianFeatures,
        scaledFeatures,
      });

      // 완료 상태
      onProgressChange?.({
        stage: "completed",
        progress: 100,
        message: "스캔 완료!",
        collectedFrames: featuresArray.length,
        totalFrames: 60,
      });
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("특징값 처리 실패");
      onError?.(err);
      onProgressChange?.({
        stage: "error",
        progress: 0,
        message: "오류가 발생했습니다",
        collectedFrames: 0,
        totalFrames: 60,
      });
    }
  };

  // 중앙값 계산
  const calculateMedianFeatures = (
    featuresArray: FaceFeatures[]
  ): FaceFeatures => {
    const keys: (keyof FaceFeatures)[] = [
      "f1_nose_len",
      "f2_mouth_width",
      "f3_eye_to_chin",
      "f4_eye_to_mouth",
      "f5_nose_width",
      "f6_inner_eye_dist",
      "f7_eyebrow_dist",
      "f8_face_width",
      "f9_jaw_width",
      "f10_upper_lip",
    ];

    const medianFeatures: FaceFeatures = {} as FaceFeatures;

    keys.forEach((key) => {
      const values = featuresArray.map((f) => f[key]).sort((a, b) => a - b);
      const mid = Math.floor(values.length / 2);
      medianFeatures[key] =
        values.length % 2 === 0
          ? (values[mid - 1] + values[mid]) / 2
          : values[mid];
    });

    return medianFeatures;
  };

  // 컴포넌트 마운트 시 자동으로 카메라 시작
  useEffect(() => {
    startCamera();

    return () => {
      if (collectionTimeoutRef.current !== null) {
        window.clearTimeout(collectionTimeoutRef.current);
      }
      if (detectorRef.current) {
        detectorRef.current.dispose();
      }
      stopCamera();
    };
  }, []);

  return (
    <div className={styles.videoStreamContainer}>
      <div className={styles.videoWrapper}>
        <video
          ref={videoRef}
          className={styles.video}
          autoPlay
          playsInline
          muted
        />
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={styles.faceGuide} />
        {overlayChildren}
      </div>
    </div>
  );
}
