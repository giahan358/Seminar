import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import AppRoutes from "./routes";
import { App as AntdApp } from "antd";

export default function App() {
  return (
    <BrowserRouter>
      <AntdApp>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </AntdApp>
    </BrowserRouter>
    
  );
}