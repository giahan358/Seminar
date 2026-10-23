import { useEffect, useState } from "react";
import { Table, message, Space, Button, Tooltip, Modal, Form, Input, Select, Tag } from "antd";
import { EditOutlined, LockOutlined, UnlockOutlined } from "@ant-design/icons";
import { userService } from "../../services/userService";
import PageHeader from "../../components/common/PageHeader";
import UserStatusTag from "../../components/common/UserStatusTag";
import styles from "./AdminUsers.module.css"; 

export default function AdminUsers() {
  // --- STATE QUẢN LÝ DỮ LIỆU ---
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20); 
  const [searchText, setSearchText] = useState("");

  // --- STATE QUẢN LÝ MODAL ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  // --- GỌI API LẤY DANH SÁCH ---
  const fetchUsers = async (currentPage = page, currentPageSize = pageSize, search = searchText) => {
    try {
      setLoading(true);
      const res = await userService.getUsers({ 
        page: currentPage, 
        pageSize: currentPageSize, 
        search 
      });
      setUsers(res.items || []);
      setTotal(res.total || 0);
    } catch (error) {
      message.error("Lỗi khi tải danh sách tài khoản");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1, pageSize, "");
  }, []);

  // --- XỬ LÝ TÌM KIẾM ---
  const handleSearch = (value) => {
    setSearchText(value);
    setPage(1); // Reset về trang 1 khi tìm kiếm
    fetchUsers(1, pageSize, value);
  };

  // --- XỬ LÝ KHÓA / MỞ KHÓA ---
  const handleToggleStatus = (record) => {
    Modal.confirm({
      title: "Xác nhận đổi trạng thái",
      content: `Bạn có chắc muốn ${record.isActive ? "khóa" : "mở khóa"} tài khoản "${record.username}"?`,
      okText: "Đồng ý",
      cancelText: "Hủy",
      okButtonProps: { danger: record.isActive }, // Nút màu đỏ nếu là hành động khóa
      onOk: async () => {
        try {
          await userService.toggleUserStatus(record.id, !record.isActive);
          message.success(`${record.isActive ? "Khóa" : "Mở khóa"} tài khoản thành công`);
          fetchUsers(); // Load lại bảng hiện tại
        } catch (error) {
          message.error("Thao tác thất bại");
        }
      }
    });
  };

  // --- XỬ LÝ LƯU TÀI KHOẢN MỚI ---
  const handleSaveUser = async (values) => {
    try {
      await userService.createUser(values);
      message.success("Thêm tài khoản thành công");
      setIsModalOpen(false);
      form.resetFields();
      fetchUsers(1, pageSize, ""); // Quay về trang 1 để xem user mới
    } catch (error) {
      message.error(error.message || "Thêm tài khoản thất bại");
    }
  };

  // --- CẤU HÌNH CỘT CHO BẢNG ---
  const columns = [
    { 
      title: "Tên đăng nhập", 
      dataIndex: "username", 
      key: "username", 
      render: (text) => <strong>{text}</strong> 
    },
    { 
      title: "Họ và Tên", 
      dataIndex: "fullName", 
      key: "fullName" 
    },
    { 
      title: "Quyền", 
      dataIndex: "role", 
      key: "role",
      render: (role) => role === "ADMIN" ? <Tag color="blue">ADMIN</Tag> : <Tag color="purple">UNIT</Tag>
    },
    { 
      title: "Đơn vị trực thuộc", 
      dataIndex: "unitName", 
      key: "unitName", 
      render: (val) => val || <span style={{ color: "#888" }}>Toàn hệ thống</span> 
    },
    { 
      title: "Trạng thái", 
      dataIndex: "isActive", 
      key: "isActive",
      render: (isActive) => <UserStatusTag isActive={isActive} />
    },
    {
      title: "Hành động",
      key: "action",
      align: "center",
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Sửa thông tin">
            <Button 
              type="text" 
              icon={<EditOutlined style={{ color: "#1677ff" }} />} 
              onClick={() => message.info("Tính năng sửa đang được phát triển")} 
            />
          </Tooltip>
          <Tooltip title={record.isActive ? "Khóa tài khoản" : "Mở khóa"}>
            <Button 
              type="text" 
              danger={record.isActive} 
              icon={record.isActive ? <LockOutlined /> : <UnlockOutlined style={{ color: "#52c41a" }} />} 
              onClick={() => handleToggleStatus(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.pageContainer}>
      
      {/* 1. THANH CÔNG CỤ (TÌM KIẾM + THÊM MỚI) */}
      <div className={styles.toolbar}>
        <PageHeader 
          title="Quản lý Tài khoản" 
          searchPlaceholder="Tìm theo tên đăng nhập, họ tên..."
          onSearch={handleSearch}
          onAdd={() => setIsModalOpen(true)}
          addButtonText="Thêm tài khoản"
        />
      </div>

      {/* 2. BẢNG DỮ LIỆU */}
      <div className={styles.tableContainer}>
        <Table 
          columns={columns} 
          dataSource={users} 
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
              fetchUsers(p, s, searchText);
            },
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} tài khoản`
          }}
        />
      </div>

      {/* 3. MODAL THÊM TÀI KHOẢN MỚI */}
      <Modal
        title="Thêm tài khoản mới"
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="Lưu tài khoản"
        cancelText="Hủy"
      >
        <Form 
          form={form} 
          layout="vertical" 
          onFinish={handleSaveUser} 
          style={{ marginTop: 20 }}
        >
          <Form.Item 
            name="username" 
            label="Tên đăng nhập" 
            rules={[{ required: true, message: "Vui lòng nhập tên đăng nhập!" }]}
          >
            <Input placeholder="VD: coso02" />
          </Form.Item>
          
          <Form.Item 
            name="fullName" 
            label="Họ và tên / Tên đơn vị" 
            rules={[{ required: true, message: "Vui lòng nhập họ tên!" }]}
          >
            <Input placeholder="VD: Cơ sở Đoàn 02" />
          </Form.Item>
          
          <Form.Item 
            name="role" 
            label="Phân quyền" 
            initialValue="UNIT" 
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="UNIT">UNIT (Đơn vị tự chấm)</Select.Option>
              <Select.Option value="ADMIN">ADMIN (Quản trị viên)</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
}