import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Empty, Form, Input, InputNumber, List, Modal, Segmented, Select, Space, Table, Tag, Typography, Upload } from 'antd';
import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  BarChart3,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  FileDown,
  LogOut,
  MapPinned,
  PackageSearch,
  ScrollText,
  UploadCloud,
} from 'lucide-react';
import { CurrentUser, login } from './authApi';
import {
  BomLine,
  BomLineInput,
  getBom,
  getPathAliases,
  getProducible,
  getWhereUsed,
  PathAliasRow,
  ProducibleOptions,
  ProducibleResult,
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
  getProductPrice,
  listProducts,
  ProductDetail,
  ProductInput,
  ProductPrice,
  ProductPriceInput,
  ProductSummary,
  ProductType,
  softDeleteProduct,
  updateProduct,
  updateProductPrice,
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
  getOrderMrp,
  listOrders,
  OrderDetail,
  OrderInput,
  OrderLineInput,
  OrderMrpRow,
  OrderSummary,
  OrderType,
  patchOrder,
  receiveOrder,
} from './orderApi';
import {
  createReservation,
  fulfillReservation,
  listOrderReservations,
  releaseReservation,
  ReservationRow,
} from './reservationApi';
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
import {
  addStocktakeLine,
  applyStocktakeLine,
  createStocktake,
  Stocktake,
  StocktakeLine,
} from './stocktakeApi';
import {
  DeadStockRow,
  downloadExport,
  ExportRequestBody,
  getDeadStockReport,
  getPeriodReport,
  getSlotUtilizationReport,
  PeriodReportRow,
  ReportRange,
  SlotUtilizationRow,
} from './reportApi';
import { ImportResult, ImportType, importExcel } from './importApi';

