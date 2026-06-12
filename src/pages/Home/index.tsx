import User from "../../components/user";
import { governmentDB } from "../../government/UserInfo";
import styles from "./styles.module.scss";

export const Home = () => {
  return (
    <div className={styles.homeContainer}>
      {governmentDB.map((user) => (
        <User key={user.userId} userName={user.userName} userId={user.userId} />
      ))}
    </div>
  );
};
