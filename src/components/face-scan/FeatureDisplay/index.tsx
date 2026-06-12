import type { FaceFeatures, ScaledFeatures } from "../../../types/face";
import styles from "./styles.module.scss";

interface FeatureDisplayProps {
  normalizedFeatures?: FaceFeatures;
  scaledFeatures?: ScaledFeatures;
  showDetails?: boolean;
}

export function FeatureDisplay({
  normalizedFeatures,
  scaledFeatures,
  showDetails = false,
}: FeatureDisplayProps) {
  if (!normalizedFeatures && !scaledFeatures) {
    return null;
  }

  const featureLabels = [
    "코 길이",
    "입 너비",
    "눈-턱 거리",
    "눈-입 거리",
    "코 너비",
    "안쪽 눈 거리",
    "눈썹 거리",
    "얼굴 너비",
    "턱 너비",
    "윗입술",
  ];

  return (
    <div className={styles.featureDisplay}>
      {showDetails && (
        <>
          {normalizedFeatures && (
            <div className={styles.featuresSection}>
              <h3 className={styles.title}>정규화된 특징값</h3>
              <div className={styles.featuresList}>
                {Object.entries(normalizedFeatures).map(
                  ([key, value], index) => (
                    <div key={key} className={styles.featureItem}>
                      <span className={styles.featureLabel}>
                        {featureLabels[index]}
                      </span>
                      <span className={styles.featureValue}>
                        {value.toFixed(4)}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {scaledFeatures && (
            <div className={styles.featuresSection}>
              <h3 className={styles.title}>정수화된 특징값</h3>
              <div className={styles.scaledFeatures}>
                <code className={styles.featureArray}>
                  [{scaledFeatures.join(", ")}]
                </code>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
