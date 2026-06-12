import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type {
  FaceFeatures,
  PixelLandmark,
  ScaledFeatures,
} from "../../types/face";
import type { ScanProgress } from "../../lib/mediapipe/types";
import { VideoStream } from "../../components/face-scan/VideoStream";
import { ScanProgress as ScanProgressComponent } from "../../components/face-scan/ScanProgress";
import { FeatureDisplay } from "../../components/face-scan/FeatureDisplay";
import { IdentityManager } from "../../lib/zkp/identity.manager";
import { governmentDB } from "../../government/UserInfo";
import type { ProofGenerationOptions } from "../../lib/zkp/types";
import styles from "./styles.module.scss";

export const FaceScan = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userIdParam = searchParams.get("userId");
  const selectedUserId = userIdParam ? parseInt(userIdParam, 10) : null;

  // 선택한 유저 데이터 찾기
  const selectedUserData =
    selectedUserId !== null
      ? governmentDB.find((user) => user.userId === selectedUserId)
      : null;

  const [scanProgress, setScanProgress] = useState<ScanProgress>({
    stage: "detecting",
    progress: 0,
    message: "카메라 초기화 중...",
    collectedFrames: 0,
    totalFrames: 60,
  });
  const [extractedData, setExtractedData] = useState<{
    landmarks: PixelLandmark[];
    normalizedFeatures: FaceFeatures;
    scaledFeatures: ScaledFeatures;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [proofResult, setProofResult] = useState<{
    success: boolean;
    message: string;
    proofData?: string;
  } | null>(null);
  const [videoKey, setVideoKey] = useState(0); // VideoStream 재마운트용 key

  const handleFeaturesExtracted = (data: {
    landmarks: PixelLandmark[];
    normalizedFeatures: FaceFeatures;
    scaledFeatures: ScaledFeatures;
  }) => {
    // 로딩 팝업 표시
    setIsLoading(true);

    // 잠시 후 로딩 종료 및 데이터 설정
    setTimeout(() => {
      setIsLoading(false);
      setExtractedData(data);
      console.log("Extracted features:", data);
    }, 1500); // 1.5초 로딩
  };

  const handleProgressChange = (progress: ScanProgress) => {
    setScanProgress(progress);
  };

  const handleError = (err: Error) => {
    setError(err.message);
    setScanProgress({
      stage: "error",
      progress: 0,
      message: err.message,
      collectedFrames: 0,
      totalFrames: 60,
    });
  };

  const handleBack = () => {
    navigate("/");
  };

  const handleRetry = () => {
    setError(null);
    setExtractedData(null);
    setIsLoading(false);
    setProofResult(null);
    setVideoKey((prev) => prev + 1); // VideoStream 재마운트를 위한 key 변경
    setScanProgress({
      stage: "detecting",
      progress: 0,
      message: "카메라 초기화 중...",
      collectedFrames: 0,
      totalFrames: 60,
    });
  };

  const handleCompareWithDB = async () => {
    if (!extractedData) {
      setError("스캔 데이터가 없습니다.");
      return;
    }

    // 선택한 유저가 없는 경우
    if (!selectedUserData) {
      setError("유저 정보가 없습니다. 홈에서 유저를 선택해주세요.");
      return;
    }

    setIsGeneratingProof(true);
    setProofResult(null);
    setError(null);

    try {
      const identityManager = new IdentityManager();

      // o1js는 WASM/ZKEY 파일이 필요 없습니다
      const options: ProofGenerationOptions = {
        metadata: {
          timestamp: Date.now(),
        },
      };

      // 선택한 유저와만 비교
      try {
        const serverPayload = await identityManager.createProofForUser(
          extractedData.scaledFeatures,
          selectedUserData,
          options
        );

        // 서버 전송용 JSON 구조는 이미 새로운 형식으로 생성됨
        // {
        //   "merkleProof": { "leafHash", "siblings", "isLeft" },
        //   "faceZkProof": { "proof", "publicInput", "verificationKey" }
        // }

        // Console에 서버 전송용 JSON 출력
        console.log("=".repeat(80));
        console.log("서버 전송용 Proof JSON:");
        console.log("=".repeat(80));
        console.log(JSON.stringify(serverPayload, null, 2));
        console.log("=".repeat(80));

        console.log("=".repeat(80));

        // 서버로 Proof 전송
        try {
          console.log("\n서버로 Proof 전송 중...");
          console.log("요청 주소: http://localhost:3000/api/verify-identity");

          const response = await fetch(
            "http://localhost:3000/api/verify-identity",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(serverPayload),
            }
          );

          if (!response.ok) {
            throw new Error(
              `서버 응답 오류: ${response.status} ${response.statusText}`
            );
          }

          const result = await response.json();
          console.log("서버 검증 결과:", result);

          if (result.success) {
            setProofResult({
              success: true,
              message: result.message || "신원 확인 성공",
              proofData: JSON.stringify(serverPayload, null, 2),
            });
          } else {
            setProofResult({
              success: false,
              message: result.message || "검증 실패",
              proofData: JSON.stringify(serverPayload, null, 2),
            });
            setError(result.message || "서버 검증 실패");
          }
        } catch (fetchError) {
          console.error("서버 전송 실패:", fetchError);
          const errorMessage =
            fetchError instanceof Error
              ? fetchError.message
              : "알 수 없는 오류";

          // 네트워크 오류인 경우 안내 메시지
          if (
            errorMessage.includes("Failed to fetch") ||
            errorMessage.includes("NetworkError")
          ) {
            setError(
              `서버 연결 실패: 백엔드 서버가 http://localhost:3000 에서 실행 중인지 확인하세요.`
            );
          } else {
            setError(`서버 전송 실패: ${errorMessage}`);
          }

          setProofResult({
            success: false,
            message: `서버 전송 실패: ${errorMessage}`,
            proofData: JSON.stringify(serverPayload, null, 2),
          });
        }
      } catch (proofError) {
        const errorMessage =
          proofError instanceof Error ? proofError.message : "알 수 없는 오류";

        // 에러 메시지 처리
        let userFriendlyMessage = errorMessage;

        setProofResult({
          success: false,
          message: `검증 실패: ${userFriendlyMessage}`,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "알 수 없는 오류";

      setError(`Proof 생성 실패: ${errorMessage}`);
      setProofResult({
        success: false,
        message: `오류 발생: ${errorMessage}`,
      });
    } finally {
      setIsGeneratingProof(false);
    }
  };

  return (
    <div className={styles.faceScanContainer}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={handleBack}>
          ← 뒤로가기
        </button>
        <h1 className={styles.title}>얼굴 스캔</h1>
        {selectedUserData && (
          <div className={styles.selectedUser}>
            검증 대상: <strong>{selectedUserData.userName}</strong>
          </div>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.videoSection}>
          <VideoStream
            key={videoKey}
            onFeaturesExtracted={handleFeaturesExtracted}
            onProgressChange={handleProgressChange}
            onError={handleError}
          />
        </div>

        <div className={styles.progressSection}>
          <ScanProgressComponent progress={scanProgress} />
        </div>

        {error && (
          <div className={styles.errorSection}>
            <p className={styles.errorMessage}>{error}</p>
            <button className={styles.retryButton} onClick={handleRetry}>
              다시 시도
            </button>
          </div>
        )}

        {isLoading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingSpinner} />
            <p className={styles.loadingText}>처리 중...</p>
          </div>
        )}

        {extractedData && scanProgress.stage === "completed" && !isLoading && (
          <div className={styles.resultSection}>
            <h2 className={styles.resultTitle}>스캔 결과</h2>
            <FeatureDisplay
              normalizedFeatures={extractedData.normalizedFeatures}
              scaledFeatures={extractedData.scaledFeatures}
              showDetails={true}
            />
            <div className={styles.actionButtons}>
              <button
                className={styles.primaryButton}
                onClick={handleCompareWithDB}
                disabled={isGeneratingProof}
              >
                {isGeneratingProof ? "Proof 생성 중..." : "정부 DB와 비교"}
              </button>
              <button className={styles.secondaryButton} onClick={handleRetry}>
                다시 스캔
              </button>
            </div>

            {isGeneratingProof && (
              <div className={styles.loadingOverlay}>
                <div className={styles.loadingSpinner} />
                <p className={styles.loadingText}>Proof 생성 중...</p>
              </div>
            )}

            {proofResult && (
              <div
                className={`${styles.proofResult} ${
                  proofResult.success ? styles.success : styles.failure
                }`}
              >
                <h3 className={styles.proofResultTitle}>
                  {proofResult.success ? "✓ 검증 성공" : "✗ 검증 실패"}
                </h3>
                <p className={styles.proofResultMessage}>
                  {proofResult.message}
                </p>
                {proofResult.proofData && (
                  <details className={styles.proofDetails}>
                    <summary>Proof 데이터 보기</summary>
                    <pre className={styles.proofData}>
                      {proofResult.proofData}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
