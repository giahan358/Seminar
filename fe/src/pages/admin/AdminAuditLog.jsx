import { useEffect, useState } from "react";
import { Table, message, Tag, Card, Segmented } from "antd";
import { auditLogService } from "../../services/auditLogService";
import PageHeader from "../../components/common/PageHeader";
import styles from "./AdminAuditLog.module.css";
import { Line } from "@ant-design/charts";

export default function AdminAuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20); 

  // State cho biểu đồ
  const [chartData, setChartData] = useState([]);
  const [timeRange, setTimeRange] = useState("7d");

  // --- HÀM GỌI API LẤY BẢNG ---
  const fetchLogs = async (currentPage = page, currentPageSize = pageSize) => {
    try {
      setLoading(true);
      const res = await auditLogService.getAuditLogs({ page: currentPage, pageSize: currentPageSize });
      setLogs(res.items || []);
      setTotal(res.total || 0);
    } catch (error) {
      message.error("Lỗi khi tải lịch sử thao tác");
    } finally {
      setLoading(false);
    }
  };

  // --- HÀM GỌI API LẤY BIỂU ĐỒ ---
  const fetchChartData = async (range) => {
    try {
      const res = await auditLogService.getAuditLogStats({ range });
    console.log("Dữ liệu biểu đồ nhận được:", res.items);
      setChartData(res.items || []);
    } catch (error) {
      console.error("Lỗi tải biểu đồ");
    }
  };

  useEffect(() => {
    fetchLogs(1, 20);
    fetchChartData("7d");
  }, []);

  const handleRangeChange = (value) => {
    setTimeRange(value);
    fetchChartData(value);
  };

  // --- CẤU HÌNH CỘT CHO BẢNG ---
  const columns = [
    { title: "Thời gian", dataIndex: "createdAt", key: "createdAt", width: 180, render: (date) => new Date(date).toLocaleString("vi-VN") },
    { title: "Người thực hiện", dataIndex: "actorName", key: "actorName", render: (text) => <strong>{text}</strong> },
    {
      title: "Hành động",
      dataIndex: "action",
      key: "action",
      render: (action) => {
        let color = "blue";
        
        const actionLower = action.toLowerCase(); 

        if (actionLower.includes("xóa")) color = "red";          
        if (actionLower.includes("thêm")) color = "green";         
        if (actionLower.includes("cập nhật") || actionLower.includes("sửa")) color = "orange"; 
        if (actionLower.includes("đổi trạng thái")) color = "purple"; 

        return <Tag color={color}>{action.toUpperCase()}</Tag>;
      },
    },


    { title: "Đối tượng", dataIndex: "entity", key: "entity" },
    { title: "Chi tiết", dataIndex: "detail", key: "detail", ellipsis: true },
    { title: "Địa chỉ IP", dataIndex: "ipAddress", key: "ipAddress", render: (ip) => <span style={{ color: "#888" }}>{ip}</span> },
  ];

  // --- CẤU HÌNH CHO BIỂU ĐỒ ĐƯỜNG ---
  const chartConfig = {
    data: chartData,
    xField: "label", // Trục ngang
    yField: "count", // Trục dọc (số lượng)
    height: 280,
    smooth: true, // Vẽ đường cong mượt mà
    color: "#52c41a", // Màu xanh lá (giống ảnh Liên Quân)
    point: {
      size: 5,
      shape: "circle",
      style: { fill: "#fff", stroke: "#52c41a", lineWidth: 2 } // Tâm trắng viền xanh
    },
    tooltip: {
      title: (d) => `Mốc: ${d.label}`,
    },
    xAxis: {
      line: null, 
    },
    yAxis: {
      grid: {
        line: { style: { stroke: "#f0f0f0", lineDash: [4, 4] } } 
      }
    }
  };

  return (
    <div className={styles.pageContainer}>
      
      {/* 1. BIỂU ĐỒ THỐNG KÊ */}
      <Card 
        bordered={false} 
        className={styles.chartCard}
        title={<span style={{ fontSize: "18px", fontWeight: 700, color: "#111" }}>Biểu đồ lượng thao tác</span>}

        extra={
          <Segmented 
            options={[
              { label: '7 Ngày', value: '7d' },
              { label: '30 Ngày', value: '30d' },
              { label: '3 Tháng', value: '3m' },
              { label: '6 Tháng', value: '6m' },
            ]}
            value={timeRange}
            onChange={handleRangeChange}
          />
        }
      >
        <div style={{ marginTop: 20 }}>
          {/* Component Line của Ant Design Charts */}
          <Line {...chartConfig} />
        </div>
      </Card>

      {/* 2. BẢNG DỮ LIỆU */}
      <div className={styles.toolbar} style={{ marginTop: 24 }}>
        <PageHeader
          title={
            <span style={{ fontSize: "18px", fontWeight: 700, color: "#111" }}>
              Chi tiết lịch sử
            </span>
          }
        />
      </div>

      <div className={styles.tableContainer}>
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            onChange: (p, s) => {
              setPage(p);
              setPageSize(s);
              fetchLogs(p, s);
            },
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} bản ghi`
          }}
        />
      </div>
    </div>
  );
}