import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Layout, Menu, Avatar, Dropdown, Badge, Button } from "antd";
import {
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import styles from "./AdminLayout.module.css";

const { Header, Sider, Content } = Layout;

export default function UnitLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Lấy tên trang hiện tại để hiển thị lên Header
  const pageTitles = {
    "/unit/evaluation": "Bảng điểm & Hồ sơ thi đua",
    "/unit/notifications": "Thông báo",
  };
  const currentTitle = pageTitles[location.pathname] || "";

  const menuItems = [
    { key: "/unit/evaluation", icon: <TrophyOutlined />, label: "Hồ sơ thi đua" },
    { key: "/unit/notifications", icon: <BellOutlined />, label: "Thông báo" },
  ];

  const userMenu = {
    items: [
      { key: "logout", icon: <LogoutOutlined />, label: "Đăng xuất", onClick: () => logout() },
    ],
  };

  return (
    <Layout className={styles.layoutContainer}>
      {/* SIDEBAR TRẮNG */}
      <Sider trigger={null} collapsible collapsed={collapsed} width={280} className={styles.sider}>
        <div className={styles.siderHeader}>
          {!collapsed && <span className={styles.logoText}>CƠ SỞ ĐOÀN</span>}
          <button className={styles.collapseBtn} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>
        </div>

        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout>
        {/* HEADER TRẮNG */}
        <Header className={styles.header}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#111" }}>
            {currentTitle}
          </h2>

          {/* Bên phải */}
          <div className={styles.headerRight}>
            <Button
              type="dashed"
              size="small"
              onClick={() => navigate("/admin/dashboard")}
              style={{ color: "#fa8c16", borderColor: "#fa8c16" }}
            >
              Chuyển sang ADMIN
            </Button>

            <Badge count={0} size="small">
              <Button type="text" icon={<BellOutlined style={{ fontSize: 18, color: "#555" }} />} onClick={() => navigate("/unit/notifications")} />
            </Badge>

            <Dropdown menu={userMenu} placement="bottomRight" trigger={["click"]}>
              <div className={styles.userInfo}>
                <Avatar size="small" icon={<UserOutlined />} />
                <span>{user?.fullName || user?.username}</span>
              </div>
            </Dropdown>
          </div>
        </Header>

        {/* CONTENT */}
        <Content className={styles.content}>
          <div className={styles.innerContent}>
            <Outlet />
          </div>
        </Content>

      </Layout>
    </Layout>
  );
}
