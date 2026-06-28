import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Empty, Input, List, Space, Tag, Typography } from 'antd';
import { SearchResult, searchProducts } from './searchApi';

const { Title, Paragraph, Text } = Typography;

const matchedLabels: Record<SearchResult['matched'], string> = {
  name: '产品名',
  alias: '别名',
  path_alias: '路径别名',
  remark: '备注',
};

export function App() {
  const [inputValue, setInputValue] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  const searchQuery = useQuery({
    queryKey: ['search', submittedQuery],
    queryFn: () => searchProducts(submittedQuery),
    enabled: submittedQuery.trim().length > 0,
  });

  const results = searchQuery.data ?? [];

  return (
    <main className="app-shell">
      <Card className="foundation-card">
        <Title level={2}>ZR WMS 搜索</Title>
        <Paragraph>
          输入产品编号、别名、路径别名或备注关键词，先验证“查得快、查得准”这条链路。
        </Paragraph>
        <Input.Search
          allowClear
          enterButton="搜索"
          placeholder="例如：399 151、带管子、FG-7L0199131F-1-1"
          size="large"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onSearch={(value) => setSubmittedQuery(value.trim())}
          loading={searchQuery.isFetching}
        />

        <section className="results-region">
          {!submittedQuery ? (
            <Empty description="输入关键词后点击搜索" />
          ) : searchQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message="搜索失败"
              description={searchQuery.error instanceof Error ? searchQuery.error.message : '请检查后端服务'}
            />
          ) : (
            <>
              <Text type="secondary">
                {searchQuery.isFetching ? '搜索中...' : `“${submittedQuery}” 找到 ${results.length} 条结果`}
              </Text>
              <List
                className="results-list"
                dataSource={results}
                locale={{ emptyText: '没有匹配结果' }}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space size={8} wrap>
                          <Text strong>{item.product_id}</Text>
                          <Text>{item.name}</Text>
                          <Tag>{matchedLabels[item.matched]}</Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={2}>
                          <Text>{item.snippet}</Text>
                          <Text type="secondary">score {Number(item.score).toFixed(3)}</Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </>
          )}
        </section>
      </Card>
    </main>
  );
}
