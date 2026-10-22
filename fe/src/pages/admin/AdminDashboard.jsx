import { useEffect, useState } from "react";
import { Row, Col, Card, Statistic, Spin, message, Progress, Table, Tag, Typography } from "antd";
import { 
  BankOutlined, CheckCircleOutlined, ClockCircleOutlined, SyncOutlined,
  TrophyOutlined, WarningOutlined
} from "@ant-design/icons";
import { dashboardService } from "../../services/dashboardService";
import styles from "./AdminDashboard.module.css";

const { Title } = Typography;

// Dữ liệu giả cho Bảng xếp hạng
const leaderboardData = [
  { key: "1", rank: 1, unitName: "Đoàn trường ĐH Sài Gòn", selfScore: 285, adminScore: 280, status: "Đã chốt" },
  { key: "2", rank: 2, unitName: "Quận đoàn 1", selfScore: 270, adminScore: 270, status: "Đã chốt" },
  { key: "3", rank: 3, unitName: "Đoàn trường ĐH Bách Khoa", selfScore: 260, adminScore: null, status: "Chờ duyệt" },
  { key: "4", rank: 4, unitName: "Huyện đoàn Củ Chi", selfScore: 250, adminScore: 245, status: "Đã chốt" },
  { key: "5", rank: 5, unitName: "Đoàn trường ĐH Kinh tế", selfScore: 240, adminScore: null, status: "Chờ duyệt" },
];

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [deductions, setDeductions] = useState([]);
  const currentPeriodId = "period-2026"; 

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Gọi song song 2 API để tối ưu tốc độ
        const [statsRes, deductionsRes] = await Promise.all([
          dashboardService.getDashboardStats(currentPeriodId),
          dashboardService.getCriteriaDeductions(currentPeriodId)
        ]);
        
        setData(statsRes);
        setDeductions(deductionsRes.items || []);
      } catch (error) {
        message.error("Lỗi khi tải dữ liệu Dashboard");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div style={{ textAlign: "center", marginTop: 100 }}><Spin size="large" /></div>;
  }

  // Cột cho Bảng xếp hạng
  const leaderboardColumns = [
    { 
      title: "Hạng", dataIndex: "rank", key: "rank", width: 80,
      render: (rank) => {
        if (rank === 1) return <TrophyOutlined style={{ color: "#fadb14", fontSize: 18 }} />;
        if (rank === 2) return <TrophyOutlined style={{ color: "#bfbfbf", fontSize: 18 }} />;
        if (rank === 3) return <TrophyOutlined style={{ color: "#d48806", fontSize: 18 }} />;
        return <strong>{rank}</strong>;
      }
    },
    { title: "Tên Đơn vị", dataIndex: "unitName", key: "unitName" },
    { title: "Điểm tự chấm", dataIndex: "selfScore", key: "selfScore", align: "center" },
    { title: "Điểm thẩm định", dataIndex: "adminScore", key: "adminScore", align: "center", render: (val) => val || "-" },
    { 
      title: "Trạng thái", dataIndex: "status", key: "status",
      render: (status) => <Tag color={status === "Đã chốt" ? "green" : "gold"}>{status.toUpperCase()}</Tag>
    },
  ];

  // Cột cho Bảng Tiêu chí bị trừ điểm
  const deductionColumns = [
    { title: "Mã", dataIndex: "code", key: "code", width: 80 },
    { title: "Tên Tiêu chí", dataIndex: "name", key: "name" },
    { 
      title: "Số đơn vị bị trừ", dataIndex: "unitsDeducted", key: "unitsDeducted", align: "center",
      render: (val) => <Tag color="volcano">{val} đơn vị</Tag>
    },
    { 
      title: "Tổng điểm bị trừ", dataIndex: "totalPointsDeducted", key: "totalPointsDeducted", align: "center",
      render: (val) => <strong style={{ color: "#cf1322" }}>-{val} đ</strong>
    },
  ];

  return (
    <div className={styles.dashboardContainer}>
      <h2 className={styles.pageTitle}>Tổng quan tiến độ thi đua</h2>
      
      {/* 1. CÁC THẺ THỐNG KÊ */}
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className={styles.statCard}>
            <Statistic title="Tổng số Đơn vị" value={data?.totalUnits || 0} prefix={<BankOutlined style={{ color: "#1677ff" }} />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className={styles.statCard}>
            <Statistic title="Đã nộp hồ sơ" value={data?.submittedCount || 0} valueStyle={{ color: "#52c41a" }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className={styles.statCard}>
            <Statistic title="Chưa nộp" value={data?.notSubmittedCount || 0} valueStyle={{ color: "#faad14" }} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} className={styles.statCard}>
            <Statistic title="Yêu cầu bổ sung" value={data?.supplementPendingCount || 0} valueStyle={{ color: "#ff4d4f" }} prefix={<SyncOutlined spin />} />
          </Card>
        </Col>
      </Row>

      {/* 2. TIẾN TRÌNH & XẾP HẠNG */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={8}>
          <Card bordered={false} className={styles.progressCard} title="Tiến độ nộp bài">
            <div className={styles.progressWrapper}>
              <Progress type="dashboard" percent={data?.progressPercent || 0} strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }} format={(percent) => `${percent}%`} />
              <div className={styles.progressText}>
                <p>Đã nộp: <strong>{data?.submittedCount || 0}</strong> / {data?.totalUnits || 0} đơn vị</p>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card bordered={false} title="Bảng xếp hạng Top 5 Đơn vị" className={styles.tableCard}>
            <Table columns={leaderboardColumns} dataSource={leaderboardData} pagination={false} size="middle" />
          </Card>
        </Col>
      </Row>

      {/* 3. TIÊU CHÍ BỊ TRỪ ĐIỂM NHIỀU NHẤT (MỚI THÊM) */}
      <Row style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card 
            bordered={false} 
            title={<><WarningOutlined style={{ color: '#faad14', marginRight: 8 }} /> Top Tiêu chí bị trừ điểm nhiều nhất</>}
            className={styles.tableCard}
          >
            <Table 
              columns={deductionColumns} 
              dataSource={deductions} 
              pagination={false} 
              size="middle"
              rowKey="criterionId"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}