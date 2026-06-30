import { CSSProperties, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Empty, Input, InputNumber, List, Segmented, Select, Space, Tag, Typography, message } from 'antd';
import { Boxes, Layers, MapPinned, Plus, Save, Search } from 'lucide-react';
import type { CurrentUser } from './authApi';
import { getWarehouses, type Warehouse } from './operationsApi';
import { SearchResult, searchProducts } from './searchApi';
import {
  createWarehouseLayout,
  getProductVisualLocations,
  getWarehouseLayout,
  listRackTemplates,
  listWarehouseLayoutTemplates,
  saveWarehouseLayout,
  type LayoutZone,
  type ProductVisualHighlightKind,
  type ProductVisualLocation,
  type RackLayout,
  type RackTemplate,
  type WarehouseLayout,
  type WarehouseLayoutTemplate,
} from './warehouseMapApi';
import {
  buildElevationCells,
  buildWarehouseLayoutSaveInput,
  getRackHitCount,
  getWarehouseHitCount,
  groupLocationsByWarehouse,
  normalizeCanvasPosition,
} from './warehouseMapModel';

const { Title, Text } = Typography;

type WarehouseMapMode = 'locate' | 'design';
type WarehouseMapView = 'top' | 'elevation';
type ProductTypeFilter = 'ALL' | 'RM' | 'SF' | 'FG' | 'ACC';
type SelectedLayoutElement = { kind: 'zone'; id: number } | { kind: 'rack'; id: number } | null;

interface WarehouseMapPageProps {
  token: string;
  user: CurrentUser;
}

const productTypeOptions: Array<{ label: string; value: ProductTypeFilter }> = [
  { label: '全部', value: 'ALL' },
  { label: '原料', value: 'RM' },
  { label: '半成品', value: 'SF' },
  { label: '成品', value: 'FG' },
  { label: '配件', value: 'ACC' },
];

const highlightLabels: Record<ProductVisualHighlightKind, string> = {
  GOOD: '良品',
  DEFECTIVE: '不良',
  UNAVAILABLE: '不可用',
  UNMAPPED: '未映射',
};

const highlightClassNames: Record<ProductVisualHighlightKind, string> = {
  GOOD: 'warehouse-map-hit-good',
  DEFECTIVE: 'warehouse-map-hit-defective',
  UNAVAILABLE: 'warehouse-map-hit-unavailable',
  UNMAPPED: 'warehouse-map-hit-unmapped',
};

const emptyLayoutSize = { canvas_width: 960, canvas_height: 620, grid_size: 20 };

