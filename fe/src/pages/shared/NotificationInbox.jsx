import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button, Typography, message, Spin, Empty, Badge, Pagination
} from "antd";
import {
  BellOutlined, CheckOutlined, ExclamationCircleOutlined,
  InfoCircleOutlined, ClockCircleOutlined, CheckCircleOutlined
} from "@ant-design/icons";
import { notificationService } from "../../services/notificationService";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./NotificationInbox.module.css";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/vi";

dayjs.extend(relativeTime);
dayjs.locale("vi");

const { Title, Text } = Typography;

const NOTIF_TYPE_CONFIG = {
  DEADLINE_REMINDER: { icon: <ClockCircleOutlined />, iconClass: "notifIconWarning", label: "Nhắc hạn" },
  SUPPLEMENT_REQUEST: { icon: <ExclamationCircleOutlined />, iconClass: "notifIconError", label: "Yêu cầu bổ sung" },
  SCORE_FINALIZED: { icon: <CheckCircleOutlined />, iconClass: "notifIconSuccess", label: "Chốt điểm" },
  ADMIN_FEEDBACK: { icon: <InfoCircleOutlined />, iconClass: "notifIconInfo", label: "Phản hồi Admin" },
  UNIT_REPLY: { icon: <InfoCircleOutlined />, iconClass: "notifIconInfo", label: "Phản hồi đơn vị" },
  SYSTEM: { icon: <BellOutlined />, iconClass: "notifIconInfo", label: "Hệ thống" },
};

export default function NotificationInbox() {
  const { role } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [filter, setFilter] = useState("all"); // "all" | "unread" | "read"

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, pageSize };
      if (filter === "unread") params.isRead = false;
      if (filter === "read") params.isRead = true;

      const res = await notificationService.getNotifications(params);
      setNotifications(res?.items || []);
      setTotal(res?.total || 0);
    } catch (err) {
      message.error(err?.message || "Lỗi tải thông báo");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notifId) => {
    try {
      await notificationService.markAsRead(notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
      );
    } catch { /* silent */ }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      message.success("Đã đánh dấu tất cả đã đọc");
      fetchNotifications();
    } catch (err) {
      message.error(err?.message || "Lỗi");
    }
  };

  const handleClickNotif = async (notif) => {
    // Mark as read
    if (!notif.isRead) {
      await handleMarkAsRead(notif.id);
    }
    // Navigate to related evaluation if available
    if (notif.evaluationId) {
      if (role === "ADMIN") {
        navigate(`/admin/records/${notif.evaluationId}`);
      } else {
        navigate("/unit/evaluation");
      }
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className={styles.pageContainer}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Thông báo
            {unreadCount > 0 && (
              <Badge count={unreadCount} style={{ marginLeft: 12 }} />
            )}
          </Title>
        </div>
        <Button
          type="link"
          icon={<CheckOutlined />}
          onClick={handleMarkAllAsRead}
          disabled={unreadCount === 0}
        >
          Đánh dấu tất cả đã đọc
        </Button>
      </div>

      {/* Filter tabs */}
      <div className={styles.tabRow}>
        {[
          { key: "all", label: "Tất cả" },
          { key: "unread", label: "Chưa đọc" },
          { key: "read", label: "Đã đọc" },
        ].map((tab) => (
          <Button
            key={tab.key}
            type={filter === tab.key ? "primary" : "default"}
            className={filter === tab.key ? styles.tabBtnActive : styles.tabBtn}
            onClick={() => { setFilter(tab.key); setPage(1); }}
            size="middle"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Notification list */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : notifications.length === 0 ? (
        <div className={styles.emptyContainer}>
          <Empty description={filter === "unread" ? "Không có thông báo chưa đọc" : "Không có thông báo nào"} />
        </div>
      ) : (
        <>
          <div className={styles.notifList}>
            {notifications.map((notif) => {
              const typeConf = NOTIF_TYPE_CONFIG[notif.type] || NOTIF_TYPE_CONFIG.SYSTEM;
              return (
                <div
                  key={notif.id}
                  className={`${styles.notifCard} ${notif.isRead ? styles.notifCardRead : styles.notifCardUnread}`}
                  onClick={() => handleClickNotif(notif)}
                >
                  <div className={`${styles.notifIcon} ${styles[typeConf.iconClass]}`}>
                    {typeConf.icon}
                  </div>

                  <div className={styles.notifBody}>
                    <div className={styles.notifTitle}>{notif.title || typeConf.label}</div>
                    <div className={styles.notifContent}>{notif.content || notif.message}</div>
                    <div className={styles.notifTime}>{dayjs(notif.createdAt).fromNow()}</div>
                  </div>

                  {!notif.isRead && <div className={styles.notifDot} />}
                </div>
              );
            })}
          </div>

          {total > pageSize && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                onChange={(p) => setPage(p)}
                showTotal={(t) => `Tổng ${t} thông báo`}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