const { Title, Paragraph, Text } = Typography;
type ActiveView = 'operations' | 'dashboard' | 'reports' | 'imports' | 'products' | 'warehouses' | 'orders' | 'stocktakes';

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
  const [activeView, setActiveView] = useState<ActiveView>('operations');
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
  const [reportRange, setReportRange] = useState<ReportRange>('day');
  const [deadStockDays, setDeadStockDays] = useState<number | null>(90);
  const [importResult, setImportResult] = useState<{ type: ImportType; result: ImportResult } | null>(null);
  const [productTypeFilter, setProductTypeFilter] = useState<ProductType | undefined>();
  const [productActiveFilter, setProductActiveFilter] = useState<boolean | undefined>(true);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productDraft, setProductDraft] = useState<ProductInput>({ type: 'RM', name: '' });
  const [priceDraft, setPriceDraft] = useState<ProductPriceInput>({});
  const [aliasText, setAliasText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [bomDraftRows, setBomDraftRows] = useState<BomLineInput[]>([]);
  const [bomChildProductId, setBomChildProductId] = useState('');
  const [bomQty, setBomQty] = useState<number | null>(1);
  const [bomSeq, setBomSeq] = useState<number | null>(1);
  const [producibleResult, setProducibleResult] = useState<ProducibleResult | null>(null);
  const [producibleMode, setProducibleMode] = useState('');
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
  const [reservationProductId, setReservationProductId] = useState('');
  const [reservationWarehouse, setReservationWarehouse] = useState('W1');
  const [reservationSlotId, setReservationSlotId] = useState<number | null>(null);
  const [reservationQty, setReservationQty] = useState<number | null>(1);
  const [reservationBatchId, setReservationBatchId] = useState<number | null>(null);
  const [receiveLineId, setReceiveLineId] = useState<number | null>(null);
  const [receiveWarehouse, setReceiveWarehouse] = useState('W1');
  const [receiveSlotId, setReceiveSlotId] = useState<number | null>(null);
  const [receiveQty, setReceiveQty] = useState<number | null>(1);
  const [receiveBatchId, setReceiveBatchId] = useState<number | null>(null);
  const [receiveReason, setReceiveReason] = useState('采购到货');
  const [currentStocktake, setCurrentStocktake] = useState<Stocktake | null>(null);
  const [stocktakeLines, setStocktakeLines] = useState<StocktakeLine[]>([]);
  const [stocktakeWarehouse, setStocktakeWarehouse] = useState('W1');
  const [stocktakeProductId, setStocktakeProductId] = useState('');
  const [stocktakeSlotId, setStocktakeSlotId] = useState<number | null>(null);
  const [stocktakeCountedQty, setStocktakeCountedQty] = useState<number | null>(0);
  const [stocktakeBatchId, setStocktakeBatchId] = useState<number | null>(null);

  const searchQuery = useQuery({
    queryKey: ['search', submittedQuery],
    queryFn: () => searchProducts(submittedQuery, auth?.accessToken),
    enabled: submittedQuery.trim().length > 0,
  });

  const results = searchQuery.data ?? [];
  const token = auth?.accessToken ?? '';
  const isAdmin = auth?.user.role === 'ADMIN';
  const canManageProducts = auth?.user.role === 'ADMIN' || auth?.user.role === 'BOSS';
  const canViewPrice = canManageProducts;
  const canEditPrice = auth?.user.role === 'BOSS';

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

  const periodReportQuery = useQuery({
    queryKey: ['period-report', token, reportRange],
    queryFn: () => getPeriodReport(token, reportRange),
    enabled: Boolean(token),
  });

  const deadStockQuery = useQuery({
    queryKey: ['dead-stock', token, deadStockDays],
    queryFn: () => getDeadStockReport(token, deadStockDays),
    enabled: Boolean(token),
  });

  const slotUtilizationQuery = useQuery({
    queryKey: ['slot-utilization', token],
    queryFn: () => getSlotUtilizationReport(token),
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

  const productPriceQuery = useQuery({
    queryKey: ['product-price', token, selectedProductId],
    queryFn: () => getProductPrice(token, selectedProductId ?? ''),
    enabled: Boolean(token && selectedProductId && canViewPrice),
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

  const orderReservationsQuery = useQuery({
    queryKey: ['order-reservations', token, selectedOrderId],
    queryFn: () => listOrderReservations(token, selectedOrderId ?? 0),
    enabled: Boolean(token && selectedOrderId),
  });

  const orderMrpQuery = useQuery({
    queryKey: ['order-mrp', token, selectedOrderId],
    queryFn: () => getOrderMrp(token, selectedOrderId ?? 0),
    enabled: Boolean(token && selectedOrderId && orderDetailQuery.data?.order_type === 'PRODUCTION'),
  });

  const reservationSlotsQuery = useQuery({
    queryKey: ['slots', token, reservationWarehouse],
    queryFn: () => getSlots(token, reservationWarehouse),
    enabled: Boolean(token && reservationWarehouse),
  });

  const receiveSlotsQuery = useQuery({
    queryKey: ['slots', token, receiveWarehouse],
    queryFn: () => getSlots(token, receiveWarehouse),
    enabled: Boolean(token && receiveWarehouse),
  });

  const stocktakeSlotsQuery = useQuery({
    queryKey: ['slots', token, stocktakeWarehouse],
    queryFn: () => getSlots(token, stocktakeWarehouse),
    enabled: Boolean(token && stocktakeWarehouse),
  });

  useEffect(() => {
    if (bomQuery.data) {
      setBomDraftRows(bomQuery.data.map((line) => ({ child_product_id: line.child_product_id, qty: line.qty, seq: line.seq })));
    }
  }, [bomQuery.data]);

  useEffect(() => {
    if (productPriceQuery.data) {
      setPriceDraft({
        cost_in: productPriceQuery.data.cost_in,
        cost_process: productPriceQuery.data.cost_process,
        cost_loss: productPriceQuery.data.cost_loss,
        price_out: productPriceQuery.data.price_out,
      });
    } else if (!selectedProductId) {
      setPriceDraft({});
    }
  }, [productPriceQuery.data, selectedProductId]);

  useEffect(() => {
    if (orderDetailQuery.data) {
      setOrderPatch({
        partner: orderDetailQuery.data.partner ?? '',
        due_date: orderDetailQuery.data.due_date ?? '',
        status: orderDetailQuery.data.status,
      });
      setReservationProductId(orderDetailQuery.data.lines[0]?.product_id ?? '');
      if (orderDetailQuery.data.order_type === 'PURCHASE') {
        const nextLine =
          orderDetailQuery.data.lines.find((line) => line.line_status !== 'CANCELLED' && line.qty_done < line.qty) ??
          orderDetailQuery.data.lines[0];
        setReceiveLineId(nextLine?.order_line_id ?? null);
        setReceiveQty(nextLine ? Math.max(nextLine.qty - nextLine.qty_done, 0) || 1 : 1);
      }
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

  const exportMutation = useMutation({
    mutationFn: (body: ExportRequestBody) => downloadExport(token, body),
    onSuccess: ({ blob, fileName }) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      setNotice({ type: 'success', message: `已生成导出文件：${fileName}` });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '导出失败' }),
  });

  const importMutation = useMutation({
    mutationFn: ({ type, file }: { type: ImportType; file: File }) => importExcel(token, type, file),
    onSuccess: (result, variables) => {
      setImportResult({ type: variables.type, result });
      setNotice({ type: 'success', message: `导入完成：${importTypeLabel(variables.type)} ${result.imported} 行` });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['product-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['bom'] });
      void queryClient.invalidateQueries({ queryKey: ['path-aliases'] });
      void queryClient.invalidateQueries({ queryKey: ['where-used'] });
      void queryClient.invalidateQueries({ queryKey: ['search'] });
      void queryClient.invalidateQueries({ queryKey: ['period-report'] });
      void queryClient.invalidateQueries({ queryKey: ['dead-stock'] });
      void queryClient.invalidateQueries({ queryKey: ['slot-utilization'] });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '导入失败' }),
  });

  const warehouseOptions = (warehousesQuery.data ?? []).map((item) => ({
    value: item.warehouse_id,
    label: `${item.warehouse_id} ${item.name}`,
  }));

  useEffect(() => {
    if (activeView === 'imports' && !canManageProducts) {
      setActiveView('operations');
    }
  }, [activeView, canManageProducts]);

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

  const updatePriceMutation = useMutation({
    mutationFn: () => updateProductPrice(token, selectedProductId ?? '', priceDraft),
    onSuccess: (price) => {
      setNotice({ type: 'success', message: `已更新价格：${price.product_id}` });
      void queryClient.invalidateQueries({ queryKey: ['product-price'] });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '更新价格失败' }),
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

  const producibleMutation = useMutation({
    mutationFn: ({ options }: { label: string; options: ProducibleOptions }) => {
      if (!selectedProductId) {
        throw new Error('请选择产品后再计算产能');
      }
      return getProducible(token, selectedProductId, options);
    },
    onSuccess: (data, variables) => {
      setProducibleResult(data);
      setProducibleMode(variables.label);
      setNotice({ type: 'success', message: `已计算 ${data.target} ${variables.label}` });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '产能推衍失败' }),
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

  const createReservationMutation = useMutation({
    mutationFn: () => {
      if (!selectedOrderId || !reservationProductId.trim() || !reservationSlotId || !reservationQty || reservationQty <= 0) {
        throw new Error('请选择订单、产品、库位并填写正数预留数量');
      }
      return createReservation(token, {
        order_id: selectedOrderId,
        product_id: reservationProductId.trim().toUpperCase(),
        slot_id: reservationSlotId,
        qty: reservationQty,
        batch_id: reservationBatchId,
      });
    },
    onSuccess: (data) => {
      setNotice({ type: 'success', message: `已预留 #${data.reservation_id}` });
      void queryClient.invalidateQueries({ queryKey: ['order-reservations'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '预留失败' }),
  });

  const fulfillReservationMutation = useMutation({
    mutationFn: (reservationId: number) => fulfillReservation(token, reservationId),
    onSuccess: (data) => {
      setNotice({ type: 'success', message: `已履约出库，流水 ${data.movement_id}` });
      void queryClient.invalidateQueries({ queryKey: ['order-reservations'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['low-stock'] });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '履约失败' }),
  });

  const releaseReservationMutation = useMutation({
    mutationFn: (reservationId: number) => releaseReservation(token, reservationId),
    onSuccess: (data) => {
      setNotice({ type: 'success', message: `已释放预留 #${data.reservation_id}` });
      void queryClient.invalidateQueries({ queryKey: ['order-reservations'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '释放失败' }),
  });

  const receiveOrderMutation = useMutation({
    mutationFn: () => {
      const detail = orderDetailQuery.data;
      const line = detail?.lines.find((item) => item.order_line_id === receiveLineId);
      if (!selectedOrderId || !line || !receiveSlotId || !receiveQty || receiveQty <= 0) {
        throw new Error('请选择采购行、库位并填写正数到货数量');
      }
      return receiveOrder(token, selectedOrderId, {
        order_line_id: line.order_line_id,
        product_id: line.product_id,
        warehouse_id: receiveWarehouse,
        slot_id: receiveSlotId,
        qty: receiveQty,
        batch_id: receiveBatchId,
        reason: receiveReason || '采购到货',
      });
    },
    onSuccess: (data) => {
      setNotice({ type: 'success', message: `已到货入库，流水 ${data.movement_id}` });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['order-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      void queryClient.invalidateQueries({ queryKey: ['order-mrp'] });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '到货失败' }),
  });

  const createStocktakeMutation = useMutation({
    mutationFn: () => createStocktake(token, { warehouse_id: stocktakeWarehouse }),
    onSuccess: (stocktake) => {
      setCurrentStocktake(stocktake);
      setStocktakeLines([]);
      setNotice({ type: 'success', message: `已发起盘点 #${stocktake.stocktake_id}` });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '发起盘点失败' }),
  });

  const addStocktakeLineMutation = useMutation({
    mutationFn: () => {
      if (!currentStocktake || !stocktakeProductId.trim() || !stocktakeSlotId || stocktakeCountedQty === null) {
        throw new Error('请选择盘点单、产品、库位并填写实盘数量');
      }
      return addStocktakeLine(token, currentStocktake.stocktake_id, {
        product_id: stocktakeProductId.trim().toUpperCase(),
        slot_id: stocktakeSlotId,
        counted_qty: stocktakeCountedQty,
        batch_id: stocktakeBatchId,
      });
    },
    onSuccess: (line) => {
      setStocktakeLines((lines) => [...lines, line]);
      setStocktakeProductId('');
      setStocktakeCountedQty(0);
      setStocktakeBatchId(null);
      setNotice({ type: 'success', message: `已录入盘点明细 #${line.stline_id}` });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '录入盘点明细失败' }),
  });

  const applyStocktakeLineMutation = useMutation({
    mutationFn: (stlineId: number) => applyStocktakeLine(token, stlineId),
    onSuccess: (data) => {
      setStocktakeLines((lines) =>
        lines.map((line) => (line.stline_id === data.stline_id ? { ...line, adj_movement_id: data.movement_id ?? 0 } : line)),
      );
      setNotice({ type: 'success', message: data.movement_id ? `已应用盘点调整，流水 ${data.movement_id}` : '账实一致，无需调整' });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['low-stock'] });
    },
    onError: (error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : '应用盘点失败' }),
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
              setActiveView('operations');
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
          onChange={(value) => setActiveView(value as ActiveView)}
          options={[
            { label: '出入库', value: 'operations', icon: <ClipboardList size={16} /> },
            { label: '订单', value: 'orders', icon: <ScrollText size={16} /> },
            { label: '盘点', value: 'stocktakes', icon: <ClipboardCheck size={16} /> },
            { label: '库存看板', value: 'dashboard', icon: <Boxes size={16} /> },
            { label: '报表', value: 'reports', icon: <BarChart3 size={16} /> },
            ...(canManageProducts ? [{ label: '导入', value: 'imports', icon: <UploadCloud size={16} /> }] : []),
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
            reservations={orderReservationsQuery.data ?? []}
            mrpRows={orderMrpQuery.data ?? []}
            selectedOrderId={selectedOrderId}
            typeFilter={orderTypeFilter}
            statusFilter={orderStatusFilter}
            draft={orderDraft}
            lineProductId={orderLineProductId}
            lineQty={orderLineQty}
            patch={orderPatch}
            reservationProductId={reservationProductId}
            reservationWarehouse={reservationWarehouse}
            reservationSlotId={reservationSlotId}
            reservationQty={reservationQty}
            reservationBatchId={reservationBatchId}
            receiveLineId={receiveLineId}
            receiveWarehouse={receiveWarehouse}
            receiveSlotId={receiveSlotId}
            receiveQty={receiveQty}
            receiveBatchId={receiveBatchId}
            receiveReason={receiveReason}
            warehouseOptions={warehouseOptions}
            reservationSlotOptions={slotOptions(reservationSlotsQuery.data)}
            receiveSlotOptions={slotOptions(receiveSlotsQuery.data)}
            loading={ordersQuery.isFetching || orderDetailQuery.isFetching || orderReservationsQuery.isFetching || orderMrpQuery.isFetching}
            saving={
              createOrderMutation.isPending ||
              patchOrderMutation.isPending ||
              createReservationMutation.isPending ||
              fulfillReservationMutation.isPending ||
              releaseReservationMutation.isPending ||
              receiveOrderMutation.isPending
            }
            onTypeFilterChange={setOrderTypeFilter}
            onStatusFilterChange={setOrderStatusFilter}
            onSelectOrder={(orderId) => {
              setSelectedOrderId(orderId);
              setReservationProductId('');
              setReservationSlotId(null);
              setReservationQty(1);
              setReservationBatchId(null);
              setReceiveLineId(null);
              setReceiveSlotId(null);
              setReceiveQty(1);
              setReceiveBatchId(null);
            }}
            onDraftChange={setOrderDraft}
            onLineProductIdChange={setOrderLineProductId}
            onLineQtyChange={setOrderLineQty}
            onPatchChange={setOrderPatch}
            onReservationProductIdChange={setReservationProductId}
            onReservationWarehouseChange={setReservationWarehouse}
            onReservationSlotIdChange={setReservationSlotId}
            onReservationQtyChange={setReservationQty}
            onReservationBatchIdChange={setReservationBatchId}
            onReceiveLineIdChange={setReceiveLineId}
            onReceiveWarehouseChange={setReceiveWarehouse}
            onReceiveSlotIdChange={setReceiveSlotId}
            onReceiveQtyChange={setReceiveQty}
            onReceiveBatchIdChange={setReceiveBatchId}
            onReceiveReasonChange={setReceiveReason}
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
            onCreateReservation={() => createReservationMutation.mutate()}
            onReceive={() => receiveOrderMutation.mutate()}
            onFulfillReservation={(reservationId) =>
              Modal.confirm({
                title: '确认履约出库？',
                content: '履约会消耗冻结预留并通过存储过程生成出库流水。',
                okText: '履约出库',
                cancelText: '取消',
                onOk: () => fulfillReservationMutation.mutate(reservationId),
              })
            }
            onReleaseReservation={(reservationId) => releaseReservationMutation.mutate(reservationId)}
          />
        ) : activeView === 'stocktakes' ? (
          <StocktakeManagement
            canApply={isAdmin}
            currentStocktake={currentStocktake}
            lines={stocktakeLines}
            warehouse={stocktakeWarehouse}
            productId={stocktakeProductId}
            slotId={stocktakeSlotId}
            countedQty={stocktakeCountedQty}
            batchId={stocktakeBatchId}
            warehouseOptions={warehouseOptions}
            slotOptions={slotOptions(stocktakeSlotsQuery.data)}
            saving={createStocktakeMutation.isPending || addStocktakeLineMutation.isPending || applyStocktakeLineMutation.isPending}
            onWarehouseChange={(value) => {
              setStocktakeWarehouse(value);
              setStocktakeSlotId(null);
            }}
            onProductIdChange={setStocktakeProductId}
            onSlotIdChange={setStocktakeSlotId}
            onCountedQtyChange={setStocktakeCountedQty}
            onBatchIdChange={setStocktakeBatchId}
            onCreateStocktake={() => createStocktakeMutation.mutate()}
            onAddLine={() => addStocktakeLineMutation.mutate()}
            onApplyLine={(stlineId) =>
              Modal.confirm({
                title: '确认应用盘点？',
                content: '应用后会调用 op_apply_stocktake_line，把库存归到实盘数。',
                okText: '应用盘点',
                cancelText: '取消',
                onOk: () => applyStocktakeLineMutation.mutate(stlineId),
              })
            }
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
        ) : activeView === 'reports' ? (
          <ReportsView
            range={reportRange}
            deadStockDays={deadStockDays}
            periodRows={periodReportQuery.data ?? []}
            deadStockRows={deadStockQuery.data ?? []}
            slotUtilizationRows={slotUtilizationQuery.data ?? []}
            loading={periodReportQuery.isFetching || deadStockQuery.isFetching || slotUtilizationQuery.isFetching}
            exporting={exportMutation.isPending}
            error={
              periodReportQuery.error instanceof Error
                ? periodReportQuery.error.message
                : deadStockQuery.error instanceof Error
                  ? deadStockQuery.error.message
                  : slotUtilizationQuery.error instanceof Error
                    ? slotUtilizationQuery.error.message
                    : null
            }
            onRangeChange={setReportRange}
            onDeadStockDaysChange={setDeadStockDays}
            onExport={(body) => exportMutation.mutate(body)}
          />
        ) : activeView === 'imports' ? (
          <ImportView
            result={importResult}
            importing={importMutation.isPending}
            onImport={(type, file) => importMutation.mutate({ type, file })}
          />
        ) : activeView === 'products' ? (
          <ProductManagement
            canManage={canManageProducts}
            canViewPrice={canViewPrice}
            canEditPrice={canEditPrice}
            products={productsQuery.data ?? []}
            detail={productDetailQuery.data}
            price={productPriceQuery.data}
            priceDraft={priceDraft}
            bomRows={bomQuery.data ?? []}
            pathAliasRows={pathAliasesQuery.data ?? productDetailQuery.data?.path_aliases ?? []}
            whereUsedRows={whereUsedQuery.data ?? []}
            producibleResult={producibleResult}
            producibleMode={producibleMode}
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
            loading={productsQuery.isFetching || productDetailQuery.isFetching || productPriceQuery.isFetching || bomQuery.isFetching}
            saving={
              createProductMutation.isPending ||
              updateProductMutation.isPending ||
              updatePriceMutation.isPending ||
              softDeleteProductMutation.isPending ||
              addAliasMutation.isPending ||
              deleteAliasMutation.isPending ||
              addImageMutation.isPending ||
              replaceBomMutation.isPending ||
              regenerateAliasesMutation.isPending ||
              producibleMutation.isPending
            }
            onTypeFilterChange={setProductTypeFilter}
            onActiveFilterChange={setProductActiveFilter}
            onSelectProduct={(product) => {
              setSelectedProductId(product.product_id);
              setProductDraft(productToInput(product));
              setPriceDraft({});
              setProducibleResult(null);
              setProducibleMode('');
            }}
            onDraftChange={setProductDraft}
            onPriceDraftChange={setPriceDraft}
            onAliasTextChange={setAliasText}
            onImageUrlChange={setImageUrl}
            onBomDraftRowsChange={setBomDraftRows}
            onBomChildProductIdChange={setBomChildProductId}
            onBomQtyChange={setBomQty}
            onBomSeqChange={setBomSeq}
            onCreate={() => createProductMutation.mutate()}
            onUpdate={() => updateProductMutation.mutate()}
            onUpdatePrice={() => updatePriceMutation.mutate()}
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
            onCalculateProducible={(label, options) => producibleMutation.mutate({ label, options })}
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

interface StocktakeManagementProps {
  canApply: boolean;
  currentStocktake: Stocktake | null;
  lines: StocktakeLine[];
  warehouse: string;
  productId: string;
  slotId: number | null;
  countedQty: number | null;
  batchId: number | null;
  warehouseOptions: Array<{ value: string; label: string }>;
  slotOptions: Array<{ value: number; label: string }>;
  saving: boolean;
  onWarehouseChange: (value: string) => void;
  onProductIdChange: (value: string) => void;
  onSlotIdChange: (value: number | null) => void;
  onCountedQtyChange: (value: number | null) => void;
  onBatchIdChange: (value: number | null) => void;
  onCreateStocktake: () => void;
  onAddLine: () => void;
  onApplyLine: (stlineId: number) => void;
}

function StocktakeManagement({
  canApply,
  currentStocktake,
  lines,
  warehouse,
  productId,
  slotId,
  countedQty,
  batchId,
  warehouseOptions,
  slotOptions,
  saving,
  onWarehouseChange,
  onProductIdChange,
  onSlotIdChange,
  onCountedQtyChange,
  onBatchIdChange,
  onCreateStocktake,
  onAddLine,
  onApplyLine,
}: StocktakeManagementProps) {
  return (
    <>
      <section className="operation-panel">
        <Title level={4}>发起盘点</Title>
        <div className="form-grid">
          <label>
            仓库
            <Select value={warehouse} options={warehouseOptions} onChange={onWarehouseChange} />
          </label>
        </div>
        <Space className="action-row" wrap>
          <Button type="primary" loading={saving} onClick={onCreateStocktake}>
            发起盘点
          </Button>
        </Space>
        <div className="selected-product">
          {currentStocktake
            ? `当前盘点 #${currentStocktake.stocktake_id} / ${currentStocktake.warehouse_id ?? '全仓'} / ${currentStocktake.status}`
            : '尚未发起盘点'}
        </div>
      </section>

      <section className="operation-panel">
        <Title level={4}>录入实盘</Title>
        <div className="form-grid">
          <label>
            产品 ID
            <Input value={productId} placeholder="例如 RM-0123" onChange={(event) => onProductIdChange(event.target.value)} />
          </label>
          <label>
            库位
            <Select value={slotId} options={slotOptions} placeholder="选择库位" onChange={onSlotIdChange} />
          </label>
          <label>
            实盘数量
            <InputNumber min={0} value={countedQty} onChange={onCountedQtyChange} className="full-input" />
          </label>
          <label>
            批次 ID
            <InputNumber min={1} precision={0} value={batchId} onChange={onBatchIdChange} className="full-input" />
          </label>
        </div>
        <Space className="action-row" wrap>
          <Button type="primary" disabled={!currentStocktake} loading={saving} onClick={onAddLine}>
            录入明细
          </Button>
        </Space>
      </section>

      <section className="operation-panel">
        <Title level={4}>盘点明细</Title>
        {!canApply && <Alert type="info" showIcon message="操作员可录入盘点，应用调整需要管理员。" />}
        <Table
          size="small"
          className="inventory-table"
          dataSource={lines}
          rowKey="stline_id"
          pagination={false}
          scroll={{ x: 920 }}
          locale={{ emptyText: '暂无盘点明细' }}
          columns={[
            { title: '明细', dataIndex: 'stline_id' },
            { title: '产品', dataIndex: 'product_id' },
            { title: '库位', dataIndex: 'slot_id' },
            { title: '账面', dataIndex: 'system_qty' },
            { title: '实盘', dataIndex: 'counted_qty' },
            {
              title: '差异',
              dataIndex: 'diff',
              render: (value: number | null) => <Tag color={(value ?? 0) === 0 ? 'green' : 'red'}>{value ?? '-'}</Tag>,
            },
            {
              title: '调整流水',
              dataIndex: 'adj_movement_id',
              render: (value: number | null) => (value === 0 ? '无需调整' : value ?? '-'),
            },
            {
              title: '操作',
              render: (_, row: StocktakeLine) =>
                canApply && row.adj_movement_id === null ? (
                  <Button size="small" loading={saving} onClick={() => onApplyLine(row.stline_id)}>
                    应用
                  </Button>
                ) : (
                  '-'
                ),
            },
          ]}
        />
      </section>
    </>
  );
}

interface OrderManagementProps {
  orders: OrderSummary[];
  detail: OrderDetail | undefined;
  reservations: ReservationRow[];
  mrpRows: OrderMrpRow[];
  selectedOrderId: number | null;
  typeFilter: OrderType | undefined;
  statusFilter: string | undefined;
  draft: OrderInput;
  lineProductId: string;
  lineQty: number | null;
  patch: { partner: string; due_date: string; status: string };
  reservationProductId: string;
  reservationWarehouse: string;
  reservationSlotId: number | null;
  reservationQty: number | null;
  reservationBatchId: number | null;
  receiveLineId: number | null;
  receiveWarehouse: string;
  receiveSlotId: number | null;
  receiveQty: number | null;
  receiveBatchId: number | null;
  receiveReason: string;
  warehouseOptions: Array<{ value: string; label: string }>;
  reservationSlotOptions: Array<{ value: number; label: string }>;
  receiveSlotOptions: Array<{ value: number; label: string }>;
  loading: boolean;
  saving: boolean;
  onTypeFilterChange: (value: OrderType | undefined) => void;
  onStatusFilterChange: (value: string | undefined) => void;
  onSelectOrder: (value: number) => void;
  onDraftChange: (value: OrderInput) => void;
  onLineProductIdChange: (value: string) => void;
  onLineQtyChange: (value: number | null) => void;
  onPatchChange: (value: { partner: string; due_date: string; status: string }) => void;
  onReservationProductIdChange: (value: string) => void;
  onReservationWarehouseChange: (value: string) => void;
  onReservationSlotIdChange: (value: number | null) => void;
  onReservationQtyChange: (value: number | null) => void;
  onReservationBatchIdChange: (value: number | null) => void;
  onReceiveLineIdChange: (value: number | null) => void;
  onReceiveWarehouseChange: (value: string) => void;
  onReceiveSlotIdChange: (value: number | null) => void;
  onReceiveQtyChange: (value: number | null) => void;
  onReceiveBatchIdChange: (value: number | null) => void;
  onReceiveReasonChange: (value: string) => void;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
  onCreate: () => void;
  onPatch: () => void;
  onReceive: () => void;
  onCreateReservation: () => void;
  onFulfillReservation: (reservationId: number) => void;
  onReleaseReservation: (reservationId: number) => void;
}

function OrderManagement({
  orders,
  detail,
  reservations,
  mrpRows,
  selectedOrderId,
  typeFilter,
  statusFilter,
  draft,
  lineProductId,
  lineQty,
  patch,
  reservationProductId,
  reservationWarehouse,
  reservationSlotId,
  reservationQty,
  reservationBatchId,
  receiveLineId,
  receiveWarehouse,
  receiveSlotId,
  receiveQty,
  receiveBatchId,
  receiveReason,
  warehouseOptions,
  reservationSlotOptions,
  receiveSlotOptions,
  loading,
  saving,
  onTypeFilterChange,
  onStatusFilterChange,
  onSelectOrder,
  onDraftChange,
  onLineProductIdChange,
  onLineQtyChange,
  onPatchChange,
  onReservationProductIdChange,
  onReservationWarehouseChange,
  onReservationSlotIdChange,
  onReservationQtyChange,
  onReservationBatchIdChange,
  onReceiveLineIdChange,
  onReceiveWarehouseChange,
  onReceiveSlotIdChange,
  onReceiveQtyChange,
  onReceiveBatchIdChange,
  onReceiveReasonChange,
  onAddLine,
  onRemoveLine,
  onCreate,
  onPatch,
  onReceive,
  onCreateReservation,
  onFulfillReservation,
  onReleaseReservation,
}: OrderManagementProps) {
  const orderTypeOptions: Array<{ value: OrderType; label: string }> = [
    { value: 'PURCHASE', label: '采购单' },
    { value: 'PRODUCTION', label: '生产单' },
  ];
  const statusOptions = orderStatusOptions(draft.order_type);
  const reservationProductOptions =
    detail?.lines.map((line) => ({ value: line.product_id, label: `${line.product_id} ${line.product_name}` })) ?? [];
  const receiveLineOptions =
    detail?.lines.map((line) => ({
      value: line.order_line_id,
      label: `${line.product_id} ${line.product_name} / 剩余 ${Math.max(line.qty - line.qty_done, 0)}`,
    })) ?? [];
  const selectedReceiveLine = detail?.lines.find((line) => line.order_line_id === receiveLineId);

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

            {detail.order_type === 'PURCHASE' && (
              <section className="operation-panel">
                <Title level={5}>采购到货</Title>
                <div className="form-grid">
                  <label>
                    采购行
                    <Select
                      value={receiveLineId}
                      options={receiveLineOptions}
                      placeholder="选择采购行"
                      onChange={onReceiveLineIdChange}
                    />
                  </label>
                  <label>
                    仓库
                    <Select
                      value={receiveWarehouse}
                      options={warehouseOptions}
                      onChange={(value) => {
                        onReceiveWarehouseChange(value);
                        onReceiveSlotIdChange(null);
                      }}
                    />
                  </label>
                  <label>
                    库位
                    <Select value={receiveSlotId} options={receiveSlotOptions} placeholder="选择库位" onChange={onReceiveSlotIdChange} />
                  </label>
                  <label>
                    数量
                    <InputNumber min={0.0001} value={receiveQty} onChange={onReceiveQtyChange} className="full-input" />
                  </label>
                  <label>
                    批次 ID
                    <InputNumber min={1} precision={0} value={receiveBatchId} onChange={onReceiveBatchIdChange} className="full-input" />
                  </label>
                  <label>
                    原因
                    <Input value={receiveReason} onChange={(event) => onReceiveReasonChange(event.target.value)} />
                  </label>
                </div>
                {selectedReceiveLine && (
                  <Paragraph className="helper-text">
                    当前行剩余 {Math.max(selectedReceiveLine.qty - selectedReceiveLine.qty_done, 0)}，到货会调用 op_inbound 并挂回订单。
                  </Paragraph>
                )}
                <Space className="action-row" wrap>
                  <Button type="primary" disabled={!selectedOrderId} loading={saving} onClick={onReceive}>
                    到货入库
                  </Button>
                </Space>
              </section>
            )}

            {detail.order_type === 'PRODUCTION' && (
              <section className="operation-panel">
                <Title level={5}>缺料推衍</Title>
                <Table
                  size="small"
                  className="inventory-table"
                  dataSource={mrpRows}
                  rowKey={(row) => `${row.lvl}-${row.product_id}`}
                  pagination={false}
                  scroll={{ x: 720 }}
                  locale={{ emptyText: '暂无缺料推衍结果' }}
                  columns={[
                    { title: '层级', dataIndex: 'lvl' },
                    { title: '产品', dataIndex: 'product_id' },
                    { title: '类型', dataIndex: 'ptype' },
                    { title: '毛需求', dataIndex: 'gross_demand' },
                    { title: '在库', dataIndex: 'on_hand' },
                    {
                      title: '缺口',
                      dataIndex: 'net_required',
                      render: (value: number) => <Tag color={value > 0 ? 'red' : 'green'}>{value}</Tag>,
                    },
                  ]}
                />
              </section>
            )}

            <section className="operation-panel">
              <Title level={5}>预留</Title>
              <div className="form-grid">
                <label>
                  产品
                  <Select
                    value={reservationProductId || undefined}
                    options={reservationProductOptions}
                    placeholder="选择订单行产品"
                    onChange={onReservationProductIdChange}
                  />
                </label>
                <label>
                  仓库
                  <Select
                    value={reservationWarehouse}
                    options={warehouseOptions}
                    onChange={(value) => {
                      onReservationWarehouseChange(value);
                      onReservationSlotIdChange(null);
                    }}
                  />
                </label>
                <label>
                  库位
                  <Select
                    value={reservationSlotId}
                    options={reservationSlotOptions}
                    placeholder="选择库位"
                    onChange={onReservationSlotIdChange}
                  />
                </label>
                <label>
                  数量
                  <InputNumber min={0.0001} value={reservationQty} onChange={onReservationQtyChange} className="full-input" />
                </label>
                <label>
                  批次 ID
                  <InputNumber min={1} precision={0} value={reservationBatchId} onChange={onReservationBatchIdChange} className="full-input" />
                </label>
              </div>
              <Space className="action-row" wrap>
                <Button type="primary" disabled={!selectedOrderId} loading={saving} onClick={onCreateReservation}>
                  创建预留
                </Button>
              </Space>

              <Table
                size="small"
                className="inventory-table"
                dataSource={reservations}
                rowKey="reservation_id"
                pagination={false}
                scroll={{ x: 920 }}
                locale={{ emptyText: '暂无预留' }}
                columns={[
                  { title: '预留', dataIndex: 'reservation_id' },
                  { title: '产品', dataIndex: 'product_id' },
                  { title: '库位', dataIndex: 'slot_code' },
                  { title: '数量', dataIndex: 'qty' },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    render: (value: ReservationRow['status']) => (
                      <Tag color={value === 'RESERVED' ? 'blue' : value === 'CONSUMED' ? 'green' : 'default'}>{value}</Tag>
                    ),
                  },
                  {
                    title: '操作',
                    render: (_, row: ReservationRow) =>
                      row.status === 'RESERVED' ? (
                        <Space wrap>
                          <Button size="small" loading={saving} onClick={() => onFulfillReservation(row.reservation_id)}>
                            履约
                          </Button>
                          <Button size="small" loading={saving} onClick={() => onReleaseReservation(row.reservation_id)}>
                            释放
                          </Button>
                        </Space>
                      ) : (
                        '-'
                      ),
                  },
                ]}
              />
            </section>
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

interface ReportsViewProps {
  range: ReportRange;
  deadStockDays: number | null;
  periodRows: PeriodReportRow[];
  deadStockRows: DeadStockRow[];
  slotUtilizationRows: SlotUtilizationRow[];
  loading: boolean;
  exporting: boolean;
  error: string | null;
  onRangeChange: (value: ReportRange) => void;
  onDeadStockDaysChange: (value: number | null) => void;
  onExport: (body: ExportRequestBody) => void;
}

function ReportsView({
  range,
  deadStockDays,
  periodRows,
  deadStockRows,
  slotUtilizationRows,
  loading,
  exporting,
  error,
  onRangeChange,
  onDeadStockDaysChange,
  onExport,
}: ReportsViewProps) {
  return (
    <>
      <section className="operation-panel">
        <Title level={4}>报表导出</Title>
        {error && <Alert className="form-alert" type="error" showIcon message="报表查询失败" description={error} />}
        <Space className="action-row" wrap>
          <Button icon={<FileDown size={16} />} loading={exporting} onClick={() => onExport({ type: 'inventory' })}>
            导出库存
          </Button>
          <Button icon={<FileDown size={16} />} loading={exporting} onClick={() => onExport({ type: 'movements' })}>
            导出流水
          </Button>
          <Button
            icon={<FileDown size={16} />}
            loading={exporting}
            onClick={() => onExport({ type: 'period', range })}
          >
            导出周期报表
          </Button>
          <Button
            icon={<FileDown size={16} />}
            loading={exporting}
            onClick={() => onExport({ type: 'dead-stock', days: deadStockDays ?? undefined })}
          >
            导出呆滞库存
          </Button>
        </Space>
      </section>

      <section className="operation-panel">
        <Title level={4}>日/周/月报</Title>
        <Segmented
          value={range}
          onChange={(value) => onRangeChange(value as ReportRange)}
          options={[
            { label: '日', value: 'day' },
            { label: '周', value: 'week' },
            { label: '月', value: 'month' },
          ]}
        />
        <Table
          size="small"
          className="inventory-table"
          loading={loading}
          dataSource={periodRows}
          rowKey="period"
          pagination={false}
          scroll={{ x: 760 }}
          locale={{ emptyText: '暂无周期流水' }}
          columns={[
            { title: '周期', dataIndex: 'period' },
            { title: '流水数', dataIndex: 'movement_count' },
            { title: '入库', dataIndex: 'inbound_qty' },
            { title: '出库', dataIndex: 'outbound_qty' },
            { title: '调整', dataIndex: 'adjustment_qty' },
            {
              title: '净变动',
              dataIndex: 'net_qty',
              render: (value: number) => <Tag color={value >= 0 ? 'green' : 'red'}>{value}</Tag>,
            },
          ]}
        />
      </section>

      <section className="operation-panel">
        <Title level={4}>呆滞库存</Title>
        <div className="form-grid compact-grid">
          <label>
            无流水天数
            <InputNumber
              min={1}
              max={3650}
              precision={0}
              value={deadStockDays}
              onChange={onDeadStockDaysChange}
              className="full-input"
            />
          </label>
        </div>
        <Table
          size="small"
          className="inventory-table"
          loading={loading}
          dataSource={deadStockRows}
          rowKey="product_id"
          pagination={false}
          scroll={{ x: 760 }}
          locale={{ emptyText: '暂无呆滞库存' }}
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
            { title: '在库', dataIndex: 'qty_on_hand' },
            {
              title: '最近流水',
              dataIndex: 'last_movement_at',
              render: (value: string | null) => value ?? '无流水',
            },
            {
              title: '呆滞天数',
              dataIndex: 'idle_days',
              render: (value: number | null) => value ?? '-',
            },
          ]}
        />
      </section>

      <section className="operation-panel">
        <Title level={4}>库位利用率</Title>
        <Table
          size="small"
          className="inventory-table"
          loading={loading}
          dataSource={slotUtilizationRows}
          rowKey="warehouse_id"
          pagination={false}
          scroll={{ x: 680 }}
          locale={{ emptyText: '暂无库位数据' }}
          columns={[
            {
              title: '仓库',
              dataIndex: 'warehouse_id',
              render: (value: string, row) => (
                <Space direction="vertical" size={0}>
                  <Text strong>{value}</Text>
                  <Text type="secondary">{row.warehouse_name}</Text>
                </Space>
              ),
            },
            { title: '总库位', dataIndex: 'total_slots' },
            { title: '占用库位', dataIndex: 'occupied_slots' },
            {
              title: '利用率',
              dataIndex: 'utilization_rate',
              render: (value: number) => <Tag color={value >= 80 ? 'orange' : 'blue'}>{value}%</Tag>,
            },
          ]}
        />
      </section>
    </>
  );
}

interface ImportViewProps {
  result: { type: ImportType; result: ImportResult } | null;
  importing: boolean;
  onImport: (type: ImportType, file: File) => void;
}

function ImportView({ result, importing, onImport }: ImportViewProps) {
  return (
    <>
      <section className="operation-panel">
        <Title level={4}>Excel 导入</Title>
        <Alert
          type="info"
          showIcon
          message="导入端点仅管理员及以上可用；初始库存导入会调用 op_inbound 生成库存与流水。"
        />
        <div className="import-grid">
          <ImportUploadCard
            title="产品批量导入"
            description="表头：product_id, type, name, safety_stock, remark, has_tube, has_alu_plate, has_dust_cover, attrs"
            type="products"
            loading={importing}
            onImport={onImport}
          />
          <ImportUploadCard
            title="初始库存导入"
            description="表头：product_id, warehouse_id, slot_id, batch_id, qty, quality, reason"
            type="inventory"
            loading={importing}
            onImport={onImport}
          />
          <ImportUploadCard
            title="BOM 批量导入"
            description="表头：parent_product_id, child_product_id, qty, seq；导入后自动重算路径别名"
            type="bom"
            loading={importing}
            onImport={onImport}
          />
        </div>
      </section>

      <section className="operation-panel">
        <Title level={4}>最近导入结果</Title>
        {result ? (
          <Space direction="vertical" size={8}>
            <Tag color="green">
              {importTypeLabel(result.type)}：{result.result.imported} 行
            </Tag>
            {result.result.product_ids && <Text>产品：{result.result.product_ids.join(', ')}</Text>}
            {result.result.movement_ids && <Text>流水：{result.result.movement_ids.join(', ')}</Text>}
            {result.result.parent_product_ids && <Text>BOM 父项：{result.result.parent_product_ids.join(', ')}</Text>}
            {result.result.regenerated_aliases !== undefined && <Text>路径别名重算：{result.result.regenerated_aliases}</Text>}
          </Space>
        ) : (
          <Empty description="上传 Excel 后显示导入结果" />
        )}
      </section>
    </>
  );
}

interface ImportUploadCardProps {
  title: string;
  description: string;
  type: ImportType;
  loading: boolean;
  onImport: (type: ImportType, file: File) => void;
}

function ImportUploadCard({ title, description, type, loading, onImport }: ImportUploadCardProps) {
  return (
    <div className="import-card">
      <Text strong>{title}</Text>
      <Text type="secondary">{description}</Text>
      <Upload
        accept=".xlsx"
        maxCount={1}
        showUploadList={false}
        beforeUpload={(file) => {
          onImport(type, file);
          return false;
        }}
      >
        <Button icon={<UploadCloud size={16} />} loading={loading}>
          上传 Excel
        </Button>
      </Upload>
    </div>
  );
}

function importTypeLabel(type: ImportType) {
  if (type === 'products') return '产品';
  if (type === 'inventory') return '初始库存';
  return 'BOM';
}

interface ProductManagementProps {
  canManage: boolean;
  canViewPrice: boolean;
  canEditPrice: boolean;
  products: ProductSummary[];
  detail: ProductDetail | undefined;
  price: ProductPrice | undefined;
  priceDraft: ProductPriceInput;
  bomRows: BomLine[];
  pathAliasRows: PathAliasRow[];
  whereUsedRows: WhereUsedRow[];
  producibleResult: ProducibleResult | null;
  producibleMode: string;
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
  onPriceDraftChange: (value: ProductPriceInput) => void;
  onAliasTextChange: (value: string) => void;
  onImageUrlChange: (value: string) => void;
  onBomDraftRowsChange: (value: BomLineInput[]) => void;
  onBomChildProductIdChange: (value: string) => void;
  onBomQtyChange: (value: number | null) => void;
  onBomSeqChange: (value: number | null) => void;
  onCreate: () => void;
  onUpdate: () => void;
  onUpdatePrice: () => void;
  onSoftDelete: (productId: string) => void;
  onAddAlias: () => void;
  onDeleteAlias: (aliasId: number) => void;
  onAddImage: () => void;
  onAddBomDraftRow: () => void;
  onRemoveBomDraftRow: (index: number) => void;
  onReplaceBom: () => void;
  onRegenerateAliases: () => void;
  onCalculateProducible: (label: string, options: ProducibleOptions) => void;
}

function ProductManagement({
  canManage,
  canViewPrice,
  canEditPrice,
  products,
  detail,
  price,
  priceDraft,
  bomRows,
  pathAliasRows,
  whereUsedRows,
  producibleResult,
  producibleMode,
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
  onPriceDraftChange,
  onAliasTextChange,
  onImageUrlChange,
  onBomDraftRowsChange,
  onBomChildProductIdChange,
  onBomQtyChange,
  onBomSeqChange,
  onCreate,
  onUpdate,
  onUpdatePrice,
  onSoftDelete,
  onAddAlias,
  onDeleteAlias,
  onAddImage,
  onAddBomDraftRow,
  onRemoveBomDraftRow,
  onReplaceBom,
  onRegenerateAliases,
  onCalculateProducible,
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

      {canViewPrice && (
        <section className="operation-panel">
          <Title level={4}>价格</Title>
          {detail ? (
            <>
              {!canEditPrice && <Alert className="form-alert" type="info" showIcon message="当前角色可查看价格，只有老板可修改。" />}
              <Text strong>
                {detail.product_id} / {detail.name}
              </Text>
              <div className="form-grid">
                <label>
                  入货成本
                  <InputNumber
                    disabled={!canEditPrice}
                    className="full-input"
                    min={0}
                    value={priceDraft.cost_in ?? null}
                    onChange={(value) => onPriceDraftChange({ ...priceDraft, cost_in: value })}
                  />
                </label>
                <label>
                  加工成本
                  <InputNumber
                    disabled={!canEditPrice}
                    className="full-input"
                    min={0}
                    value={priceDraft.cost_process ?? null}
                    onChange={(value) => onPriceDraftChange({ ...priceDraft, cost_process: value })}
                  />
                </label>
                <label>
                  损耗成本
                  <InputNumber
                    disabled={!canEditPrice}
                    className="full-input"
                    min={0}
                    value={priceDraft.cost_loss ?? null}
                    onChange={(value) => onPriceDraftChange({ ...priceDraft, cost_loss: value })}
                  />
                </label>
                <label>
                  出货价格
                  <InputNumber
                    disabled={!canEditPrice}
                    className="full-input"
                    min={0}
                    value={priceDraft.price_out ?? null}
                    onChange={(value) => onPriceDraftChange({ ...priceDraft, price_out: value })}
                  />
                </label>
              </div>
              <Space className="action-row" wrap>
                <Button disabled={!canEditPrice || !selectedProductId} type="primary" loading={saving} onClick={onUpdatePrice}>
                  保存价格
                </Button>
                <Text type="secondary">
                  最近更新：{price?.updated_at ?? '无'} {price?.updated_by ? `/ 用户 ${price.updated_by}` : ''}
                </Text>
              </Space>
            </>
          ) : (
            <Empty description="选择一个产品后查看价格" />
          )}
        </section>
      )}

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

      <section className="operation-panel">
        <Title level={4}>产能推衍</Title>
        {detail ? (
          <>
            <Text strong>{detail.product_id} / {detail.name}</Text>
            <Space className="action-row" wrap>
              <Button loading={saving} onClick={() => onCalculateProducible('单层', {})}>
                单层计算
              </Button>
              <Button loading={saving} onClick={() => onCalculateProducible('深度', { deep: true })}>
                深度计算
              </Button>
              <Button loading={saving} onClick={() => onCalculateProducible('深度（不用半成品库存）', { deep: true, useSfStock: false })}>
                深度计算（不用半成品库存）
              </Button>
            </Space>

            {producibleResult ? (
              <List
                className="warning-list"
                header={`计算结果：${producibleMode}`}
                dataSource={[
                  ['目标产品', producibleResult.target],
                  ['最多可做', producibleResult.maxMake],
                  ['卡脖子物料', producibleResult.limiting ?? '-'],
                  ['卡点在库', producibleResult.limitingOnHand ?? '-'],
                  ...(producibleResult.limitingDemand === undefined
                    ? []
                    : ([['卡点需求', producibleResult.limitingDemand ?? '-']] as Array<[string, string | number]>)),
                ]}
                renderItem={([label, value]) => (
                  <List.Item>
                    <Space>
                      <Text type="secondary">{label}</Text>
                      <Text strong>{value}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="点击计算后显示产能结果" />
            )}
          </>
        ) : (
          <Empty description="选择一个半成品或成品后计算产能" />
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