export function WarehouseMapPage({ token, user }: WarehouseMapPageProps) {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const canDesign = user.role === 'ADMIN' || user.role === 'BOSS';
  const [mode, setMode] = useState<WarehouseMapMode>('locate');
  const [view, setView] = useState<WarehouseMapView>('top');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ProductTypeFilter>('ALL');
  const [selectedProduct, setSelectedProduct] = useState<SearchResult | null>(null);
  const [draftLayout, setDraftLayout] = useState<WarehouseLayout | null>(null);
  const [selectedRackLayoutId, setSelectedRackLayoutId] = useState<number | null>(null);
  const [selectedElement, setSelectedElement] = useState<SelectedLayoutElement>(null);
  const [layoutTemplateId, setLayoutTemplateId] = useState<number | null>(null);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [newZoneCode, setNewZoneCode] = useState('');
  const [newZoneName, setNewZoneName] = useState('');
  const [newRackTemplateId, setNewRackTemplateId] = useState<number | null>(null);

  const warehousesQuery = useQuery({
    queryKey: ['warehouse-map-warehouses', token],
    queryFn: () => getWarehouses(token),
    enabled: Boolean(token),
  });

  const layoutTemplatesQuery = useQuery({
    queryKey: ['warehouse-layout-templates', token],
    queryFn: () => listWarehouseLayoutTemplates(token),
    enabled: Boolean(token && canDesign),
  });

  const rackTemplatesQuery = useQuery({
    queryKey: ['rack-templates', token],
    queryFn: () => listRackTemplates(token),
    enabled: Boolean(token),
  });

  const layoutQuery = useQuery({
    queryKey: ['warehouse-layout', token, selectedWarehouseId],
    queryFn: () => getWarehouseLayout(token, selectedWarehouseId),
    enabled: Boolean(token && selectedWarehouseId),
  });

  const productSearchQuery = useQuery({
    queryKey: ['warehouse-map-search', token, submittedQuery],
    queryFn: () => searchProducts(submittedQuery, token),
    enabled: Boolean(token && submittedQuery),
  });

  const locationsQuery = useQuery({
    queryKey: ['product-visual-locations', token, selectedProduct?.product_id],
    queryFn: () => getProductVisualLocations(token, selectedProduct?.product_id ?? ''),
    enabled: Boolean(token && selectedProduct),
  });

  const warehouses = warehousesQuery.data ?? [];
  const rackTemplates = rackTemplatesQuery.data ?? [];
  const locations = locationsQuery.data ?? [];
  const locationsByWarehouse = useMemo(() => groupLocationsByWarehouse(locations), [locations]);
  const currentWarehouseLocations = locationsByWarehouse.get(selectedWarehouseId) ?? [];

  const filteredSearchResults = useMemo(() => {
    const rows = productSearchQuery.data ?? [];
    if (typeFilter === 'ALL') return rows;
    return rows.filter((row) => row.product_id.startsWith(`${typeFilter}-`));
  }, [productSearchQuery.data, typeFilter]);

  const selectedWarehouse = warehouses.find((warehouse) => warehouse.warehouse_id === selectedWarehouseId) ?? null;
  const selectedRack = draftLayout?.racks.find((rack) => rack.rack_layout_id === selectedRackLayoutId) ?? draftLayout?.racks[0] ?? null;
  const selectedRackTemplate = selectedRack
    ? rackTemplates.find((template) => template.template_id === selectedRack.template_id) ?? null
    : null;

  useEffect(() => {
    if (!selectedWarehouseId && warehouses.length > 0) {
      setSelectedWarehouseId(warehouses[0].warehouse_id);
    }
  }, [selectedWarehouseId, warehouses]);

  useEffect(() => {
    setDraftLayout(layoutQuery.data ? cloneLayout(layoutQuery.data) : null);
    setSelectedElement(null);
    setSelectedRackLayoutId(layoutQuery.data?.racks[0]?.rack_layout_id ?? null);
    setNewLayoutName(layoutQuery.data?.name ?? '');
  }, [layoutQuery.data]);

  useEffect(() => {
    if (!canDesign && mode === 'design') {
      setMode('locate');
    }
  }, [canDesign, mode]);

  const createLayoutMutation = useMutation({
    mutationFn: () => {
      if (!selectedWarehouseId) {
        throw new Error('请选择仓库');
      }
      return createWarehouseLayout(token, {
        warehouse_id: selectedWarehouseId,
        layout_template_id: layoutTemplateId,
        name: newLayoutName.trim() || `${selectedWarehouseId} 平面布局`,
        canvas_width: emptyLayoutSize.canvas_width,
        canvas_height: emptyLayoutSize.canvas_height,
        grid_size: emptyLayoutSize.grid_size,
      });
    },
    onSuccess: (layout) => {
      setDraftLayout(cloneLayout(layout));
      setSelectedRackLayoutId(layout.racks[0]?.rack_layout_id ?? null);
      void queryClient.invalidateQueries({ queryKey: ['warehouse-layout', token, selectedWarehouseId] });
      messageApi.success('已创建仓库布局');
    },
    onError: (error) => messageApi.error(error instanceof Error ? error.message : '创建布局失败'),
  });

  const saveLayoutMutation = useMutation({
    mutationFn: () => {
      if (!draftLayout) {
        throw new Error('当前仓库还没有布局');
      }
      return saveWarehouseLayout(token, draftLayout.layout_id, buildWarehouseLayoutSaveInput(draftLayout));
    },
    onSuccess: (layout) => {
      setDraftLayout(cloneLayout(layout));
      void queryClient.invalidateQueries({ queryKey: ['warehouse-layout', token, selectedWarehouseId] });
      messageApi.success('已保存仓库布局');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '保存布局失败';
      messageApi.error(message.includes('409') || message.includes('版本') ? '布局已被其他人修改，请刷新后重试' : message);
    },
  });

  const handleLocationSelect = (location: ProductVisualLocation) => {
    setSelectedWarehouseId(location.warehouse_id);
    if (location.rack_layout_id) {
      setSelectedRackLayoutId(location.rack_layout_id);
      setSelectedElement({ kind: 'rack', id: location.rack_layout_id });
    }
  };

  const updateDraftLayout = (updater: (layout: WarehouseLayout) => WarehouseLayout) => {
    setDraftLayout((current) => (current ? updater(current) : current));
  };

  const handleElementMove = (kind: 'zone' | 'rack', id: number, x: number, y: number) => {
    updateDraftLayout((layout) => {
      const gridSize = layout.grid_size || 1;
      if (kind === 'zone') {
        return {
          ...layout,
          zones: layout.zones.map((zone) =>
            zone.zone_id === id ? { ...zone, x: normalizeCanvasPosition(x, gridSize), y: normalizeCanvasPosition(y, gridSize) } : zone,
          ),
        };
      }
      return {
        ...layout,
        racks: layout.racks.map((rack) =>
          rack.rack_layout_id === id ? { ...rack, x: normalizeCanvasPosition(x, gridSize), y: normalizeCanvasPosition(y, gridSize) } : rack,
        ),
      };
    });
  };

  const addZone = () => {
    if (!draftLayout) return;
    const seq = draftLayout.zones.length + 1;
    const zone: LayoutZone = {
      zone_id: -Date.now(),
      code: newZoneCode.trim().toUpperCase() || `Z${seq}`,
      name: newZoneName.trim() || `区域 ${seq}`,
      x: 40,
      y: 40 + (seq - 1) * 32,
      width: 260,
      height: 180,
      color: '#edf2ff',
      seq,
    };
    updateDraftLayout((layout) => ({ ...layout, zones: [...layout.zones, zone] }));
    setSelectedElement({ kind: 'zone', id: zone.zone_id });
    setNewZoneCode('');
    setNewZoneName('');
  };

  const addRack = () => {
    if (!draftLayout || !newRackTemplateId) return;
    const template = rackTemplates.find((item) => item.template_id === newRackTemplateId);
    if (!template) return;
    const seq = draftLayout.racks.length + 1;
    const rack: RackLayout = {
      rack_layout_id: -Date.now(),
      template_id: template.template_id,
      zone_id: selectedElement?.kind === 'zone' ? selectedElement.id : null,
      code: `${template.code}-${seq}`,
      name: `${template.name} ${seq}`,
      x: 80 + (seq - 1) * 28,
      y: 100 + (seq - 1) * 24,
      rotation: 0,
      seq,
      slot_maps: [],
    };
    updateDraftLayout((layout) => ({ ...layout, racks: [...layout.racks, rack] }));
    setSelectedRackLayoutId(rack.rack_layout_id);
    setSelectedElement({ kind: 'rack', id: rack.rack_layout_id });
  };

  return (
    <section className="warehouse-map-page">
      {contextHolder}
      <Space className="warehouse-map-header" align="start" wrap>
        <div>
          <Title level={4}>仓库地图</Title>
          <Text type="secondary">查询产品在仓库、货架、库位中的可视化位置。库存业务操作仍保留在出入库、订单和盘点模块。</Text>
        </div>
        <Space wrap>
          {canDesign && (
            <Segmented
              value={mode}
              onChange={(value) => setMode(value as WarehouseMapMode)}
              options={[
                { label: '定位', value: 'locate' },
                { label: '设计', value: 'design' },
              ]}
            />
          )}
          <Segmented
            value={view}
            onChange={(value) => setView(value as WarehouseMapView)}
            options={[
              { label: '俯视图', value: 'top' },
              { label: '立面图', value: 'elevation' },
            ]}
          />
        </Space>
      </Space>

      <div className="warehouse-map-searchbar">
        <Input.Search
          allowClear
          enterButton={<Search size={16} />}
          placeholder="搜索产品名、内部编号、别名或路径别名"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          onSearch={(value) => setSubmittedQuery(value.trim())}
          loading={productSearchQuery.isFetching}
        />
        <Segmented
          value={typeFilter}
          onChange={(value) => setTypeFilter(value as ProductTypeFilter)}
          options={productTypeOptions}
        />
      </div>

      {productSearchQuery.isError && (
        <Alert
          className="form-alert"
          type="error"
          showIcon
          message="搜索失败"
          description={productSearchQuery.error instanceof Error ? productSearchQuery.error.message : '请检查后端服务'}
        />
      )}

      <div className="warehouse-map-layout">
        <WarehouseSelector
          warehouses={warehouses}
          selectedWarehouseId={selectedWarehouseId}
          locations={locations}
          loading={warehousesQuery.isFetching}
          onSelectWarehouse={setSelectedWarehouseId}
        />

        <div className="warehouse-map-main">
          {selectedWarehouse ? (
            <>
              <Space className="warehouse-map-main-title" align="center" wrap>
                <Text strong>{selectedWarehouse.warehouse_id} {selectedWarehouse.name}</Text>
                {layoutQuery.isFetching && <Tag>加载布局...</Tag>}
                {draftLayout && <Tag>v{draftLayout.version}</Tag>}
                {!draftLayout && <Tag color="default">未创建平面图</Tag>}
              </Space>
              {view === 'top' ? (
                <WarehouseCanvas
                  layout={draftLayout}
                  locations={currentWarehouseLocations}
                  mode={mode}
                  canDesign={canDesign}
                  selectedElement={selectedElement}
                  onSelectElement={setSelectedElement}
                  onSelectRack={setSelectedRackLayoutId}
                  onMoveElement={handleElementMove}
                />
              ) : (
                <RackElevationView rack={selectedRack} template={selectedRackTemplate} locations={currentWarehouseLocations} />
              )}
            </>
          ) : (
            <Empty description="暂无仓库数据" />
          )}
        </div>

        <ProductLocationPanel
          query={submittedQuery}
          searchResults={filteredSearchResults}
          selectedProduct={selectedProduct}
          locations={locations}
          loading={productSearchQuery.isFetching || locationsQuery.isFetching}
          onSelectProduct={(product) => {
            setSelectedProduct(product);
            setSelectedRackLayoutId(null);
          }}
          onSelectLocation={handleLocationSelect}
        />
      </div>

      {canDesign && mode === 'design' && (
        <LayoutTemplatePanel
          layout={draftLayout}
          selectedWarehouse={selectedWarehouse}
          layoutTemplates={layoutTemplatesQuery.data ?? []}
          rackTemplates={rackTemplates}
          selectedElement={selectedElement}
          layoutTemplateId={layoutTemplateId}
          newLayoutName={newLayoutName}
          newZoneCode={newZoneCode}
          newZoneName={newZoneName}
          newRackTemplateId={newRackTemplateId}
          saving={createLayoutMutation.isPending || saveLayoutMutation.isPending}
          onLayoutTemplateChange={setLayoutTemplateId}
          onNewLayoutNameChange={setNewLayoutName}
          onCreateLayout={() => createLayoutMutation.mutate()}
          onSaveLayout={() => saveLayoutMutation.mutate()}
          onNewZoneCodeChange={setNewZoneCode}
          onNewZoneNameChange={setNewZoneName}
          onAddZone={addZone}
          onNewRackTemplateChange={setNewRackTemplateId}
          onAddRack={addRack}
          onUpdateLayout={setDraftLayout}
        />
      )}
    </section>
  );
}

