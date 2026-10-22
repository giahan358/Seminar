import { useState, useEffect } from "react";
import { 
  Card, Form, Input, InputNumber, DatePicker, Button, Tabs, message, 
  Row, Col, Typography, Divider, Space, Table, Tag, Modal, Switch 
} from "antd";
import { 
  SaveOutlined, SettingOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ArrowLeftOutlined 
} from "@ant-design/icons";
import dayjs from "dayjs";
import { evaluationPeriodService } from "../../services/evaluationPeriodService";
import { criteriaService } from "../../services/criteriaService";
import styles from "./AdminConfig.module.css";

const { Title, Text } = Typography;

export default function AdminConfig() {
  // ================= QUẢN LÝ LUỒNG (WIZARD) =================
  const [activeTab, setActiveTab] = useState("1"); // Mặc định mở Tab 1
  const [currentPeriodId, setCurrentPeriodId] = useState(null); // Lưu ID kỳ thi đang thao tác

  // ================= STATE DỮ LIỆU =================
  const [periodsList, setPeriodsList] = useState([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);

  const [criteriaList, setCriteriaList] = useState([]);
  const [loadingCriteria, setLoadingCriteria] = useState(false);
  const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState(false);

  // ================= STATE FORM =================
  const [formPeriod] = Form.useForm();
  const [formCriteria] = Form.useForm();

  // ================= GỌI API =================
  // 1. Lấy danh sách kỳ thi khi vào trang
  useEffect(() => {
    fetchPeriods();
  }, []);

  const fetchPeriods = async () => {
    try {
      setLoadingPeriods(true);
      const res = await evaluationPeriodService.getEvaluationPeriods();
      setPeriodsList(res.items || []);
    } catch (error) {
      message.error("Lỗi tải danh sách kỳ thi");
    } finally {
      setLoadingPeriods(false);
    }
  };

  // 2. Lấy danh sách tiêu chí khi đã có ID kỳ thi
  const fetchCriteria = async (periodId) => {
    if (!periodId) return;
    try {
      setLoadingCriteria(true);
      const res = await criteriaService.getCriteria(periodId);
      setCriteriaList(res.items || []);
    } catch (error) {
      message.error("Lỗi tải danh sách tiêu chí");
    } finally {
      setLoadingCriteria(false);
    }
  };

  // ================= XỬ LÝ CHUYỂN BƯỚC =================
  const handleCreateNew = () => {
    setCurrentPeriodId(null);
    formPeriod.resetFields();
    setActiveTab("2"); // Nhảy sang Tab 2
  };

  const handleEditPeriod = (record) => {
    setCurrentPeriodId(record.id);
    formPeriod.setFieldsValue({
      name: record.name,
      year: record.year,
      maxTotalScore: record.maxTotalScore,
      supplementHours: record.supplementHours,
      // Convert string ISO sang dayjs object cho DatePicker
      selfEvalRange: [dayjs(record.selfEvalStart), dayjs(record.selfEvalDeadline)] 
    });
    setActiveTab("2"); // Nhảy sang Tab 2
  };

  const handleBackToList = () => {
    setActiveTab("1");
    fetchPeriods(); // Cập nhật lại danh sách đề phòng có thay đổi
  };

  // ================= XỬ LÝ LƯU KỲ THI (TAB 2) =================
  const onFinishPeriod = async (values) => {
    try {
      setLoadingPeriods(true);
      const payload = {
        name: values.name,
        year: values.year,
        maxTotalScore: values.maxTotalScore,
        selfEvalStart: values.selfEvalRange[0].toISOString(),
        selfEvalDeadline: values.selfEvalRange[1].toISOString(),
        supplementHours: values.supplementHours,
      };

      let result;
      if (currentPeriodId) {
        // Nếu đang sửa (sau này bạn viết thêm API update)
        // result = await evaluationPeriodService.updateEvaluationPeriod(currentPeriodId, payload);
        result = { id: currentPeriodId }; // Tạm fix
      } else {
        // Nếu tạo mới
        result = await evaluationPeriodService.createEvaluationPeriod(payload);
      }
      
      message.success("Đã lưu thông tin kỳ thi thành công!");
      
      // LƯU ID VÀ TỰ ĐỘNG CHUYỂN SANG TAB 3
      const newId = result?.id || currentPeriodId;
      setCurrentPeriodId(newId);
      setActiveTab("3");
      fetchCriteria(newId); // Load tiêu chí cho kỳ thi này

    } catch (error) {
      message.error("Lỗi khi lưu cấu hình kỳ thi");
    } finally {
      setLoadingPeriods(false);
    }
  };

  // ================= XỬ LÝ LƯU TIÊU CHÍ (TAB 3) =================
  const onFinishCriteria = async (values) => {
    try {
      await criteriaService.createCriteria(currentPeriodId, values);
      message.success("Thêm tiêu chí thành công!");
      setIsCriteriaModalOpen(false);
      formCriteria.resetFields();
      fetchCriteria(currentPeriodId); // Load lại bảng
    } catch (error) {
      message.error("Lỗi khi thêm tiêu chí");
    }
  };

  // ================= GIAO DIỆN TAB 1: DANH SÁCH =================
  const periodColumns = [
    { title: "Tên Kỳ thi", dataIndex: "name", key: "name" }, 
    { title: "Năm", dataIndex: "year", key: "year", width: 100, align: "center" },
    { 
      title: "Trạng thái", 
      dataIndex: "phase", 
      key: "phase", 
      render: (p) => <Tag color={p === "SETUP" ? "orange" : "green"}>{p}</Tag> 
    },
    {
      title: "Hành động",
      key: "action",
      width: 150,
      align: "center",
      render: (_, record) => (
        <Button type="primary" ghost icon={<EditOutlined />} onClick={() => handleEditPeriod(record)}>
          Cấu hình
        </Button>
      ),
    },
  ];

  const TabList = (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <Title level={5} style={{ margin: 0 }}>Danh sách Kỳ thi đua</Title>
          <Text type="secondary">Quản lý các đợt đánh giá thi đua của hệ thống</Text>
        </div>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={handleCreateNew}>
          Tạo kỳ thi mới
        </Button>
      </div>
      <Table columns={periodColumns} dataSource={periodsList} rowKey="id" loading={loadingPeriods} />
    </div>
  );

  // ================= GIAO DIỆN TAB 2: THÔNG TIN =================
  const TabGeneral = (
    <div className={styles.formContainer}>
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={handleBackToList} style={{ marginBottom: 16, padding: 0 }}>
        Quay lại danh sách
      </Button>

      <Form 
        form={formPeriod} 
        layout="vertical" 
        onFinish={onFinishPeriod}
        initialValues={{
          year: dayjs().year(),
          maxTotalScore: 300,
          supplementHours: 48,
          selfEvalRange: [dayjs().startOf('year'), dayjs().endOf('year')]
        }}
        style={{ maxWidth: 1000 }}
      >
        <Space align="center" style={{ marginBottom: 16 }}>
          <SettingOutlined style={{ color: "#1677ff", fontSize: 18 }} />
          <Title level={5} style={{ margin: 0 }}>Thông tin cơ bản</Title>
        </Space>
        
        <Row gutter={32}>
          <Col span={12}>
            <Form.Item label="Tên kỳ thi đua" name="name" rules={[{ required: true, message: "Vui lòng nhập tên" }]}>
              <Input size="large" placeholder="VD: Thi đua công tác Đoàn năm 2026" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Năm thi đua" name="year" rules={[{ required: true }]}>
              <InputNumber size="large" style={{ width: "100%" }} />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: "12px 0 24px 0" }} />

        <Space align="center" style={{ marginBottom: 16 }}>
          <SettingOutlined style={{ color: "#1677ff", fontSize: 18 }} />
          <Title level={5} style={{ margin: 0 }}>Cấu hình thời gian & Điểm số</Title>
        </Space>

        <Row gutter={32}>
          <Col span={10}>
            <Form.Item label="Thời gian mở/đóng tự chấm" name="selfEvalRange" rules={[{ required: true }]}>
              <DatePicker.RangePicker showTime size="large" style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col span={7}>
            <Form.Item label="Thời gian bổ sung (Giờ)" name="supplementHours" rules={[{ required: true }]}>
              <InputNumber size="large" min={1} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col span={7}>
            <Form.Item label="Tổng điểm tối đa" name="maxTotalScore" rules={[{ required: true }]}>
              <InputNumber size="large" min={1} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: "24px 0" }} />

        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" size="large" htmlType="submit" icon={<SaveOutlined />} loading={loadingPeriods} className={styles.btnSave}>
            Lưu và chuyển sang Tiêu chí
          </Button>
        </Form.Item>
      </Form>
    </div>
  );

  // ================= GIAO DIỆN TAB 3: TIÊU CHÍ =================
  const criteriaColumns = [
    { title: "Mã", dataIndex: "code", key: "code", width: 80, render: (text) => <strong>{text}</strong> },
    { title: "Tên tiêu chí", dataIndex: "name", key: "name" },
    { title: "Điểm tối đa", dataIndex: "maxScore", key: "maxScore", align: "center", render: (score) => <Tag color="blue">{score} điểm</Tag> },
    { title: "Yêu cầu minh chứng", dataIndex: "evidenceRequirement", key: "evidenceRequirement", ellipsis: true },
    {
      title: "Hành động", key: "action", align: "center", width: 120,
      render: () => (
        <Space size="small">
          <Button type="text" icon={<EditOutlined style={{ color: "#1677ff" }} />} />
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Space>
      ),
    },
  ];

  const TabCriteria = (
    <div className={styles.formContainer}>
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={handleBackToList} style={{ marginBottom: 16, padding: 0 }}>
        Hoàn tất & Quay lại danh sách
      </Button>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <Title level={5} style={{ margin: 0 }}>Danh sách Tiêu chí chấm điểm</Title>
          <Text type="secondary">Cấu hình thang điểm chi tiết cho kỳ thi đang chọn</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCriteriaModalOpen(true)}>
          Thêm tiêu chí
        </Button>
      </div>

      <div className={styles.tableContainer}>
        <Table 
          columns={criteriaColumns} 
          dataSource={criteriaList} 
          rowKey="id"
          loading={loadingCriteria}
          pagination={{ pageSize: 10 }}
        />
      </div>

      {/* MODAL THÊM TIÊU CHÍ */}
      <Modal
        title="Thêm tiêu chí chấm điểm mới"
        open={isCriteriaModalOpen}
        onCancel={() => { setIsCriteriaModalOpen(false); formCriteria.resetFields(); }}
        onOk={() => formCriteria.submit()}
        okText="Lưu tiêu chí"
        cancelText="Hủy"
        width={700}
      >
        <Form 
          form={formCriteria} 
          layout="vertical" 
          onFinish={onFinishCriteria} 
          initialValues={{ allowText: true, allowFile: true, allowLink: true, evidenceRequired: true }}
          style={{ marginTop: 20 }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="code" label="Mã tiêu chí" rules={[{ required: true, message: "Nhập mã" }]}>
                <Input placeholder="VD: 1.1" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="name" label="Tên tiêu chí" rules={[{ required: true, message: "Nhập tên" }]}>
                <Input placeholder="VD: Công tác tuyên truyền" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="maxScore" label="Điểm tối đa" rules={[{ required: true, message: "Nhập điểm" }]}>
                <InputNumber min={1} max={300} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="evidenceRequirement" label="Yêu cầu minh chứng">
                <Input placeholder="VD: Báo cáo, hình ảnh..." />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Mô tả chi tiết">
            <Input.TextArea rows={2} placeholder="Nhập mô tả nếu có..." />
          </Form.Item>

          <Divider orientation="left" plain>Quyền minh chứng</Divider>
          
          <Row gutter={16}>
            <Col span={6}><Form.Item name="allowText" label="Nhập Text" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={6}><Form.Item name="allowFile" label="Upload File" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={6}><Form.Item name="allowLink" label="Nhập Link" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={6}>
              <Form.Item name="evidenceRequired" label="Bắt buộc minh chứng" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );

  // ================= RENDER CHÍNH (KHÓA TAB) =================
  return (
    <div className={styles.pageContainer}>
      <Card bordered={false} className={styles.cardContainer}>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          size="large"
          items={[
            {
              key: '1',
              label: '1. Danh sách kỳ thi',
              children: TabList,
            },
            {
              key: '2',
              label: '2. Thông tin kỳ thi',
              children: TabGeneral,
              disabled: activeTab === "1", // Khóa nếu đang ở Tab 1
            },
            {
              key: '3',
              label: '3. Tiêu chí chấm điểm',
              children: TabCriteria,
              disabled: activeTab !== "3", // Chỉ mở khóa khi đã lưu xong Tab 2
            },
          ]}
        />
      </Card>
    </div>
  );
}