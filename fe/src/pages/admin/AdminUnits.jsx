import { useEffect, useState } from "react";
import { Table, message, Space, Button, Tooltip, Modal, Form, Input, Select, Tag } from "antd";
import { EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { unitService } from "../../services/unitService";
import PageHeader from "../../components/common/PageHeader";
import styles from "./AdminUnits.module.css";

// Hàm render Tag cho Loại đơn vị
const renderUnitType = (type) => {
  switch (type) {
    case "CONG_AN_QUAN_HUYEN": return <Tag color="blue">Công an Quận/Huyện</Tag>;
    case "PHONG_NGHIEP_VU": return <Tag color="green">Phòng Nghiệp vụ</Tag>;
    case "DON_VI_TRUC_THUOC": return <Tag color="orange">Đơn vị Trực thuộc</Tag>;
    default: return <Tag>Khác</Tag>;
  }
};

export default function AdminUnits() {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20); 
  const [searchText, setSearchText] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchUnits = async (currentPage = page, currentPageSize = pageSize, search = searchText) => {
    try {
      setLoading(true);
      const res = await unitService.getUnits({ page: currentPage, pageSize: currentPageSize, search });
      setUnits(res.items || []);
      setTotal(res.total || 0);
    } catch (error) {
      message.error("Lỗi khi tải danh sách đơn vị");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits(1, pageSize, "");
  }, []);

  const handleSearch = (value) => {
    setSearchText(value);
    setPage(1);
    fetchUnits(1, pageSize, value);
  };

  const handleSaveUnit = async (values) => {
    try {
      await unitService.createUnit(values);
      message.success("Thêm đơn vị thành công");
      setIsModalOpen(false);
      form.resetFields();
      fetchUnits(1, pageSize, ""); 
    } catch (error) {
      message.error("Thêm đơn vị thất bại");
    }
  };

  const columns = [
    { 
      title: "Mã Đơn vị", 
      dataIndex: "code", 
      key: "code", 
      render: (text) => <strong>{text}</strong> 
    },
    { 
      title: "Tên Đơn vị", 
      dataIndex: "name", 
      key: "name" 
    },
    { 
      title: "Loại Đơn vị", 
      dataIndex: "unitType", 
      key: "unitType",
      render: (type) => renderUnitType(type)
    },
    {
      title: "Hành động",
      key: "action",
      align: "center",
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Sửa">
            <Button type="text" icon={<EditOutlined style={{ color: "#1677ff" }} />} />
          </Tooltip>
          <Tooltip title="Xóa">
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.pageContainer}>
      <div className={styles.toolbar}>
        <PageHeader 
          title="Quản lý Đơn vị" 
          searchPlaceholder="Tìm theo mã hoặc tên đơn vị..."
          onSearch={handleSearch}
          onAdd={() => setIsModalOpen(true)}
          addButtonText="Thêm Đơn vị"
        />
      </div>

      <div className={styles.tableContainer}>
        <Table 
          columns={columns} 
          dataSource={units} 
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],
            onChange: (p, s) => {
              setPage(p);
              setPageSize(s);
              fetchUnits(p, s, searchText);
            },
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} đơn vị`
          }}
        />
      </div>

      <Modal
        title="Thêm Đơn vị mới"
        open={isModalOpen}
        onCancel={() => { setIsModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        okText="Lưu đơn vị"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" onFinish={handleSaveUnit} style={{ marginTop: 20 }}>
          <Form.Item name="code" label="Mã đơn vị" rules={[{ required: true, message: "Vui lòng nhập mã đơn vị!" }]}>
            <Input placeholder="VD: COSO-35" />
          </Form.Item>
          <Form.Item name="name" label="Tên đơn vị" rules={[{ required: true, message: "Vui lòng nhập tên đơn vị!" }]}>
            <Input placeholder="VD: Đoàn Công an Quận 1" />
          </Form.Item>
          <Form.Item name="unitType" label="Loại đơn vị" initialValue="CONG_AN_QUAN_HUYEN" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="CONG_AN_QUAN_HUYEN">Công an Quận/Huyện</Select.Option>
              <Select.Option value="PHONG_NGHIEP_VU">Phòng Nghiệp vụ</Select.Option>
              <Select.Option value="DON_VI_TRUC_THUOC">Đơn vị Trực thuộc</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}