interface WarehouseSelectorProps {
  warehouses: Warehouse[];
  selectedWarehouseId: string;
  locations: ProductVisualLocation[];
  loading: boolean;
  onSelectWarehouse: (warehouseId: string) => void;
}

function WarehouseSelector({ warehouses, selectedWarehouseId, locations, loading, onSelectWarehouse }: WarehouseSelectorProps) {
  return (
    <aside className="warehouse-selector">
      <Space align="center">
        <MapPinned size={16} />
        <Text strong>仓库</Text>
      </Space>
      {loading ? (
        <Text type="secondary">加载中...</Text>
      ) : (
        warehouses.map((warehouse) => {
          const hitCount = getWarehouseHitCount(warehouse.warehouse_id, locations);
          return (
            <button
              type="button"
              key={warehouse.warehouse_id}
              className={`warehouse-selector-item ${warehouse.warehouse_id === selectedWarehouseId ? 'is-active' : ''}`}
              onClick={() => onSelectWarehouse(warehouse.warehouse_id)}
            >
              <span>
                <Text strong>{warehouse.warehouse_id}</Text>
                <Text type="secondary">{warehouse.name}</Text>
              </span>
              {hitCount > 0 && <Tag color="gold">{hitCount}</Tag>}
            </button>
          );
        })
      )}
    </aside>
  );
}

