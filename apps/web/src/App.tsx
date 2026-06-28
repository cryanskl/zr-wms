import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Empty, Form, Input, InputNumber, List, Modal, Segmented, Select, Space, Table, Tag, Typography } from 'antd';
import { ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, Boxes, ClipboardList, LogOut, PackageSearch } from 'lucide-react';
import { CurrentUser, login } from './authApi';
import {
  getInventoryDashboard,
  getInventorySummary,
  getLowStock,
  InventoryDashboardRow,
  InventorySummary,
  LowStockRow,
} from './inventoryApi';
import {
  addProductAlias,
  addProductImage,
  createProduct,
  deleteProductAlias,
  getProduct,
  listProducts,
  ProductDetail,
  ProductInput,
  ProductSummary,
  ProductType,
  softDeleteProduct,
  updateProduct,
} from './productApi';
import {
  getInventory,
  getSlots,
  getWarehouses,
  inbound,
  InventoryRow,
  outbound,
  searchResultLabel,
  Slot,
  transfer,
} from './operationsApi';
import { SearchResult, searchProducts } from './searchApi';

const { Title, Paragraph, Text } = Typography;

const matchedLabels: Record<SearchResult['matched'], string> = {
  name: '产品名',
  alias: '别名',
  path_alias: '路径别名',
  remark: '备注',
};

