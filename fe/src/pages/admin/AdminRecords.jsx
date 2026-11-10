import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table, Tag, Button, Select, Card, Space, Typography, Input, message, Spin, Empty
} from "antd";
import {
  EyeOutlined, SearchOutlined, FileTextOutlined, CheckCircleOutlined,
  ClockCircleOutlined, ExclamationCircleOutlined, LockOutlined
} from "@ant-design/icons";
import { evaluationService } from "../../services/evaluationService";
import { evaluationPeriodService } from "../../services/evaluationPeriodService";
import styles from "./AdminRecords.module.css";

const { Title, Text } = Typography;

const STATUS_MAP = {
  DRAFT: { label: "Đang tự chấm", color: "processing", icon: <ClockCircleOutlined /> },
  PENDING_REVIEW: { label: "Chờ thẩm định", color: "warning", icon: <FileTextOutlined /> },
  SUPPLEMENT_REQUESTED: { label: "Yêu cầu bổ sung", color: "error", icon: <ExclamationCircleOutlined /> },
  SUPPLEMENT_SUBMITTED: { label: "Đã nộp bổ sung", color: "orange", icon: <FileTextOutlined /> },
  SUPPLEMENT_EXPIRED: { label: "Hết hạn bổ sung", color: "default", icon: <LockOutlined /> },
  FINALIZED: { label: "Đã chốt", color: "success", icon: <CheckCircleOutlined /> },
};

export default function AdminRecords() {
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState(null);
  const [search, setSearch] = useState("");

  // Load periods
  useEffect(() => {
    (async () => {
      try {
        const res = await evaluationPeriodService.getEvaluationPeriods();
        const items = res?.items || [];
        setPeriods(items);
        if (items.length > 0) setSelectedPeriodId(items[0].id);
      } catch {
        message.error("Lỗi tải kỳ thi đua");
      }
    })();
  }, []);

  // Load evaluations when filters change
  useEffect(() => {
    if (!selectedPeriodId) return;
    fetchEvaluations();
  }, [selectedPeriodId, statusFilter, page, pageSize]);

  const fetchEvaluations = async () => {
    try {
      setLoading(true);
      const params = {
        periodId: selectedPeriodId,
        page,
        pageSize,
      };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;

      const res = await evaluationService.getAdminEvaluations(params);
      setEvaluations(res?.items || []);
      setTotal(res?.total || 0);
    } catch (err) {
      message.error(err?.message || "Lỗi tải danh sách hồ sơ");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchEvaluations();
  };

  // Stats
  const countByStatus = (st) => evaluations.filter((e) => e.status === st).length;

  // Table columns
  const columns = [
    {
      title: "STT",
      key: "stt",
      width: 60,
      align: "center",
      render: (_, __, idx) => (page - 1) * pageSize + idx + 1,
    },
    {
      title: "Đơn vị",
      key: "unit",
      render: (_, record) => (
        <div>
          <div className={styles.unitName}>{record.unit?.name || "—"}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.unit?.code}</Text>
        </div>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 180,
      render: (status) => {
        const conf = STATUS_MAP[status] || { label: status, color: "default" };
        return <Tag icon={conf.icon} color={conf.color}>{conf.label}</Tag>;
      },
    },
    {
      title: "Điểm tự chấm",
      key: "selfTotal",
      width: 120,
      align: "center",
      render: (_, record) => (
        <span className={styles.scoreCell} style={{ color: "#1677ff" }}>
          {record.selfTotalScore ?? "—"}
        </span>
      ),
    },
    {
      title: "Điểm Admin",
      key: "adminTotal",
      width: 120,
      align: "center",
      render: (_, record) => (
        <span className={styles.scoreCell} style={{ color: "#722ed1" }}>
          {record.adminTotalScore ?? "—"}
        </span>
      ),
    },
    {
      title: "Xếp loại",
      key: "classification",
      width: 120,
      align: "center",
      render: (_, record) => {
        if (!record.classification) return "—";
        const labels = { EXCELLENT: "Xuất sắc", GOOD: "Tốt", FAIR: "Khá", AVERAGE: "TB", POOR: "Yếu" };
        const colors = { EXCELLENT: "green", GOOD: "blue", FAIR: "gold", AVERAGE: "default", POOR: "red" };
        return <Tag color={colors[record.classification]}>{labels[record.classification]}</Tag>;
      },
    },
    {
      title: "Hành động",
      key: "action",
      width: 140,
      align: "center",
      render: (_, record) => (
        <Button
          type="primary"
          ghost
          icon={<EyeOutlined />}
          onClick={() => navigate(`/admin/records/${record.id}`)}
        >
          Thẩm định
        </Button>
      ),
    },
  ];

  return (
    <div className={styles.pageContainer}>
      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <Select
          value={selectedPeriodId}
          onChange={(val) => { setSelectedPeriodId(val); setPage(1); }}
          style={{ width: 300 }}
          size="large"
          placeholder="Chọn kỳ thi đua"
        >
          {periods.map((p) => (
            <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
          ))}
        </Select>

        <Select
          value={statusFilter}
          onChange={(val) => { setStatusFilter(val); setPage(1); }}
          style={{ width: 200 }}
          size="large"
          placeholder="Trạng thái"
          allowClear
        >
          {Object.entries(STATUS_MAP).map(([key, conf]) => (
            <Select.Option key={key} value={key}>{conf.label}</Select.Option>
          ))}
        </Select>

        <Input
          placeholder="Tìm đơn vị..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onPressEnter={handleSearch}
          style={{ width: 250, borderRadius: 8 }}
          size="large"
          allowClear
        />

        <Button type="primary" size="large" onClick={handleSearch} style={{ borderRadius: 8 }}>
          Tìm kiếm
        </Button>
      </div>

      {/* Stats row */}
      <div className={styles.statsRow}>
        <Card className={styles.statCard}>
          <div className={styles.statLabel}>Tổng hồ sơ</div>
          <div className={styles.statValue}>{total}</div>
        </Card>
        <Card className={styles.statCard}>
          <div className={styles.statLabel}>Chờ thẩm định</div>
          <div className={styles.statValue} style={{ color: "#faad14" }}>
            {countByStatus("PENDING_REVIEW")}
          </div>
        </Card>
        <Card className={styles.statCard}>
          <div className={styles.statLabel}>Yêu cầu bổ sung</div>
          <div className={styles.statValue} style={{ color: "#ff4d4f" }}>
            {countByStatus("SUPPLEMENT_REQUESTED")}
          </div>
        </Card>
        <Card className={styles.statCard}>
          <div className={styles.statLabel}>Đã chốt</div>
          <div className={styles.statValue} style={{ color: "#52c41a" }}>
            {countByStatus("FINALIZED")}
          </div>
        </Card>
      </div>

      {/* Table */}
      <div className={styles.tableContainer}>
        <Table
          columns={columns}
          dataSource={evaluations}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            showTotal: (t) => `Tổng ${t} hồ sơ`,
            showSizeChanger: true,
          }}
        />
      </div>
    </div>
  );
}