interface WarehouseCanvasProps {
  layout: WarehouseLayout | null;
  locations: ProductVisualLocation[];
  mode: WarehouseMapMode;
  canDesign: boolean;
  selectedElement: SelectedLayoutElement;
  onSelectElement: (element: SelectedLayoutElement) => void;
  onSelectRack: (rackLayoutId: number) => void;
  onMoveElement: (kind: 'zone' | 'rack', id: number, x: number, y: number) => void;
}

function WarehouseCanvas({
  layout,
  locations,
  mode,
  canDesign,
  selectedElement,
  onSelectElement,
  onSelectRack,
  onMoveElement,
}: WarehouseCanvasProps) {
  const dragRef = useRef<{ kind: 'zone' | 'rack'; id: number; startClientX: number; startClientY: number; startX: number; startY: number } | null>(
    null,
  );
  if (!layout) {
    return (
      <div className="warehouse-canvas-empty">
        <Empty description="当前仓库还没有平面图，管理员可在设计模式中从模板创建。" />
      </div>
    );
  }

  const handlePointerDown = (
    kind: 'zone' | 'rack',
    id: number,
    startX: number,
    startY: number,
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (!canDesign || mode !== 'design') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { kind, id, startClientX: event.clientX, startClientY: event.clientY, startX, startY };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const drag = dragRef.current;
    onMoveElement(drag.kind, drag.id, drag.startX + event.clientX - drag.startClientX, drag.startY + event.clientY - drag.startClientY);
  };

  const stopDragging = () => {
    dragRef.current = null;
  };

  return (
    <div className="warehouse-canvas-scroll">
      <div
        className="warehouse-canvas"
        style={{ '--canvas-width': `${layout.canvas_width}px`, '--canvas-height': `${layout.canvas_height}px`, '--grid-size': `${layout.grid_size}px` } as CSSProperties}
      >
        {layout.zones.map((zone) => (
          <div
            key={zone.zone_id}
            className={`warehouse-zone ${selectedElement?.kind === 'zone' && selectedElement.id === zone.zone_id ? 'is-selected' : ''}`}
            style={{
              left: zone.x,
              top: zone.y,
              width: zone.width,
              height: zone.height,
              backgroundColor: zone.color ?? '#edf2ff',
            }}
            onClick={() => onSelectElement({ kind: 'zone', id: zone.zone_id })}
            onPointerDown={(event) => handlePointerDown('zone', zone.zone_id, zone.x, zone.y, event)}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
          >
            <Text strong>{zone.code}</Text>
            <Text type="secondary">{zone.name}</Text>
          </div>
        ))}
        {layout.racks.map((rack) => {
          const hits = locations.filter((location) => location.rack_layout_id === rack.rack_layout_id);
          const highlightKind = resolveHighlightKind(hits);
          return (
            <div
              key={rack.rack_layout_id}
              className={[
                'warehouse-rack',
                highlightKind ? highlightClassNames[highlightKind] : '',
                selectedElement?.kind === 'rack' && selectedElement.id === rack.rack_layout_id ? 'is-selected' : '',
              ].join(' ')}
              style={{ left: rack.x, top: rack.y, transform: `rotate(${rack.rotation}deg)` }}
              onClick={() => {
                onSelectElement({ kind: 'rack', id: rack.rack_layout_id });
                onSelectRack(rack.rack_layout_id);
              }}
              onPointerDown={(event) => handlePointerDown('rack', rack.rack_layout_id, rack.x, rack.y, event)}
              onPointerMove={handlePointerMove}
              onPointerUp={stopDragging}
              onPointerCancel={stopDragging}
            >
              <span>{rack.code}</span>
              {getRackHitCount(rack.rack_layout_id, locations) > 0 && <b>{getRackHitCount(rack.rack_layout_id, locations)}</b>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface RackElevationViewProps {
  rack: RackLayout | null;
  template: RackTemplate | null;
  locations: ProductVisualLocation[];
}

function RackElevationView({ rack, template, locations }: RackElevationViewProps) {
  if (!rack || !template) {
    return (
      <div className="rack-elevation-empty">
        <Empty description="请选择已绑定模板的货架查看立面图" />
      </div>
    );
  }

  const cells = buildElevationCells(rack, template, rack.slot_maps, locations);
  const columns = template.bay_count * template.positions.length;
  const orderedCells = [...cells].sort((left, right) => right.level_no - left.level_no || left.bay_no - right.bay_no || left.position.localeCompare(right.position));

  return (
    <div className="rack-elevation">
      <Space className="rack-elevation-title" align="center" wrap>
        <Layers size={16} />
        <Text strong>{rack.code} {rack.name}</Text>
        <Tag>{template.bay_count} 列 x {template.level_count} 层</Tag>
      </Space>
      <div className="rack-elevation-grid" style={{ '--elevation-columns': columns } as CSSProperties}>
        {orderedCells.map((cell) => (
          <div key={cell.key} className={`rack-elevation-cell ${cell.highlight_kind ? highlightClassNames[cell.highlight_kind] : ''}`}>
            <Text strong>{cell.bay_no}-{cell.level_no}{cell.position}</Text>
            <Text type="secondary">{cell.map?.slot_code ?? '未绑定'}</Text>
            {cell.hit_count > 0 && <Tag color="gold">{cell.hit_count}</Tag>}
          </div>
        ))}
      </div>
    </div>
  );
}

interface ProductLocationPanelProps {
  query: string;
  searchResults: SearchResult[];
  selectedProduct: SearchResult | null;
  locations: ProductVisualLocation[];
  loading: boolean;
  onSelectProduct: (product: SearchResult | null) => void;
  onSelectLocation: (location: ProductVisualLocation) => void;
}

function ProductLocationPanel({
  query,
  searchResults,
  selectedProduct,
  locations,
  loading,
  onSelectProduct,
  onSelectLocation,
}: ProductLocationPanelProps) {
  return (
    <aside className="product-location-panel">
      <Space align="center">
        <Boxes size={16} />
        <Text strong>产品定位</Text>
      </Space>
      {!query ? (
        <Empty description="输入关键词后搜索产品" />
      ) : selectedProduct ? (
        <>
          <div className="selected-product compact">
            <Text strong>{selectedProduct.product_id}</Text>
            <Text>{selectedProduct.name}</Text>
          </div>
          <List
            loading={loading}
            dataSource={locations}
            locale={{ emptyText: '该产品暂无可视化库存位置' }}
            renderItem={(location) => (
              <List.Item>
                <button type="button" className="location-card" onClick={() => onSelectLocation(location)}>
                  <Space align="start" direction="vertical" size={4}>
                    <Space wrap>
                      <Text strong>{location.warehouse_id}</Text>
                      <Tag className={highlightClassNames[location.highlight_kind]}>{highlightLabels[location.highlight_kind]}</Tag>
                    </Space>
                    <Text>{location.rack_code ?? '未映射到平面图位置'} / {location.slot_code ?? '无库位映射'}</Text>
                    <Text type="secondary">
                      在库 {formatQty(location.qty_on_hand)}，可用 {formatQty(location.available_qty)}，预留 {formatQty(location.reserved_qty)}
                    </Text>
                    {location.bay_no && location.level_no && location.position_code && (
                      <Text type="secondary">列 {location.bay_no} / 层 {location.level_no} / 位 {location.position_code}</Text>
                    )}
                  </Space>
                </button>
              </List.Item>
            )}
          />
          <Button block onClick={() => onSelectProduct(null)}>
            返回搜索结果
          </Button>
        </>
      ) : (
        <List
          loading={loading}
          dataSource={searchResults}
          locale={{ emptyText: '没有匹配产品' }}
          renderItem={(item) => (
            <List.Item>
              <button type="button" className="product-result-row" onClick={() => onSelectProduct(item)}>
                <Text strong>{item.product_id}</Text>
                <Text>{item.name}</Text>
                <Text type="secondary">{item.snippet}</Text>
              </button>
            </List.Item>
          )}
        />
      )}
    </aside>
  );
}

interface LayoutTemplatePanelProps {
  layout: WarehouseLayout | null;
  selectedWarehouse: Warehouse | null;
  layoutTemplates: WarehouseLayoutTemplate[];
  rackTemplates: RackTemplate[];
  selectedElement: SelectedLayoutElement;
  layoutTemplateId: number | null;
  newLayoutName: string;
  newZoneCode: string;
  newZoneName: string;
  newRackTemplateId: number | null;
  saving: boolean;
  onLayoutTemplateChange: (templateId: number | null) => void;
  onNewLayoutNameChange: (name: string) => void;
  onCreateLayout: () => void;
  onSaveLayout: () => void;
  onNewZoneCodeChange: (code: string) => void;
  onNewZoneNameChange: (name: string) => void;
  onAddZone: () => void;
  onNewRackTemplateChange: (templateId: number | null) => void;
  onAddRack: () => void;
  onUpdateLayout: (layout: WarehouseLayout | null) => void;
}

function LayoutTemplatePanel({
  layout,
  selectedWarehouse,
  layoutTemplates,
  rackTemplates,
  selectedElement,
  layoutTemplateId,
  newLayoutName,
  newZoneCode,
  newZoneName,
  newRackTemplateId,
  saving,
  onLayoutTemplateChange,
  onNewLayoutNameChange,
  onCreateLayout,
  onSaveLayout,
  onNewZoneCodeChange,
  onNewZoneNameChange,
  onAddZone,
  onNewRackTemplateChange,
  onAddRack,
  onUpdateLayout,
}: LayoutTemplatePanelProps) {
  const selectedZone = selectedElement?.kind === 'zone' ? layout?.zones.find((zone) => zone.zone_id === selectedElement.id) ?? null : null;
  const selectedRack = selectedElement?.kind === 'rack' ? layout?.racks.find((rack) => rack.rack_layout_id === selectedElement.id) ?? null : null;

  const updateSelectedZone = (patch: Partial<LayoutZone>) => {
    if (!layout || !selectedZone) return;
    onUpdateLayout({
      ...layout,
      zones: layout.zones.map((zone) => (zone.zone_id === selectedZone.zone_id ? { ...zone, ...patch } : zone)),
    });
  };

  const updateSelectedRack = (patch: Partial<RackLayout>) => {
    if (!layout || !selectedRack) return;
    onUpdateLayout({
      ...layout,
      racks: layout.racks.map((rack) => (rack.rack_layout_id === selectedRack.rack_layout_id ? { ...rack, ...patch } : rack)),
    });
  };

  return (
    <section className="layout-template-panel">
      <Space className="layout-template-title" align="center" wrap>
        <Text strong>设计模式</Text>
        <Text type="secondary">{selectedWarehouse ? `${selectedWarehouse.warehouse_id} ${selectedWarehouse.name}` : '未选择仓库'}</Text>
      </Space>

      {!layout ? (
        <div className="layout-template-grid">
          <label>
            布局模板
            <Select
              allowClear
              value={layoutTemplateId}
              options={layoutTemplates.map((template) => ({ value: template.template_id, label: `${template.code} ${template.name}` }))}
              onChange={(value) => onLayoutTemplateChange(value ?? null)}
              placeholder="可选"
            />
          </label>
          <label>
            布局名称
            <Input value={newLayoutName} placeholder="例如：W1 平面布局" onChange={(event) => onNewLayoutNameChange(event.target.value)} />
          </label>
          <Button type="primary" icon={<Plus size={16} />} loading={saving} onClick={onCreateLayout} disabled={!selectedWarehouse}>
            从模板创建布局
          </Button>
        </div>
      ) : (
        <>
          <div className="layout-template-grid">
            <label>
              新区域编码
              <Input value={newZoneCode} placeholder="A" onChange={(event) => onNewZoneCodeChange(event.target.value)} />
            </label>
            <label>
              新区域名称
              <Input value={newZoneName} placeholder="A区" onChange={(event) => onNewZoneNameChange(event.target.value)} />
            </label>
            <Button icon={<Plus size={16} />} onClick={onAddZone}>
              添加区域
            </Button>
            <label>
              货架模板
              <Select
                value={newRackTemplateId}
                options={rackTemplates.map((template) => ({ value: template.template_id, label: `${template.code} ${template.name}` }))}
                onChange={(value) => onNewRackTemplateChange(value)}
                placeholder="选择货架模板"
              />
            </label>
            <Button icon={<Plus size={16} />} onClick={onAddRack} disabled={!newRackTemplateId}>
              添加货架
            </Button>
            <Button type="primary" icon={<Save size={16} />} loading={saving} onClick={onSaveLayout}>
              保存布局
            </Button>
          </div>

          {(selectedZone || selectedRack) && (
            <div className="layout-inspector">
              <Text strong>{selectedZone ? '区域属性' : '货架属性'}</Text>
              <div className="layout-template-grid compact">
                {selectedZone && (
                  <>
                    <label>
                      宽度
                      <InputNumber min={40} value={selectedZone.width} onChange={(value) => updateSelectedZone({ width: value ?? selectedZone.width })} />
                    </label>
                    <label>
                      高度
                      <InputNumber min={40} value={selectedZone.height} onChange={(value) => updateSelectedZone({ height: value ?? selectedZone.height })} />
                    </label>
                  </>
                )}
                {selectedRack && (
                  <>
                    <label>
                      宽度
                      <InputNumber min={40} value={120} disabled />
                    </label>
                    <label>
                      高度
                      <InputNumber min={24} value={58} disabled />
                    </label>
                    <label>
                      旋转
                      <InputNumber min={0} max={359} value={selectedRack.rotation} onChange={(value) => updateSelectedRack({ rotation: value ?? 0 })} />
                    </label>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function resolveHighlightKind(locations: ProductVisualLocation[]): ProductVisualHighlightKind | null {
  if (locations.length === 0) return null;
  if (locations.some((location) => location.highlight_kind === 'DEFECTIVE')) return 'DEFECTIVE';
  if (locations.some((location) => location.highlight_kind === 'UNAVAILABLE')) return 'UNAVAILABLE';
  if (locations.some((location) => location.highlight_kind === 'UNMAPPED')) return 'UNMAPPED';
  return 'GOOD';
}

function cloneLayout(layout: WarehouseLayout): WarehouseLayout {
  return JSON.parse(JSON.stringify(layout)) as WarehouseLayout;
}

function formatQty(value: number) {
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 3 });
}
