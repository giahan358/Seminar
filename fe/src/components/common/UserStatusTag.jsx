import { Tag } from "antd";
import { CheckCircleOutlined, LockOutlined } from "@ant-design/icons";

export default function UserStatusTag({ isActive }) {
  if (isActive) {
    return <Tag color="success" icon={<CheckCircleOutlined />}>Hoạt động</Tag>;
  }
  return <Tag color="error" icon={<LockOutlined />}>Bị khóa</Tag>;
}