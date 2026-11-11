import { useState } from "react";
import { Form, Input, Button, Card, Typography, message, Alert } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import styles from "./LoginPage.module.css"; 
import { applyApiFieldErrors } from "../../services/apiError";

const { Title } = Typography;

export default function LoginPage() {
  const [form] = Form.useForm();
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  if (user) {
    const from = location.state?.from?.pathname || (user.role === "ADMIN" ? "/admin/dashboard" : "/unit/records");
    return <Navigate to={from} replace />;
  }

  /** Gửi thông tin đăng nhập thật, giữ điều hướng theo trạng thái user và gắn lỗi DTO đã dịch vào đúng ô thay vì chỉ hiện toast */
  const onFinish = async (values) => {
    setLoading(true);
    try {
      const loggedUser = await login(values.username, values.password);
      if (loggedUser.mustChangePassword) {
        navigate("/change-password", { replace: true });
      } else {
        const defaultRoute = loggedUser.role === "ADMIN" ? "/admin/dashboard" : "/unit/records";
        const from = location.state?.from?.pathname || defaultRoute;
        navigate(from, { replace: true });
      }
    } catch (error) {
      applyApiFieldErrors(form, error, ["username", "password"]);
      message.error(error.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <div className={styles.header}>
          <Title level={3}>Đăng Nhập Hệ Thống</Title>
        </div>

        {location.state?.message && (
          <Alert message={location.state.message} type="warning" showIcon className={styles.alert} />
        )}

        <Form form={form} name="login" onFinish={onFinish} size="large">
          <Form.Item name="username" rules={[{ required: true, message: "Vui lòng nhập tên đăng nhập!" }]}>
            <Input prefix={<UserOutlined />} placeholder="Tên đăng nhập (vd: coso01)" />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: "Vui lòng nhập mật khẩu!" }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu (vd: coso123)" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" className={styles.submitBtn} loading={loading}>
              Đăng nhập
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
