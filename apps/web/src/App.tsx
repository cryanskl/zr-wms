import { Card, Typography } from 'antd';

const { Title, Paragraph, Text } = Typography;

export function App() {
  return (
    <main className="app-shell">
      <Card className="foundation-card">
        <Title level={2}>ZR WMS</Title>
        <Paragraph>
          地基已就绪：前端 React/Vite/Ant Design/TanStack Query，后端 NestJS，数据库初始化走 PostgreSQL SQL 脚本。
        </Paragraph>
        <Paragraph>
          当前切片只验证项目可启动和数据库可建库，搜索功能留到下一刀。
        </Paragraph>
        <Text type="secondary">API 健康检查：/api/v1/health 和 /api/v1/health/db</Text>
      </Card>
    </main>
  );
}
