import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User as UserIcon } from "lucide-react";
import styles from "./styles.module.scss";

interface UserProps {
  userName: string;
  userId: number;
}

export default function User({ userName, userId }: UserProps) {
  const navigate = useNavigate();
  const [isPressed, setIsPressed] = useState(false);

  const handlePress = async () => {
    try {
      // 브라우저에 실제 카메라 권한 요청 (브라우저가 자동으로 권한 팝업 표시)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
      });

      // 권한이 허용되면 스트림 종료하고 페이지 이동 (userId 전달)
      stream.getTracks().forEach((track) => track.stop());
      navigate(`/face-scan?userId=${userId}`);
    } catch (error) {
      // 권한 거부 또는 오류 발생
      if (error instanceof Error) {
        if (
          error.name === "NotAllowedError" ||
          error.name === "PermissionDeniedError"
        ) {
          // 권한이 거부된 경우 - 사용자가 브라우저 팝업에서 거부했음
          console.warn(
            "카메라 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요."
          );
          // 페이지 이동하지 않음
        } else if (
          error.name === "NotFoundError" ||
          error.name === "DevicesNotFoundError"
        ) {
          console.error("카메라를 찾을 수 없습니다.");
        } else {
          console.error("카메라 접근 오류:", error.message);
        }
      } else {
        console.error("알 수 없는 오류:", error);
      }
    }
  };

  return (
    <button
      className={`${styles.container} ${isPressed ? styles.pressed : ""}`}
      onClick={handlePress}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      <UserIcon size={24} color="#000000" strokeWidth={2} />
      <span className={styles.userName}>{userName}</span>
    </button>
  );
}