export function App() {
  const queryClient = useQueryClient();
  const [inputValue, setInputValue] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [auth, setAuth] = useState(() => {
    const raw = localStorage.getItem('zr-wms-auth');
    return raw ? (JSON.parse(raw) as { accessToken: string; user: CurrentUser }) : null;
  });
  const [selectedProduct, setSelectedProduct] = useState<SearchResult | null>(null);
  const [activeView, setActiveView] = useState<'operations' | 'dashboard' | 'products'>('operations');
  const [operationType, setOperationType] = useState<'inbound' | 'outbound' | 'transfer'>('inbound');
  const [warehouse, setWarehouse] = useState('W1');
  const [toWarehouse, setToWarehouse] = useState('W1');
  const [slot, setSlot] = useState<number | null>(null);
  const [toSlot, setToSlot] = useState<number | null>(null);
  const [qty, setQty] = useState<number | null>(100);
  const [reason, setReason] = useState('手工操作');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [dashboardProduct, setDashboardProduct] = useState('');
  const [dashboardWarehouse, setDashboardWarehouse] = useState<string | undefined>();
  const [dashboardQuality, setDashboardQuality] = useState<string | undefined>();
  const [productTypeFilter, setProductTypeFilter] = useState<ProductType | undefined>();
  const [productActiveFilter, setProductActiveFilter] = useState<boolean | undefined>(true);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productDraft, setProductDraft] = useState<ProductInput>({ type: 'RM', name: '' });
  const [aliasText, setAliasText] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const searchQuery = useQuery({
    queryKey: ['search', submittedQuery],
    queryFn: () => searchProducts(submittedQuery, auth?.accessToken),
    enabled: submittedQuery.trim().length > 0,
  });

  const results = searchQuery.data ?? [];
  const token = auth?.accessToken ?? '';
  const isAdmin = auth?.user.role === 'ADMIN';

  const warehousesQuery = useQuery({
    queryKey: ['warehouses', token],
    queryFn: () => getWarehouses(token),
    enabled: Boolean(token),
  });

  const fromSlotsQuery = useQuery({
    queryKey: ['slots', token, warehouse],
    queryFn: () => getSlots(token, warehouse),
    enabled: Boolean(token && warehouse),
  });

  const toSlotsQuery = useQuery({
    queryKey: ['slots', token, toWarehouse],
    queryFn: () => getSlots(token, toWarehouse),
    enabled: Boolean(token && toWarehouse),
  });

  const inventoryQuery = useQuery({
    queryKey: ['inventory', token, selectedProduct?.product_id],
    queryFn: () => getInventory(token, selectedProduct?.product_id),
    enabled: Boolean(token && selectedProduct),
  });

  const dashboardInventoryQuery = useQuery({
    queryKey: ['inventory-dashboard', token, dashboardProduct, dashboardWarehouse, dashboardQuality],
    queryFn: () =>
      getInventoryDashboard(token, {
        product: dashboardProduct.trim() || undefined,
        warehouse: dashboardWarehouse,
        quality: dashboardQuality,
      }),
    enabled: Boolean(token),
  });

  const inventorySummaryQuery = useQuery({
    queryKey: ['inventory-summary', token, dashboardProduct],
    queryFn: () => getInventorySummary(token, dashboardProduct.trim() || undefined),
    enabled: Boolean(token),
  });

  const lowStockQuery = useQuery({
    queryKey: ['low-stock', token],
    queryFn: () => getLowStock(token),
    enabled: Boolean(token),
  });

  const productsQuery = useQuery({
    queryKey: ['products', token, productTypeFilter, productActiveFilter],
    queryFn: () => listProducts(token, { type: productTypeFilter, active: productActiveFilter }),
    enabled: Boolean(token),
  });

  const productDetailQuery = useQuery({
    queryKey: ['product-detail', token, selectedProductId],
    queryFn: () => getProduct(token, selectedProductId ?? ''),
    enabled: Boolean(token && selectedProductId),
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      localStorage.setItem('zr-wms-auth', JSON.stringify(data));
      setAuth(data);
      setNotice({ type: 'success', message: `已登录：${data.user.name} / ${data.user.role}` });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '登录失败' }),
  });

  const operationMutation = useMutation({
    mutationFn: async ({ force }: { force?: boolean } = {}) => {
      if (!selectedProduct || !qty || qty <= 0 || !slot) {
        throw new Error('请选择产品、库位并填写正数数量');
      }

      if (operationType === 'inbound') {
        return inbound(token, {
          product: selectedProduct.product_id,
          warehouse,
          slot,
          qty,
          type: 'IN',
          reason,
        });
      }

      if (operationType === 'outbound') {
        return outbound(
          token,
          {
            product: selectedProduct.product_id,
            warehouse,
            slot,
            qty,
            type: 'OUT',
            reason,
          },
          Boolean(force),
        );
      }

      if (!toSlot) {
        throw new Error('移库需要选择目标库位');
      }

      return transfer(token, {
        product: selectedProduct.product_id,
        qty,
        fromWarehouse: warehouse,
        fromSlot: slot,
        toWarehouse,
        toSlot,
        reason,
      });
    },
    onSuccess: (data) => {
      const movementText = 'movementId' in data ? data.movementId : data.movementIds.join(', ');
      setNotice({ type: 'success', message: `操作成功，流水 ${movementText}` });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) =>
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '操作失败，请检查输入' }),
  });

  const warehouseOptions = (warehousesQuery.data ?? []).map((item) => ({
    value: item.warehouse_id,
    label: `${item.warehouse_id} ${item.name}`,
  }));
  const canManageProducts = auth?.user.role === 'ADMIN' || auth?.user.role === 'BOSS';

  const createProductMutation = useMutation({
    mutationFn: () => createProduct(token, productDraft),
    onSuccess: (data) => {
      setNotice({ type: 'success', message: `已新增产品 ${data.product_id}` });
      setSelectedProductId(data.product_id);
      setProductDraft({ type: 'RM', name: '' });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '新增产品失败' }),
  });

  const updateProductMutation = useMutation({
    mutationFn: () => updateProduct(token, selectedProductId ?? '', productDraft),
    onSuccess: (data) => {
      setNotice({ type: 'success', message: `已更新产品 ${data.product_id}` });
      setSelectedProductId(data.product_id);
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['product-detail'] });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '更新产品失败' }),
  });

  const softDeleteProductMutation = useMutation({
    mutationFn: (productId: string) => softDeleteProduct(token, productId),
    onSuccess: (data) => {
      setNotice({ type: 'success', message: `已停用产品 ${data.product_id}` });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['product-detail'] });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '停用产品失败' }),
  });

  const addAliasMutation = useMutation({
    mutationFn: () => addProductAlias(token, selectedProductId ?? '', aliasText),
    onSuccess: () => {
      setAliasText('');
      setNotice({ type: 'success', message: '已添加别名' });
      void queryClient.invalidateQueries({ queryKey: ['product-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['search'] });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '添加别名失败' }),
  });

  const deleteAliasMutation = useMutation({
    mutationFn: (aliasId: number) => deleteProductAlias(token, selectedProductId ?? '', aliasId),
    onSuccess: () => {
      setNotice({ type: 'success', message: '已删除别名' });
      void queryClient.invalidateQueries({ queryKey: ['product-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['search'] });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '删除别名失败' }),
  });

  const addImageMutation = useMutation({
    mutationFn: () => addProductImage(token, selectedProductId ?? '', imageUrl),
    onSuccess: () => {
      setImageUrl('');
      setNotice({ type: 'success', message: '已添加产品图 URL' });
      void queryClient.invalidateQueries({ queryKey: ['product-detail'] });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '添加产品图失败' }),
  });

  const fromSlotOptions = useMemo(() => slotOptions(fromSlotsQuery.data), [fromSlotsQuery.data]);
  const toSlotOptions = useMemo(() => slotOptions(toSlotsQuery.data), [toSlotsQuery.data]);

  if (!auth) {
    return (
      <main className="app-shell">
        <Card className="operation-card">
          <Title level={2}>ZR WMS 登录</Title>
          <Paragraph>测试账号：operator / operator123，admin / admin123，boss / boss123。</Paragraph>
          {notice && <Alert className="form-alert" type={notice.type} showIcon message={notice.message} />}
          <Form
            layout="vertical"
            onFinish={(values) => loginMutation.mutate(values as { username: string; password: string })}
          >
            <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input autoComplete="username" />
            </Form.Item>
            <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loginMutation.isPending}>
              登录
            </Button>
          </Form>
        </Card>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <Card className="operation-card">
        <Space className="topbar" align="center">
          <div>
            <Title level={2}>ZR WMS 出入库</Title>
            <Text type="secondary">
              当前用户：{auth.user.name} / {auth.user.role}
            </Text>
          </div>
          <Button
            icon={<LogOut size={16} />}
            onClick={() => {
              localStorage.removeItem('zr-wms-auth');
              setAuth(null);
            }}
          >
            退出
          </Button>
        </Space>

        {notice && <Alert className="form-alert" type={notice.type} showIcon message={notice.message} />}

        <Segmented
          block
          className="view-switch"
          value={activeView}
          onChange={(value) => setActiveView(value as 'operations' | 'dashboard' | 'products')}
          options={[
            { label: '出入库', value: 'operations', icon: <ClipboardList size={16} /> },
            { label: '库存看板', value: 'dashboard', icon: <Boxes size={16} /> },
            { label: '产品管理', value: 'products', icon: <PackageSearch size={16} /> },
          ]}
        />

        {activeView === 'operations' ? (
          <>
            <Title level={4}>选择产品</Title>
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
                              <Button size="small" onClick={() => setSelectedProduct(item)}>
                                选择
                              </Button>
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

            <section className="operation-panel">
              <Title level={4}>库存操作</Title>
              <div className="selected-product">
                {selectedProduct ? searchResultLabel(selectedProduct) : '尚未选择产品'}
              </div>
              <Segmented
                block
                value={operationType}
                onChange={(value) => setOperationType(value as 'inbound' | 'outbound' | 'transfer')}
                options={[
                  { label: '入库', value: 'inbound', icon: <ArrowDownToLine size={16} /> },
                  { label: '出库', value: 'outbound', icon: <ArrowUpFromLine size={16} /> },
                  { label: '移库', value: 'transfer', icon: <ArrowRightLeft size={16} /> },
                ]}
              />

              <div className="form-grid">
                <label>
                  仓库
                  <Select value={warehouse} options={warehouseOptions} onChange={setWarehouse} />
                </label>
                <label>
                  库位
                  <Select
                    value={slot}
                    options={fromSlotOptions}
                    placeholder="选择库位"
                    onChange={setSlot}
                    loading={fromSlotsQuery.isFetching}
                  />
                </label>
                {operationType === 'transfer' && (
                  <>
                    <label>
                      目标仓库
                      <Select value={toWarehouse} options={warehouseOptions} onChange={setToWarehouse} />
                    </label>
                    <label>
                      目标库位
                      <Select
                        value={toSlot}
                        options={toSlotOptions}
                        placeholder="选择目标库位"
                        onChange={setToSlot}
                        loading={toSlotsQuery.isFetching}
                      />
                    </label>
                  </>
                )}
                <label>
                  数量
                  <InputNumber min={0.0001} value={qty} onChange={setQty} className="full-input" />
                </label>
                <label>
                  原因
                  <Input value={reason} onChange={(event) => setReason(event.target.value)} />
                </label>
              </div>

              <Space className="action-row" wrap>
                <Button type="primary" loading={operationMutation.isPending} onClick={() => operationMutation.mutate({})}>
                  提交{operationType === 'inbound' ? '入库' : operationType === 'outbound' ? '出库' : '移库'}
                </Button>
                {operationType === 'outbound' && isAdmin && (
                  <Button
                    danger
                    loading={operationMutation.isPending}
                    onClick={() =>
                      Modal.confirm({
                        title: '确认强制出库？',
                        content: '强制出库允许库存变成负数，仅管理员可执行。',
                        okText: '确认强制出库',
                        cancelText: '取消',
                        onOk: () => operationMutation.mutate({ force: true }),
                      })
                    }
                  >
                    强制出库
                  </Button>
                )}
              </Space>
            </section>

            <section className="operation-panel">
              <Title level={4}>当前库存</Title>
              <InventoryList rows={inventoryQuery.data ?? []} />
            </section>
          </>
        ) : activeView === 'dashboard' ? (
          <InventoryDashboard
            dashboardProduct={dashboardProduct}
            dashboardWarehouse={dashboardWarehouse}
            dashboardQuality={dashboardQuality}
            warehouseOptions={warehouseOptions}
            inventoryRows={dashboardInventoryQuery.data ?? []}
            summary={inventorySummaryQuery.data}
            lowStockRows={lowStockQuery.data ?? []}
            loading={dashboardInventoryQuery.isFetching || inventorySummaryQuery.isFetching}
            lowStockLoading={lowStockQuery.isFetching}
            error={
              dashboardInventoryQuery.error instanceof Error
                ? dashboardInventoryQuery.error.message
                : lowStockQuery.error instanceof Error
                  ? lowStockQuery.error.message
                  : null
            }
            onProductChange={setDashboardProduct}
            onWarehouseChange={setDashboardWarehouse}
            onQualityChange={setDashboardQuality}
          />
        ) : (
          <ProductManagement
            canManage={canManageProducts}
            products={productsQuery.data ?? []}
            detail={productDetailQuery.data}
            selectedProductId={selectedProductId}
            productTypeFilter={productTypeFilter}
            productActiveFilter={productActiveFilter}
            productDraft={productDraft}
            aliasText={aliasText}
            imageUrl={imageUrl}
            loading={productsQuery.isFetching || productDetailQuery.isFetching}
            saving={
              createProductMutation.isPending ||
              updateProductMutation.isPending ||
              softDeleteProductMutation.isPending ||
              addAliasMutation.isPending ||
              deleteAliasMutation.isPending ||
              addImageMutation.isPending
            }
            onTypeFilterChange={setProductTypeFilter}
            onActiveFilterChange={setProductActiveFilter}
            onSelectProduct={(product) => {
              setSelectedProductId(product.product_id);
              setProductDraft(productToInput(product));
            }}
            onDraftChange={setProductDraft}
            onAliasTextChange={setAliasText}
            onImageUrlChange={setImageUrl}
            onCreate={() => createProductMutation.mutate()}
            onUpdate={() => updateProductMutation.mutate()}
            onSoftDelete={(productId) =>
              Modal.confirm({
                title: '确认停用产品？',
                content: '停用会将 active 设为 false，不会物理删除产品。',
                okText: '停用',
                cancelText: '取消',
                onOk: () => softDeleteProductMutation.mutate(productId),
              })
            }
            onAddAlias={() => addAliasMutation.mutate()}
            onDeleteAlias={(aliasId) => deleteAliasMutation.mutate(aliasId)}
            onAddImage={() => addImageMutation.mutate()}
          />
        )}
      </Card>
    </main>
  );
}

function slotOptions(slots: Slot[] | undefined) {
  return (slots ?? []).map((item) => ({
    value: item.slot_id,
    label: `${item.slot_id} / ${item.code}`,
  }));
}

function InventoryList({ rows }: { rows: InventoryRow[] }) {
  if (rows.length === 0) {
    return <Empty description="选择产品后显示库存" />;
  }

  return (
    <List
      size="small"
      dataSource={rows}
      renderItem={(item) => (
        <List.Item>
          <Space direction="vertical" size={0}>
            <Text strong>
              {item.product_id} / {item.warehouse_id} / 库位 {item.slot_id ?? '无'}
            </Text>
            <Text>
              在库 {item.qty_on_hand}，可用 {item.available}
            </Text>
          </Space>
        </List.Item>
      )}
    />
  );
}

interface InventoryDashboardProps {
  dashboardProduct: string;
  dashboardWarehouse?: string;
  dashboardQuality?: string;
  warehouseOptions: Array<{ value: string; label: string }>;
  inventoryRows: InventoryDashboardRow[];
  summary: InventorySummary | undefined;
  lowStockRows: LowStockRow[];
  loading: boolean;
  lowStockLoading: boolean;
  error: string | null;
  onProductChange: (value: string) => void;
  onWarehouseChange: (value: string | undefined) => void;
  onQualityChange: (value: string | undefined) => void;
}

function InventoryDashboard({
  dashboardProduct,
  dashboardWarehouse,
  dashboardQuality,
  warehouseOptions,
  inventoryRows,
  summary,
  lowStockRows,
  loading,
  lowStockLoading,
  error,
  onProductChange,
  onWarehouseChange,
  onQualityChange,
}: InventoryDashboardProps) {
  return (
    <>
      <section className="operation-panel">
        <Title level={4}>库存看板</Title>
        {error && <Alert className="form-alert" type="error" showIcon message="库存查询失败" description={error} />}
        <div className="form-grid">
          <label>
            产品 ID
            <Input
              allowClear
              value={dashboardProduct}
              placeholder="例如 RM-0123"
              onChange={(event) => onProductChange(event.target.value)}
            />
          </label>
          <label>
            仓库
            <Select
              allowClear
              value={dashboardWarehouse}
              options={warehouseOptions}
              placeholder="全部仓库"
              onChange={onWarehouseChange}
            />
          </label>
          <label>
            质量态
            <Select
              allowClear
              value={dashboardQuality}
              placeholder="全部质量态"
              onChange={onQualityChange}
              options={[
                { value: 'GOOD', label: '良品' },
                { value: 'DEFECTIVE', label: '不良' },
                { value: 'UNUSABLE', label: '不可用' },
              ]}
            />
          </label>
        </div>

        <Space className="summary-row" wrap>
          <Tag color="blue">总库存 {summary?.total ?? 0}</Tag>
          <Tag color="green">可用 {summary?.available ?? 0}</Tag>
          <Tag color="orange">冻结 {summary?.frozen ?? 0}</Tag>
        </Space>

        <Table
          size="small"
          className="inventory-table"
          loading={loading}
          dataSource={inventoryRows}
          rowKey="inventory_id"
          pagination={false}
          scroll={{ x: 760 }}
          columns={[
            {
              title: '产品',
              dataIndex: 'product_id',
              render: (value: string, row) => (
                <Space direction="vertical" size={0}>
                  <Text strong>{value}</Text>
                  <Text type="secondary">{row.product_name}</Text>
                </Space>
              ),
            },
            { title: '仓库', dataIndex: 'warehouse_id' },
            {
              title: '库位',
              dataIndex: 'slot_code',
              render: (value: string | null) => value ?? '无',
            },
            { title: '质量态', dataIndex: 'quality' },
            { title: '在库', dataIndex: 'qty_on_hand' },
            { title: '可用', dataIndex: 'available' },
            { title: '冻结', dataIndex: 'frozen' },
          ]}
        />
      </section>

      <section className="operation-panel">
        <Title level={4}>低库存预警</Title>
        <Alert
          type={lowStockRows.length > 0 ? 'warning' : 'success'}
          showIcon
          message={lowStockRows.length > 0 ? `有 ${lowStockRows.length} 个产品低于安全库存` : '当前没有低库存预警'}
        />
        <List
          className="warning-list"
          loading={lowStockLoading}
          dataSource={lowStockRows}
          locale={{ emptyText: '无低库存产品' }}
          renderItem={(item) => (
            <List.Item>
              <Space direction="vertical" size={2}>
                <Text strong>
                  {item.product_id} / {item.product_name}
                </Text>
                <Text>
                  当前 {item.qty_on_hand}，安全库存 {item.safety_stock}，缺口 {item.shortage}
                </Text>
              </Space>
            </List.Item>
          )}
        />
      </section>
    </>
  );
}

interface ProductManagementProps {
  canManage: boolean;
  products: ProductSummary[];
  detail: ProductDetail | undefined;
  selectedProductId: string | null;
  productTypeFilter: ProductType | undefined;
  productActiveFilter: boolean | undefined;
  productDraft: ProductInput;
  aliasText: string;
  imageUrl: string;
  loading: boolean;
  saving: boolean;
  onTypeFilterChange: (value: ProductType | undefined) => void;
  onActiveFilterChange: (value: boolean | undefined) => void;
  onSelectProduct: (product: ProductSummary) => void;
  onDraftChange: (value: ProductInput) => void;
  onAliasTextChange: (value: string) => void;
  onImageUrlChange: (value: string) => void;
  onCreate: () => void;
  onUpdate: () => void;
  onSoftDelete: (productId: string) => void;
  onAddAlias: () => void;
  onDeleteAlias: (aliasId: number) => void;
  onAddImage: () => void;
}

function ProductManagement({
  canManage,
  products,
  detail,
  selectedProductId,
  productTypeFilter,
  productActiveFilter,
  productDraft,
  aliasText,
  imageUrl,
  loading,
  saving,
  onTypeFilterChange,
  onActiveFilterChange,
  onSelectProduct,
  onDraftChange,
  onAliasTextChange,
  onImageUrlChange,
  onCreate,
  onUpdate,
  onSoftDelete,
  onAddAlias,
  onDeleteAlias,
  onAddImage,
}: ProductManagementProps) {
  const productTypeOptions = [
    { value: 'RM', label: 'RM 原材料' },
    { value: 'SF', label: 'SF 半成品' },
    { value: 'FG', label: 'FG 成品' },
    { value: 'ACC', label: 'ACC 配件' },
  ];

  return (
    <>
      <section className="operation-panel">
        <Title level={4}>产品主数据</Title>
        <div className="form-grid">
          <label>
            类型
            <Select
              allowClear
              value={productTypeFilter}
              options={productTypeOptions}
              placeholder="全部类型"
              onChange={onTypeFilterChange}
            />
          </label>
          <label>
            状态
            <Select
              allowClear
              value={productActiveFilter}
              placeholder="全部状态"
              onChange={onActiveFilterChange}
              options={[
                { value: true, label: '启用' },
                { value: false, label: '停用' },
              ]}
            />
          </label>
        </div>

        <Table
          size="small"
          className="inventory-table"
          loading={loading}
          dataSource={products}
          rowKey="product_id"
          pagination={false}
          scroll={{ x: 780 }}
          columns={[
            {
              title: '产品',
              dataIndex: 'product_id',
              render: (value: string, row) => (
                <Button type="link" className="table-link-button" onClick={() => onSelectProduct(row)}>
                  {value}
                </Button>
              ),
            },
            { title: '类型', dataIndex: 'type' },
            { title: '名称', dataIndex: 'name' },
            {
              title: '安全库存',
              dataIndex: 'safety_stock',
              render: (value: number | null) => value ?? '-',
            },
            {
              title: '状态',
              dataIndex: 'active',
              render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? '启用' : '停用'}</Tag>,
            },
          ]}
        />
      </section>

      <section className="operation-panel">
        <Title level={4}>产品编辑</Title>
        {!canManage && <Alert className="form-alert" type="info" showIcon message="当前角色只能查看产品和维护别名" />}
        <div className="form-grid">
          <label>
            产品 ID
            <Input
              disabled={!canManage}
              value={productDraft.product_id ?? ''}
              placeholder="留空自动生成"
              onChange={(event) => onDraftChange({ ...productDraft, product_id: event.target.value })}
            />
          </label>
          <label>
            类型
            <Select
              disabled={!canManage}
              value={productDraft.type}
              options={productTypeOptions}
              onChange={(value) => onDraftChange({ ...productDraft, type: value })}
            />
          </label>
          <label>
            名称
            <Input
              disabled={!canManage}
              value={productDraft.name}
              onChange={(event) => onDraftChange({ ...productDraft, name: event.target.value })}
            />
          </label>
          <label>
            安全库存
            <InputNumber
              disabled={!canManage}
              className="full-input"
              min={0}
              value={productDraft.safety_stock ?? null}
              onChange={(value) => onDraftChange({ ...productDraft, safety_stock: value })}
            />
          </label>
          <label>
            备注
            <Input
              disabled={!canManage}
              value={productDraft.remark ?? ''}
              onChange={(event) => onDraftChange({ ...productDraft, remark: event.target.value })}
            />
          </label>
        </div>

        <Space className="action-row" wrap>
          <Button
            disabled={!canManage}
            type="primary"
            loading={saving}
            onClick={onCreate}
          >
            新增产品
          </Button>
          <Button disabled={!canManage || !selectedProductId} loading={saving} onClick={onUpdate}>
            更新当前产品
          </Button>
          <Button
            danger
            disabled={!canManage || !selectedProductId}
            loading={saving}
            onClick={() => selectedProductId && onSoftDelete(selectedProductId)}
          >
            停用当前产品
          </Button>
        </Space>
      </section>

      <section className="operation-panel">
        <Title level={4}>别名与图片</Title>
        {detail ? (
          <>
            <Text strong>{detail.product_id} / {detail.name}</Text>
            <div className="form-grid">
              <label>
                新别名
                <Input value={aliasText} onChange={(event) => onAliasTextChange(event.target.value)} />
              </label>
              <label>
                图片 URL
                <Input disabled={!canManage} value={imageUrl} onChange={(event) => onImageUrlChange(event.target.value)} />
              </label>
            </div>
            <Space className="action-row" wrap>
              <Button loading={saving} onClick={onAddAlias}>
                添加别名
              </Button>
              <Button disabled={!canManage} loading={saving} onClick={onAddImage}>
                添加图片 URL
              </Button>
            </Space>

            <List
              className="warning-list"
              header="人工别名"
              dataSource={detail.aliases}
              locale={{ emptyText: '暂无别名' }}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button key="delete" size="small" danger onClick={() => onDeleteAlias(item.alias_id)}>
                      删除
                    </Button>,
                  ]}
                >
                  {item.alias_text}
                </List.Item>
              )}
            />
            <List
              className="warning-list"
              header="产品图 URL"
              dataSource={detail.images}
              locale={{ emptyText: '暂无图片' }}
              renderItem={(item) => (
                <List.Item>
                  <Text ellipsis>{item.seq}. {item.url}</Text>
                </List.Item>
              )}
            />
            <List
              className="warning-list"
              header="路径别名"
              dataSource={detail.path_aliases}
              locale={{ emptyText: '暂无路径别名' }}
              renderItem={(item) => <List.Item>{item.path_text}</List.Item>}
            />
          </>
        ) : (
          <Empty description="选择一个产品后查看详情" />
        )}
      </section>
    </>
  );
}

function productToInput(product: ProductSummary): ProductInput {
  return {
    product_id: product.product_id,
    type: product.type,
    name: product.name,
    has_tube: product.has_tube,
    has_alu_plate: product.has_alu_plate,
    has_dust_cover: product.has_dust_cover,
    attrs: product.attrs,
    safety_stock: product.safety_stock,
    remark: product.remark,
  };
}
