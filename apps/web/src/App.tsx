import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Empty, Form, Input, InputNumber, List, Modal, Segmented, Select, Space, Table, Tag, Typography } from 'antd';
import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  Boxes,
  ClipboardList,
  LogOut,
  MapPinned,
  PackageSearch,
  ScrollText,
} from 'lucide-react';
import { CurrentUser, login } from './authApi';
import {
  BomLine,
  BomLineInput,
  getBom,
  getPathAliases,
  getWhereUsed,
  PathAliasRow,
  regeneratePathAliases,
  replaceBom,
  WhereUsedRow,
} from './bomApi';
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
import {
  createOrder,
  getOrder,
  listOrders,
  OrderDetail,
  OrderInput,
  OrderLineInput,
  OrderSummary,
  OrderType,
  patchOrder,
} from './orderApi';
import { SearchResult, searchProducts } from './searchApi';
import {
  createWarehouse,
  generateSlotsFromTemplate,
  listSlots,
  listWarehouses,
  Slot as StructureSlot,
  SlotStatus,
  updateSlot,
  Warehouse as StructureWarehouse,
  WarehouseInput,
  WarehouseType,
} from './warehouseApi';

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
  const [activeView, setActiveView] = useState<'operations' | 'dashboard' | 'products' | 'warehouses' | 'orders'>('operations');
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
  const [bomDraftRows, setBomDraftRows] = useState<BomLineInput[]>([]);
  const [bomChildProductId, setBomChildProductId] = useState('');
  const [bomQty, setBomQty] = useState<number | null>(1);
  const [bomSeq, setBomSeq] = useState<number | null>(1);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [warehouseDraft, setWarehouseDraft] = useState<WarehouseInput>({
    warehouse_id: '',
    name: '',
    type: 'NORMAL',
    has_slots: true,
  });
  const [templateRows, setTemplateRows] = useState<number | null>(1);
  const [templateCols, setTemplateCols] = useState<number | null>(1);
  const [templateLevels, setTemplateLevels] = useState<number | null>(1);
  const [templatePositions, setTemplatePositions] = useState<string[]>(['A']);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [slotStatus, setSlotStatus] = useState<SlotStatus>('AVAILABLE');
  const [slotReason, setSlotReason] = useState('');
  const [slotMergedInto, setSlotMergedInto] = useState<number | null>(null);
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderType | undefined>();
  const [orderStatusFilter, setOrderStatusFilter] = useState<string | undefined>();
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [orderDraft, setOrderDraft] = useState<OrderInput>({
    order_type: 'PRODUCTION',
    partner: '',
    due_date: null,
    lines: [],
  });
  const [orderLineProductId, setOrderLineProductId] = useState('');
  const [orderLineQty, setOrderLineQty] = useState<number | null>(1);
  const [orderPatch, setOrderPatch] = useState({ partner: '', due_date: '', status: 'PENDING' });

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

  const bomQuery = useQuery({
    queryKey: ['bom', token, selectedProductId],
    queryFn: () => getBom(token, selectedProductId ?? ''),
    enabled: Boolean(token && selectedProductId),
  });

  const pathAliasesQuery = useQuery({
    queryKey: ['path-aliases', token, selectedProductId],
    queryFn: () => getPathAliases(token, selectedProductId ?? ''),
    enabled: Boolean(token && selectedProductId),
  });

  const whereUsedQuery = useQuery({
    queryKey: ['where-used', token, selectedProductId],
    queryFn: () => getWhereUsed(token, selectedProductId ?? '', true),
    enabled: Boolean(token && selectedProductId),
  });

  const structureWarehousesQuery = useQuery({
    queryKey: ['structure-warehouses', token],
    queryFn: () => listWarehouses(token),
    enabled: Boolean(token),
  });

  const structureSlotsQuery = useQuery({
    queryKey: ['structure-slots', token, selectedWarehouseId],
    queryFn: () => listSlots(token, selectedWarehouseId ?? '', true),
    enabled: Boolean(token && selectedWarehouseId),
  });

  const ordersQuery = useQuery({
    queryKey: ['orders', token, orderTypeFilter, orderStatusFilter],
    queryFn: () => listOrders(token, { type: orderTypeFilter, status: orderStatusFilter }),
    enabled: Boolean(token),
  });

  const orderDetailQuery = useQuery({
    queryKey: ['order-detail', token, selectedOrderId],
    queryFn: () => getOrder(token, selectedOrderId ?? 0),
    enabled: Boolean(token && selectedOrderId),
  });

  useEffect(() => {
    if (bomQuery.data) {
      setBomDraftRows(bomQuery.data.map((line) => ({ child_product_id: line.child_product_id, qty: line.qty, seq: line.seq })));
    }
  }, [bomQuery.data]);

  useEffect(() => {
    if (orderDetailQuery.data) {
      setOrderPatch({
        partner: orderDetailQuery.data.partner ?? '',
        due_date: orderDetailQuery.data.due_date ?? '',
        status: orderDetailQuery.data.status,
      });
    }
  }, [orderDetailQuery.data]);

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

  const replaceBomMutation = useMutation({
    mutationFn: () => replaceBom(token, selectedProductId ?? '', bomDraftRows),
    onSuccess: (data) => {
      setNotice({ type: 'success', message: `已更新 BOM，生成 ${data.regenerated_aliases} 条路径别名` });
      void queryClient.invalidateQueries({ queryKey: ['bom'] });
      void queryClient.invalidateQueries({ queryKey: ['path-aliases'] });
      void queryClient.invalidateQueries({ queryKey: ['product-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['where-used'] });
      void queryClient.invalidateQueries({ queryKey: ['search'] });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '更新 BOM 失败' }),
  });

  const regenerateAliasesMutation = useMutation({
    mutationFn: () => regeneratePathAliases(token),
    onSuccess: (data) => {
      setNotice({ type: 'success', message: `已重算 ${data.regenerated_aliases} 条路径别名` });
      void queryClient.invalidateQueries({ queryKey: ['path-aliases'] });
      void queryClient.invalidateQueries({ queryKey: ['product-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['search'] });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '重算路径别名失败' }),
  });

  const createWarehouseMutation = useMutation({
    mutationFn: () => createWarehouse(token, warehouseDraft),
    onSuccess: (warehouse) => {
      setNotice({ type: 'success', message: `已新增仓库 ${warehouse.warehouse_id}` });
      setSelectedWarehouseId(warehouse.warehouse_id);
      setWarehouseDraft({ warehouse_id: '', name: '', type: 'NORMAL', has_slots: true });
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      void queryClient.invalidateQueries({ queryKey: ['structure-warehouses'] });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '新增仓库失败' }),
  });

  const generateSlotsMutation = useMutation({
    mutationFn: () =>
      generateSlotsFromTemplate(token, selectedWarehouseId ?? '', {
        rows: templateRows ?? 0,
        cols: templateCols ?? 0,
        levels: templateLevels ?? 0,
        positions: templatePositions,
      }),
    onSuccess: (data) => {
      setNotice({ type: 'success', message: `已生成 ${data.created} 个库位` });
      void queryClient.invalidateQueries({ queryKey: ['slots'] });
      void queryClient.invalidateQueries({ queryKey: ['structure-slots'] });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '生成库位失败' }),
  });

  const updateSlotMutation = useMutation({
    mutationFn: () =>
      updateSlot(token, selectedSlotId ?? 0, {
        status: slotStatus,
        status_reason: slotReason || null,
        merged_into: slotMergedInto,
      }),
    onSuccess: (slot) => {
      setNotice({ type: 'success', message: `已更新库位 ${slot.code}` });
      void queryClient.invalidateQueries({ queryKey: ['slots'] });
      void queryClient.invalidateQueries({ queryKey: ['structure-slots'] });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '更新库位失败' }),
  });

  const createOrderMutation = useMutation({
    mutationFn: () => createOrder(token, orderDraft),
    onSuccess: (order) => {
      setNotice({ type: 'success', message: `已创建订单 #${order.order_id}` });
      setSelectedOrderId(order.order_id);
      setOrderDraft({ order_type: 'PRODUCTION', partner: '', due_date: null, lines: [] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['order-detail'] });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '创建订单失败' }),
  });

  const patchOrderMutation = useMutation({
    mutationFn: () =>
      patchOrder(token, selectedOrderId ?? 0, {
        partner: orderPatch.partner || null,
        due_date: orderPatch.due_date || null,
        status: orderPatch.status,
      }),
    onSuccess: (order) => {
      setNotice({ type: 'success', message: `已更新订单 #${order.order_id}` });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['order-detail'] });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '更新订单失败' }),
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
          onChange={(value) => setActiveView(value as 'operations' | 'dashboard' | 'products' | 'warehouses' | 'orders')}
          options={[
            { label: '出入库', value: 'operations', icon: <ClipboardList size={16} /> },
            { label: '订单', value: 'orders', icon: <ScrollText size={16} /> },
            { label: '库存看板', value: 'dashboard', icon: <Boxes size={16} /> },
            { label: '产品管理', value: 'products', icon: <PackageSearch size={16} /> },
            { label: '仓库库位', value: 'warehouses', icon: <MapPinned size={16} /> },
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
        ) : activeView === 'orders' ? (
          <OrderManagement
            orders={ordersQuery.data ?? []}
            detail={orderDetailQuery.data}
            selectedOrderId={selectedOrderId}
            typeFilter={orderTypeFilter}
            statusFilter={orderStatusFilter}
            draft={orderDraft}
            lineProductId={orderLineProductId}
            lineQty={orderLineQty}
            patch={orderPatch}
            loading={ordersQuery.isFetching || orderDetailQuery.isFetching}
            saving={createOrderMutation.isPending || patchOrderMutation.isPending}
            onTypeFilterChange={setOrderTypeFilter}
            onStatusFilterChange={setOrderStatusFilter}
            onSelectOrder={setSelectedOrderId}
            onDraftChange={setOrderDraft}
            onLineProductIdChange={setOrderLineProductId}
            onLineQtyChange={setOrderLineQty}
            onPatchChange={setOrderPatch}
            onAddLine={() => {
              if (!orderLineProductId.trim() || !orderLineQty || orderLineQty <= 0) {
                setNotice({ type: 'error', message: '请填写订单行产品和正数数量' });
                return;
              }
              setOrderDraft((draft) => ({
                ...draft,
                lines: [...draft.lines, { product_id: orderLineProductId.trim().toUpperCase(), qty: orderLineQty }],
              }));
              setOrderLineProductId('');
              setOrderLineQty(1);
            }}
            onRemoveLine={(index) =>
              setOrderDraft((draft) => ({ ...draft, lines: draft.lines.filter((_, rowIndex) => rowIndex !== index) }))
            }
            onCreate={() => createOrderMutation.mutate()}
            onPatch={() => patchOrderMutation.mutate()}
          />
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
        ) : activeView === 'products' ? (
          <ProductManagement
            canManage={canManageProducts}
            products={productsQuery.data ?? []}
            detail={productDetailQuery.data}
            bomRows={bomQuery.data ?? []}
            pathAliasRows={pathAliasesQuery.data ?? productDetailQuery.data?.path_aliases ?? []}
            whereUsedRows={whereUsedQuery.data ?? []}
            selectedProductId={selectedProductId}
            productTypeFilter={productTypeFilter}
            productActiveFilter={productActiveFilter}
            productDraft={productDraft}
            aliasText={aliasText}
            imageUrl={imageUrl}
            bomDraftRows={bomDraftRows}
            bomChildProductId={bomChildProductId}
            bomQty={bomQty}
            bomSeq={bomSeq}
            loading={productsQuery.isFetching || productDetailQuery.isFetching || bomQuery.isFetching}
            saving={
              createProductMutation.isPending ||
              updateProductMutation.isPending ||
              softDeleteProductMutation.isPending ||
              addAliasMutation.isPending ||
              deleteAliasMutation.isPending ||
              addImageMutation.isPending ||
              replaceBomMutation.isPending ||
              regenerateAliasesMutation.isPending
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
            onBomDraftRowsChange={setBomDraftRows}
            onBomChildProductIdChange={setBomChildProductId}
            onBomQtyChange={setBomQty}
            onBomSeqChange={setBomSeq}
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
            onAddBomDraftRow={() => {
              if (!bomChildProductId.trim() || !bomQty || !bomSeq) {
                setNotice({ type: 'error', message: '请填写 BOM 子项、用量和顺序' });
                return;
              }
              setBomDraftRows((rows) =>
                [...rows, { child_product_id: bomChildProductId.trim().toUpperCase(), qty: bomQty, seq: bomSeq }].sort(
                  (left, right) => left.seq - right.seq,
                ),
              );
              setBomChildProductId('');
              setBomQty(1);
              setBomSeq((bomSeq ?? 0) + 1);
            }}
            onRemoveBomDraftRow={(index) => setBomDraftRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
            onReplaceBom={() =>
              Modal.confirm({
                title: '确认替换 BOM？',
                content: '保存后会替换当前产品的全部 BOM 明细，并立即重算路径别名。',
                okText: '保存 BOM',
                cancelText: '取消',
                onOk: () => replaceBomMutation.mutate(),
              })
            }
            onRegenerateAliases={() => regenerateAliasesMutation.mutate()}
          />
        ) : (
          <WarehouseManagement
            canManage={canManageProducts}
            warehouses={structureWarehousesQuery.data ?? []}
            slots={structureSlotsQuery.data ?? []}
            selectedWarehouseId={selectedWarehouseId}
            selectedSlotId={selectedSlotId}
            warehouseDraft={warehouseDraft}
            templateRows={templateRows}
            templateCols={templateCols}
            templateLevels={templateLevels}
            templatePositions={templatePositions}
            slotStatus={slotStatus}
            slotReason={slotReason}
            slotMergedInto={slotMergedInto}
            loading={structureWarehousesQuery.isFetching || structureSlotsQuery.isFetching}
            saving={createWarehouseMutation.isPending || generateSlotsMutation.isPending || updateSlotMutation.isPending}
            onSelectWarehouse={setSelectedWarehouseId}
            onWarehouseDraftChange={setWarehouseDraft}
            onTemplateRowsChange={setTemplateRows}
            onTemplateColsChange={setTemplateCols}
            onTemplateLevelsChange={setTemplateLevels}
            onTemplatePositionsChange={setTemplatePositions}
            onSelectSlot={(slot) => {
              setSelectedSlotId(slot.slot_id);
              setSlotStatus(slot.status);
              setSlotReason(slot.status_reason ?? '');
              setSlotMergedInto(slot.merged_into);
            }}
            onSlotStatusChange={setSlotStatus}
            onSlotReasonChange={setSlotReason}
            onSlotMergedIntoChange={setSlotMergedInto}
            onCreateWarehouse={() => createWarehouseMutation.mutate()}
            onGenerateSlots={() => generateSlotsMutation.mutate()}
            onUpdateSlot={() => updateSlotMutation.mutate()}
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

interface OrderManagementProps {
  orders: OrderSummary[];
  detail: OrderDetail | undefined;
  selectedOrderId: number | null;
  typeFilter: OrderType | undefined;
  statusFilter: string | undefined;
  draft: OrderInput;
  lineProductId: string;
  lineQty: number | null;
  patch: { partner: string; due_date: string; status: string };
  loading: boolean;
  saving: boolean;
  onTypeFilterChange: (value: OrderType | undefined) => void;
  onStatusFilterChange: (value: string | undefined) => void;
  onSelectOrder: (value: number) => void;
  onDraftChange: (value: OrderInput) => void;
  onLineProductIdChange: (value: string) => void;
  onLineQtyChange: (value: number | null) => void;
  onPatchChange: (value: { partner: string; due_date: string; status: string }) => void;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
  onCreate: () => void;
  onPatch: () => void;
}

function OrderManagement({
  orders,
  detail,
  selectedOrderId,
  typeFilter,
  statusFilter,
  draft,
  lineProductId,
  lineQty,
  patch,
  loading,
  saving,
  onTypeFilterChange,
  onStatusFilterChange,
  onSelectOrder,
  onDraftChange,
  onLineProductIdChange,
  onLineQtyChange,
  onPatchChange,
  onAddLine,
  onRemoveLine,
  onCreate,
  onPatch,
}: OrderManagementProps) {
  const orderTypeOptions: Array<{ value: OrderType; label: string }> = [
    { value: 'PURCHASE', label: '采购单' },
    { value: 'PRODUCTION', label: '生产单' },
  ];
  const statusOptions = orderStatusOptions(draft.order_type);

  return (
    <>
      <section className="operation-panel">
        <Title level={4}>订单列表</Title>
        <div className="form-grid">
          <label>
            类型
            <Select allowClear value={typeFilter} options={orderTypeOptions} placeholder="全部类型" onChange={onTypeFilterChange} />
          </label>
          <label>
            状态
            <Select
              allowClear
              value={statusFilter}
              placeholder="全部状态"
              onChange={onStatusFilterChange}
              options={[
                { value: 'PENDING', label: 'PENDING' },
                { value: 'DONE', label: 'DONE' },
                { value: 'CANCELLED', label: 'CANCELLED' },
                { value: 'SHORTAGE', label: 'SHORTAGE' },
                { value: 'IN_PRODUCTION', label: 'IN_PRODUCTION' },
                { value: 'PARTIAL_RECEIVED', label: 'PARTIAL_RECEIVED' },
                { value: 'RECEIVED', label: 'RECEIVED' },
                { value: 'PRODUCED', label: 'PRODUCED' },
              ]}
            />
          </label>
        </div>

        <Table
          size="small"
          className="inventory-table"
          loading={loading}
          dataSource={orders}
          rowKey="order_id"
          pagination={false}
          scroll={{ x: 820 }}
          columns={[
            {
              title: '订单',
              dataIndex: 'order_id',
              render: (value: number) => (
                <Button type="link" className="table-link-button" onClick={() => onSelectOrder(value)}>
                  #{value}
                </Button>
              ),
            },
            { title: '类型', dataIndex: 'order_type' },
            {
              title: '往来方',
              dataIndex: 'partner',
              render: (value: string | null) => value ?? '-',
            },
            {
              title: '交期',
              dataIndex: 'due_date',
              render: (value: string | null) => value ?? '-',
            },
            { title: '状态', dataIndex: 'status' },
            { title: '行数', dataIndex: 'line_count' },
            { title: '数量', dataIndex: 'total_qty' },
          ]}
        />
      </section>

      <section className="operation-panel">
        <Title level={4}>新建订单</Title>
        <div className="form-grid">
          <label>
            类型
            <Select
              value={draft.order_type}
              options={orderTypeOptions}
              onChange={(value) => onDraftChange({ ...draft, order_type: value, status: 'PENDING', lines: [] })}
            />
          </label>
          <label>
            往来方
            <Input value={draft.partner ?? ''} onChange={(event) => onDraftChange({ ...draft, partner: event.target.value })} />
          </label>
          <label>
            交期
            <Input
              value={draft.due_date ?? ''}
              placeholder="YYYY-MM-DD"
              onChange={(event) => onDraftChange({ ...draft, due_date: event.target.value || null })}
            />
          </label>
          <label>
            表头状态
            <Select
              value={draft.status ?? 'PENDING'}
              options={statusOptions}
              onChange={(value) => onDraftChange({ ...draft, status: value })}
            />
          </label>
        </div>

        <Title level={5}>订单行</Title>
        <div className="form-grid">
          <label>
            产品 ID
            <Input value={lineProductId} placeholder="例如 FG-TEST" onChange={(event) => onLineProductIdChange(event.target.value)} />
          </label>
          <label>
            数量
            <InputNumber min={0.0001} value={lineQty} onChange={onLineQtyChange} className="full-input" />
          </label>
        </div>
        <Space className="action-row" wrap>
          <Button onClick={onAddLine}>添加订单行</Button>
          <Button type="primary" disabled={draft.lines.length === 0} loading={saving} onClick={onCreate}>
            创建订单
          </Button>
        </Space>

        <List
          className="warning-list"
          dataSource={draft.lines}
          locale={{ emptyText: '暂无订单行' }}
          renderItem={(item: OrderLineInput, index) => (
            <List.Item
              actions={[
                <Button key="delete" size="small" danger onClick={() => onRemoveLine(index)}>
                  删除
                </Button>,
              ]}
            >
              <Space wrap>
                <Text strong>{item.product_id}</Text>
                <Text>数量 {item.qty}</Text>
                <Tag>{item.line_status ?? 'PENDING'}</Tag>
              </Space>
            </List.Item>
          )}
        />
      </section>

      <section className="operation-panel">
        <Title level={4}>订单详情</Title>
        {detail ? (
          <>
            <div className="selected-product">
              #{detail.order_id} / {detail.order_type} / {detail.status}
            </div>
            <div className="form-grid">
              <label>
                往来方
                <Input value={patch.partner} onChange={(event) => onPatchChange({ ...patch, partner: event.target.value })} />
              </label>
              <label>
                交期
                <Input
                  value={patch.due_date}
                  placeholder="YYYY-MM-DD"
                  onChange={(event) => onPatchChange({ ...patch, due_date: event.target.value })}
                />
              </label>
              <label>
                表头状态
                <Select
                  value={patch.status}
                  options={orderStatusOptions(detail.order_type)}
                  onChange={(value) => onPatchChange({ ...patch, status: value })}
                />
              </label>
            </div>
            <Space className="action-row" wrap>
              <Button type="primary" disabled={!selectedOrderId} loading={saving} onClick={onPatch}>
                更新表头
              </Button>
            </Space>

            <Table
              size="small"
              className="inventory-table"
              dataSource={detail.lines}
              rowKey="order_line_id"
              pagination={false}
              scroll={{ x: 720 }}
              columns={[
                { title: '行号', dataIndex: 'order_line_id' },
                { title: '产品', dataIndex: 'product_id' },
                { title: '名称', dataIndex: 'product_name' },
                { title: '数量', dataIndex: 'qty' },
                { title: '已完成', dataIndex: 'qty_done' },
                { title: '行状态', dataIndex: 'line_status' },
              ]}
            />
          </>
        ) : (
          <Empty description="选择一个订单后查看详情" />
        )}
      </section>
    </>
  );
}

function orderStatusOptions(orderType: OrderType) {
  const statuses =
    orderType === 'PURCHASE'
      ? ['PENDING', 'PARTIAL_RECEIVED', 'RECEIVED', 'DONE', 'CANCELLED']
      : ['PENDING', 'SHORTAGE', 'PICKED', 'IN_PRODUCTION', 'PRODUCED', 'CANCELLED'];
  return statuses.map((status) => ({ value: status, label: status }));
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
  bomRows: BomLine[];
  pathAliasRows: PathAliasRow[];
  whereUsedRows: WhereUsedRow[];
  selectedProductId: string | null;
  productTypeFilter: ProductType | undefined;
  productActiveFilter: boolean | undefined;
  productDraft: ProductInput;
  aliasText: string;
  imageUrl: string;
  bomDraftRows: BomLineInput[];
  bomChildProductId: string;
  bomQty: number | null;
  bomSeq: number | null;
  loading: boolean;
  saving: boolean;
  onTypeFilterChange: (value: ProductType | undefined) => void;
  onActiveFilterChange: (value: boolean | undefined) => void;
  onSelectProduct: (product: ProductSummary) => void;
  onDraftChange: (value: ProductInput) => void;
  onAliasTextChange: (value: string) => void;
  onImageUrlChange: (value: string) => void;
  onBomDraftRowsChange: (value: BomLineInput[]) => void;
  onBomChildProductIdChange: (value: string) => void;
  onBomQtyChange: (value: number | null) => void;
  onBomSeqChange: (value: number | null) => void;
  onCreate: () => void;
  onUpdate: () => void;
  onSoftDelete: (productId: string) => void;
  onAddAlias: () => void;
  onDeleteAlias: (aliasId: number) => void;
  onAddImage: () => void;
  onAddBomDraftRow: () => void;
  onRemoveBomDraftRow: (index: number) => void;
  onReplaceBom: () => void;
  onRegenerateAliases: () => void;
}

function ProductManagement({
  canManage,
  products,
  detail,
  bomRows,
  pathAliasRows,
  whereUsedRows,
  selectedProductId,
  productTypeFilter,
  productActiveFilter,
  productDraft,
  aliasText,
  imageUrl,
  bomDraftRows,
  bomChildProductId,
  bomQty,
  bomSeq,
  loading,
  saving,
  onTypeFilterChange,
  onActiveFilterChange,
  onSelectProduct,
  onDraftChange,
  onAliasTextChange,
  onImageUrlChange,
  onBomDraftRowsChange,
  onBomChildProductIdChange,
  onBomQtyChange,
  onBomSeqChange,
  onCreate,
  onUpdate,
  onSoftDelete,
  onAddAlias,
  onDeleteAlias,
  onAddImage,
  onAddBomDraftRow,
  onRemoveBomDraftRow,
  onReplaceBom,
  onRegenerateAliases,
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
              dataSource={pathAliasRows}
              locale={{ emptyText: '暂无路径别名' }}
              renderItem={(item) => <List.Item>{item.path_text}</List.Item>}
            />
          </>
        ) : (
          <Empty description="选择一个产品后查看详情" />
        )}
      </section>

      <section className="operation-panel">
        <Title level={4}>BOM 管理</Title>
        {detail ? (
          <>
            <Text strong>{detail.product_id} / {detail.name}</Text>
            <Table
              size="small"
              className="inventory-table"
              dataSource={bomRows}
              rowKey="bom_line_id"
              pagination={false}
              locale={{ emptyText: '暂无 BOM 明细' }}
              columns={[
                { title: '顺序', dataIndex: 'seq' },
                { title: '子项', dataIndex: 'child_product_id' },
                { title: '名称', dataIndex: 'child_name' },
                { title: '类型', dataIndex: 'child_type' },
                { title: '用量', dataIndex: 'qty' },
              ]}
            />

            <Title level={5}>编辑明细</Title>
            <div className="form-grid">
              <label>
                子项产品 ID
                <Input
                  disabled={!canManage}
                  value={bomChildProductId}
                  placeholder="例如 RM-0123"
                  onChange={(event) => onBomChildProductIdChange(event.target.value)}
                />
              </label>
              <label>
                用量
                <InputNumber disabled={!canManage} min={0.0001} value={bomQty} onChange={onBomQtyChange} className="full-input" />
              </label>
              <label>
                顺序
                <InputNumber disabled={!canManage} min={1} precision={0} value={bomSeq} onChange={onBomSeqChange} className="full-input" />
              </label>
            </div>
            <Space className="action-row" wrap>
              <Button disabled={!canManage} loading={saving} onClick={onAddBomDraftRow}>
                添加到草稿
              </Button>
              <Button disabled={!canManage || !selectedProductId} type="primary" loading={saving} onClick={onReplaceBom}>
                保存 BOM 并重算别名
              </Button>
              <Button disabled={!canManage} loading={saving} onClick={onRegenerateAliases}>
                重算路径别名
              </Button>
              <Button disabled={!canManage} onClick={() => onBomDraftRowsChange([])}>
                清空草稿
              </Button>
            </Space>

            <List
              className="warning-list"
              header="BOM 草稿"
              dataSource={bomDraftRows}
              locale={{ emptyText: '草稿为空；保存空草稿会清空该产品 BOM' }}
              renderItem={(item, index) => (
                <List.Item
                  actions={[
                    <Button key="delete" size="small" danger disabled={!canManage} onClick={() => onRemoveBomDraftRow(index)}>
                      删除
                    </Button>,
                  ]}
                >
                  <Space wrap>
                    <Tag>{item.seq}</Tag>
                    <Text strong>{item.child_product_id}</Text>
                    <Text>用量 {item.qty}</Text>
                  </Space>
                </List.Item>
              )}
            />

            <List
              className="warning-list"
              header="Where-used"
              dataSource={whereUsedRows}
              locale={{ emptyText: '暂无父项引用' }}
              renderItem={(item) => (
                <List.Item>
                  <Space wrap>
                    <Tag>{item.lvl} 层</Tag>
                    <Text strong>{item.parent_product_id}</Text>
                    <Text>{item.parent_name}</Text>
                    <Tag>{item.ptype}</Tag>
                  </Space>
                </List.Item>
              )}
            />
          </>
        ) : (
          <Empty description="选择一个产品后管理 BOM" />
        )}
      </section>
    </>
  );
}

interface WarehouseManagementProps {
  canManage: boolean;
  warehouses: StructureWarehouse[];
  slots: StructureSlot[];
  selectedWarehouseId: string | null;
  selectedSlotId: number | null;
  warehouseDraft: WarehouseInput;
  templateRows: number | null;
  templateCols: number | null;
  templateLevels: number | null;
  templatePositions: string[];
  slotStatus: SlotStatus;
  slotReason: string;
  slotMergedInto: number | null;
  loading: boolean;
  saving: boolean;
  onSelectWarehouse: (value: string) => void;
  onWarehouseDraftChange: (value: WarehouseInput) => void;
  onTemplateRowsChange: (value: number | null) => void;
  onTemplateColsChange: (value: number | null) => void;
  onTemplateLevelsChange: (value: number | null) => void;
  onTemplatePositionsChange: (value: string[]) => void;
  onSelectSlot: (slot: StructureSlot) => void;
  onSlotStatusChange: (value: SlotStatus) => void;
  onSlotReasonChange: (value: string) => void;
  onSlotMergedIntoChange: (value: number | null) => void;
  onCreateWarehouse: () => void;
  onGenerateSlots: () => void;
  onUpdateSlot: () => void;
}

function WarehouseManagement({
  canManage,
  warehouses,
  slots,
  selectedWarehouseId,
  selectedSlotId,
  warehouseDraft,
  templateRows,
  templateCols,
  templateLevels,
  templatePositions,
  slotStatus,
  slotReason,
  slotMergedInto,
  loading,
  saving,
  onSelectWarehouse,
  onWarehouseDraftChange,
  onTemplateRowsChange,
  onTemplateColsChange,
  onTemplateLevelsChange,
  onTemplatePositionsChange,
  onSelectSlot,
  onSlotStatusChange,
  onSlotReasonChange,
  onSlotMergedIntoChange,
  onCreateWarehouse,
  onGenerateSlots,
  onUpdateSlot,
}: WarehouseManagementProps) {
  const selectedWarehouse = warehouses.find((item) => item.warehouse_id === selectedWarehouseId);
  const selectedSlot = slots.find((item) => item.slot_id === selectedSlotId);
  const warehouseTypeOptions: Array<{ value: WarehouseType; label: string }> = [
    { value: 'NORMAL', label: '普通仓' },
    { value: 'MOLD', label: '模具仓' },
    { value: 'OUTSOURCE', label: '外协仓' },
  ];
  const slotStatusOptions: Array<{ value: SlotStatus; label: string }> = [
    { value: 'AVAILABLE', label: '可用' },
    { value: 'OCCUPIED', label: '占用' },
    { value: 'UNUSABLE', label: '不可用' },
    { value: 'MERGED', label: '已合并' },
  ];

  return (
    <>
      <section className="operation-panel">
        <Title level={4}>仓库结构</Title>
        {!canManage && <Alert className="form-alert" type="info" showIcon message="当前角色只能查看仓库与库位" />}
        <Table
          size="small"
          className="inventory-table"
          loading={loading}
          dataSource={warehouses}
          rowKey="warehouse_id"
          pagination={false}
          scroll={{ x: 680 }}
          columns={[
            {
              title: '仓库',
              dataIndex: 'warehouse_id',
              render: (value: string, row) => (
                <Button type="link" className="table-link-button" onClick={() => onSelectWarehouse(row.warehouse_id)}>
                  {value}
                </Button>
              ),
            },
            { title: '名称', dataIndex: 'name' },
            { title: '类型', dataIndex: 'type' },
            {
              title: '库位',
              dataIndex: 'has_slots',
              render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? '有库位' : '无库位'}</Tag>,
            },
          ]}
        />

        <div className="form-grid">
          <label>
            仓库 ID
            <Input
              disabled={!canManage}
              value={warehouseDraft.warehouse_id}
              placeholder="例如 W4"
              onChange={(event) => onWarehouseDraftChange({ ...warehouseDraft, warehouse_id: event.target.value })}
            />
          </label>
          <label>
            名称
            <Input
              disabled={!canManage}
              value={warehouseDraft.name}
              onChange={(event) => onWarehouseDraftChange({ ...warehouseDraft, name: event.target.value })}
            />
          </label>
          <label>
            类型
            <Select
              disabled={!canManage}
              value={warehouseDraft.type}
              options={warehouseTypeOptions}
              onChange={(value) =>
                onWarehouseDraftChange({ ...warehouseDraft, type: value, has_slots: value === 'OUTSOURCE' ? false : warehouseDraft.has_slots })
              }
            />
          </label>
          <label>
            是否有库位
            <Select
              disabled={!canManage || warehouseDraft.type === 'OUTSOURCE'}
              value={warehouseDraft.has_slots}
              options={[
                { value: true, label: '有库位' },
                { value: false, label: '无库位' },
              ]}
              onChange={(value) => onWarehouseDraftChange({ ...warehouseDraft, has_slots: value })}
            />
          </label>
        </div>
        <Space className="action-row" wrap>
          <Button type="primary" disabled={!canManage} loading={saving} onClick={onCreateWarehouse}>
            新增仓库
          </Button>
        </Space>
      </section>

      <section className="operation-panel">
        <Title level={4}>库位模板</Title>
        <div className="selected-product">
          {selectedWarehouse ? `${selectedWarehouse.warehouse_id} / ${selectedWarehouse.name}` : '请选择仓库'}
        </div>
        {selectedWarehouse && !selectedWarehouse.has_slots && (
          <Alert className="form-alert" type="warning" showIcon message="外协仓不生成库位" />
        )}
        <div className="form-grid">
          <label>
            排数
            <InputNumber disabled={!canManage} min={1} precision={0} value={templateRows} onChange={onTemplateRowsChange} className="full-input" />
          </label>
          <label>
            列数
            <InputNumber disabled={!canManage} min={1} precision={0} value={templateCols} onChange={onTemplateColsChange} className="full-input" />
          </label>
          <label>
            层数
            <InputNumber disabled={!canManage} min={1} precision={0} value={templateLevels} onChange={onTemplateLevelsChange} className="full-input" />
          </label>
          <label>
            位置
            <Select
              disabled={!canManage}
              mode="multiple"
              value={templatePositions}
              options={[
                { value: 'A', label: 'A' },
                { value: 'B', label: 'B' },
                { value: 'C', label: 'C' },
              ]}
              onChange={onTemplatePositionsChange}
            />
          </label>
        </div>
        <Space className="action-row" wrap>
          <Button
            disabled={!canManage || !selectedWarehouseId || selectedWarehouse?.has_slots === false}
            loading={saving}
            onClick={onGenerateSlots}
          >
            生成库位
          </Button>
        </Space>
      </section>

      <section className="operation-panel">
        <Title level={4}>库位状态</Title>
        <Table
          size="small"
          className="inventory-table"
          loading={loading}
          dataSource={slots}
          rowKey="slot_id"
          pagination={false}
          scroll={{ x: 860 }}
          locale={{ emptyText: selectedWarehouseId ? '暂无库位' : '请选择仓库' }}
          columns={[
            {
              title: '库位',
              dataIndex: 'code',
              render: (value: string, row) => (
                <Button type="link" className="table-link-button" onClick={() => onSelectSlot(row)}>
                  {value}
                </Button>
              ),
            },
            { title: '排', dataIndex: 'row_no' },
            { title: '列', dataIndex: 'col_no' },
            { title: '层', dataIndex: 'level_no' },
            { title: '位置', dataIndex: 'position' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (value: SlotStatus) => <Tag color={slotStatusColor(value)}>{value}</Tag>,
            },
            {
              title: '原因',
              dataIndex: 'status_reason',
              render: (value: string | null) => value ?? '-',
            },
            {
              title: '合并至',
              dataIndex: 'merged_into',
              render: (value: number | null) => value ?? '-',
            },
          ]}
        />

        <div className="selected-product">
          {selectedSlot ? `${selectedSlot.slot_id} / ${selectedSlot.code}` : '请选择库位'}
        </div>
        <div className="form-grid">
          <label>
            状态
            <Select disabled={!canManage} value={slotStatus} options={slotStatusOptions} onChange={onSlotStatusChange} />
          </label>
          <label>
            合并目标库位 ID
            <InputNumber disabled={!canManage || slotStatus !== 'MERGED'} min={1} precision={0} value={slotMergedInto} onChange={onSlotMergedIntoChange} className="full-input" />
          </label>
          <label>
            原因
            <Input disabled={!canManage} value={slotReason} onChange={(event) => onSlotReasonChange(event.target.value)} />
          </label>
        </div>
        <Space className="action-row" wrap>
          <Button type="primary" disabled={!canManage || !selectedSlotId} loading={saving} onClick={onUpdateSlot}>
            更新库位状态
          </Button>
        </Space>
      </section>
    </>
  );
}

function slotStatusColor(status: SlotStatus) {
  if (status === 'AVAILABLE') return 'green';
  if (status === 'UNUSABLE') return 'red';
  if (status === 'MERGED') return 'purple';
  return 'orange';
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
