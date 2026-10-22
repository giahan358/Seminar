import { Input, Button, Space } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import styles from "./PageHeader.module.css";

export default function PageHeader({ 
  title, 
  searchPlaceholder = "Tìm kiếm...", 
  onSearch, 
  onAdd, 
  addButtonText = "Thêm mới" 
}) {
  return (
    <div className={styles.headerContainer}>
      {/* Bên trái: Tiêu đề */}
      <div className={styles.leftSection}>
        <h2 className={styles.title}>{title}</h2>
      </div>
      
      {/* Bên phải: Tìm kiếm + Thêm mới */}
      <div className={styles.rightSection}>
        <Space size="middle">
          {onSearch && (
            <Input 
              size="large"
              placeholder={searchPlaceholder} 
              prefix={<SearchOutlined />} 
              onChange={(e) => onSearch(e.target.value)}
              allowClear
              style={{ width: 300, borderRadius: 8 }}
            />
          )}
          {onAdd && (
            <Button 
              type="primary" 
              size="large" 
              icon={<PlusOutlined />} 
              onClick={onAdd}
              style={{ borderRadius: 8, padding: "0 24px", fontWeight: 500 }}
            >
              {addButtonText}
            </Button>
          )}
        </Space>
      </div>
    </div>
  );
}