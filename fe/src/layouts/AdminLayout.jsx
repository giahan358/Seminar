import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Layout, Menu, Avatar, Dropdown, Badge, Button } from "antd";
import {
  DashboardOutlined,
  TeamOutlined,
  BankOutlined,
  SettingOutlined,
  FileTextOutlined,
  HistoryOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import styles from "./AdminLayout.module.css";

const { Header, Sider, Content } = Layout;

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Lấy tên trang hiện tại để hiển thị lên Header
  const pageTitles = {
    "/admin/dashboard": "Tổng quan",
    "/admin/users": "Quản lý Tài khoản",
    "/admin/units": "Quản lý Đơn vị",
    "/admin/config": "Cấu hình Kỳ thi",
    "/admin/records": "Xử lý Hồ sơ",
    "/admin/audit-log": "Lịch sử thao tác",
  };
  const currentTitle = pageTitles[location.pathname] || "";

  const menuItems = [
    { key: "/admin/dashboard", icon: <DashboardOutlined />, label: "Tổng quan" },
    { key: "/admin/users", icon: <TeamOutlined />, label: "Quản lý Tài khoản" },
    { key: "/admin/units", icon: <BankOutlined />, label: "Quản lý Đơn vị" },
    { key: "/admin/config", icon: <SettingOutlined />, label: "Cấu hình Kỳ thi" },
    { key: "/admin/records", icon: <FileTextOutlined />, label: "Xử lý Hồ sơ" },
    { key: "/admin/audit-log", icon: <HistoryOutlined />, label: "Lịch sử thao tác" },
  ];

  const userMenu = {
    items: [
      { key: "logout", icon: <LogoutOutlined />, label: "Đăng xuất", onClick: () => logout() },
    ],
  };

  return (
    <Layout className={styles.layoutContainer}>
      {/* SIDEBAR TRẮNG */}
      <Sider trigger={null} collapsible collapsed={collapsed} width={300} className={styles.sider}>
        <div className={styles.siderHeader}>
          {!collapsed && <span className={styles.logoText}>HỆ THỐNG KPI</span>}
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

          {/* Bên phải*/}
          <div className={styles.headerRight}>
            <Badge count={5} size="small">
              <Button type="text" icon={<BellOutlined style={{ fontSize: 18, color: "#555" }} />} />
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