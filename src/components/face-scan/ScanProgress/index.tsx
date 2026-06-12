import type { ScanProgress as ScanProgressType } from "../../../lib/mediapipe/types";
import styles from "./styles.module.scss";

interface ScanProgressProps {
  progress: ScanProgressType;
}

export function ScanProgress({ progress }: ScanProgressProps) {
  const getStageLabel = (stage: ScanProgressType["stage"]): string => {
    switch (stage) {
      case "idle":
        return "대기 중";
      case "detecting":
        return "얼굴 감지 중";
      case "collecting":
        return "특징값 수집 중";
      case "processing":
        return "처리 중";
      case "completed":
        return "완료";
      case "error":
        return "오류";
      default:
        return "";
    }
  };

  const getProgressColor = (stage: ScanProgressType["stage"]): string => {
    switch (stage) {
      case "completed":
        return "#333";
      case "error":
        return "#666";
      case "collecting":
      case "processing":
        return "#333";
      default:
        return "#999";
    }
  };

  return (
    <div className={styles.scanProgress}>
      <div className={styles.progressHeader}>
        <span className={styles.stageLabel}>
          {getStageLabel(progress.stage)}
        </span>
        <span className={styles.progressPercent}>
          {Math.round(progress.progress)}%
        </span>
      </div>

      <div className={styles.progressBarContainer}>
        <div
          className={styles.progressBar}
          style={{
            width: `${progress.progress}%`,
            backgroundColor: getProgressColor(progress.stage),
          }}
        />
      </div>

      <p className={styles.message}>{progress.message}</p>

      {progress.stage === "collecting" && (
        <div className={styles.frameInfo}>
          <span>
            {progress.collectedFrames} / {progress.totalFrames} 프레임
          </span>
        </div>
      )}
    </div>
  );
}
