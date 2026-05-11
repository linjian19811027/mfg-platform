import { request } from '@/utils/request'

export interface InventoryItem {
  id: string
  materialId: string
  materialCode?: string
  materialName?: string
  warehouseId: string
  warehouseName?: string
  locationId?: string
  locationCode?: string
  batchId?: string
  batchNo?: string
  qty: number
  frozenQty: number
  availableQty?: number
  unit: string
  status?: string
}

export interface StockTransaction {
  id: string
  materialId: string
  materialName?: string
  type: string
  qty: number
  direction: number
  warehouseId: string
  warehouseName?: string
  batchId?: string
  referenceId?: string
  createdAt: string
}

export interface StockTake {
  id: string
  code?: string
  warehouseId?: string
  warehouseName?: string
  status: string
  createdAt: string
  completedAt?: string
  lines?: StockTakeLine[]
}

export interface StockTakeLine {
  id: string
  stockTakeId: string
  materialId: string
  materialCode?: string
  materialName?: string
  locationId?: string
  bookQty: number
  countQty?: number
  diffQty?: number
  unit: string
}

export interface PickTask {
  id: string
  code?: string
  status: string
  priority?: number
  referenceType?: string
  referenceId?: string
  createdAt: string
  lines?: PickTaskLine[]
}

export interface PickTaskLine {
  id: string
  pickTaskId: string
  materialId: string
  materialCode?: string
  materialName?: string
  locationId?: string
  locationCode?: string
  requiredQty: number
  pickedQty?: number
  unit: string
}

export interface Warehouse {
  id: string
  code: string
  name: string
  type?: string
  status?: string
}

export interface WmsZone {
  id: string
  code: string
  name: string
  warehouseId: string
  type?: string
}

export interface WmsLocation {
  id: string
  code: string
  zoneId: string
  warehouseId: string
  type?: string
  status?: string
}

export interface SafetyStock {
  id: string
  materialId: string
  materialCode?: string
  materialName?: string
  warehouseId?: string
  safetyQty: number
  unit: string
  currentQty?: number
}

export interface BarcodeRule {
  id: string
  code: string
  name: string
  objectType: string
  pattern: string
  status: string
}

export const wmsApi = {
  // 仓库
  getWarehouses: async (params?: object) => {
    try {
      return await request.get<{ list: { id: string; code: string; name: string }[]; total: number }>('/v1/wms/warehouses', params)
    } catch { return { list: [], total: 0 } }
  },
  createWarehouse: async (data: object) => {
    try { return await request.post<Warehouse>('/v1/wms/warehouses', data) }
    catch { return null as unknown as Warehouse }
  },
  updateWarehouse: async (id: string, data: object) => {
    try { return await request.put<Warehouse>(`/v1/wms/warehouses/${id}`, data) }
    catch { return null as unknown as Warehouse }
  },
  getLocations: async (params?: object) => {
    try {
      return await request.get<{ list: { id: string; code: string; name: string; warehouseId: string }[]; total: number }>('/v1/wms/locations', params)
    } catch { return { list: [], total: 0 } }
  },

  // 库存
  getInventory: async (params: object) => {
    try {
      return await request.get<{ list: InventoryItem[]; total: number }>('/v1/wms/inventory', params)
    } catch { return { list: [], total: 0 } }
  },
  getTransactions: async (params: object) => {
    try {
      return await request.get<{ list: StockTransaction[]; total: number }>('/v1/wms/inventory/transactions', params)
    } catch { return { list: [], total: 0 } }
  },
  receipt: async (data: object) => {
    try {
      return await request.post<{ id: string }>('/v1/wms/receipts', data)
    } catch { return null as unknown as { id: string } }
  },
  issue: async (data: object) => {
    try {
      return await request.post<{ id: string }>('/v1/wms/issues', data)
    } catch { return null as unknown as { id: string } }
  },
  lockInventory: async (data: object) => {
    try {
      return await request.post<void>('/v1/wms/inventory/lock', data)
    } catch { return }
  },
  unlockInventory: async (data: object) => {
    try {
      return await request.post<void>('/v1/wms/inventory/unlock', data)
    } catch { return }
  },
  adjustInventory: async (data: object) => {
    try {
      return await request.post<void>('/v1/wms/inventory/adjust', data)
    } catch { return }
  },

  // 盘点
  getStockTakes: async (params: object) => {
    try {
      return await request.get<{ list: StockTake[]; total: number }>('/v1/wms/stock-takes', params)
    } catch { return { list: [], total: 0 } }
  },
  createStockTake: async (data: object) => {
    try {
      return await request.post<StockTake>('/v1/wms/stock-takes', data)
    } catch { return null as unknown as StockTake }
  },
  startStockTake: async (id: string) => {
    try {
      return await request.patch<void>(`/v1/wms/stock-takes/${id}/start`, {})
    } catch { return }
  },
  countLine: async (lineId: string, countQty: number, countedBy?: string) => {
    try {
      return await request.post<void>(`/v1/wms/stock-takes/lines/${lineId}/count`, { countQty, countedBy })
    } catch { return }
  },
  getStockTakeDiff: async (id: string) => {
    try {
      return await request.get<{ lines: StockTakeLine[] }>(`/v1/wms/stock-takes/${id}/diff`)
    } catch { return { lines: [] } }
  },
  approveStockTake: async (id: string, approvedBy?: string) => {
    try {
      return await request.patch<void>(`/v1/wms/stock-takes/${id}/approve`, { approvedBy })
    } catch { return }
  },

  // 拣货
  getPickTasks: async (params: object) => {
    try {
      return await request.get<{ list: PickTask[]; total: number }>('/v1/wms/pick-tasks', params)
    } catch { return { list: [], total: 0 } }
  },
  createPickTask: async (data: object) => {
    try {
      return await request.post<PickTask>('/v1/wms/pick-tasks', data)
    } catch { return null as unknown as PickTask }
  },
  verifyPickTask: async (id: string, verifiedLines: { lineId: string; pickedQty: number }[]) => {
    try {
      return await request.post<void>(`/v1/wms/pick-tasks/${id}/verify`, { verifiedLines })
    } catch { return }
  },

  // 报表
  getLedger: async (params: object) => {
    try {
      return await request.get<{ list: Record<string, unknown>[]; total: number }>('/v1/wms/reports/ledger', params)
    } catch { return { list: [], total: 0 } }
  },
  getMovement: async (params: object) => {
    try {
      return await request.get<{ list: Record<string, unknown>[] }>('/v1/wms/reports/movement', params)
    } catch { return { list: [] } }
  },
  getTurnover: async (params: object) => {
    try {
      return await request.get<{ list: Record<string, unknown>[] }>('/v1/wms/reports/turnover', params)
    } catch { return { list: [] } }
  },

  // 安全库存
  getSafetyStocks: async (params?: object) => {
    try {
      return await request.get<{ list: SafetyStock[]; total: number }>('/v1/wms/safety-stocks', params)
    } catch { return { list: [], total: 0 } }
  },
  createSafetyStock: async (data: object) => {
    try {
      return await request.post<SafetyStock>('/v1/wms/safety-stocks', data)
    } catch { return null as unknown as SafetyStock }
  },
  updateSafetyStock: async (id: string, data: object) => {
    try {
      return await request.put<SafetyStock>(`/v1/wms/safety-stocks/${id}`, data)
    } catch { return null as unknown as SafetyStock }
  },
  deleteSafetyStock: async (id: string) => {
    try {
      return await request.delete<void>(`/v1/wms/safety-stocks/${id}`)
    } catch { return }
  },

  // 条码规则
  getBarcodeRules: async (params?: object) => {
    try {
      return await request.get<{ list: BarcodeRule[]; total: number }>('/v1/wms/barcode-rules', params)
    } catch { return { list: [], total: 0 } }
  },
  createBarcodeRule: async (data: object) => {
    try {
      return await request.post<BarcodeRule>('/v1/wms/barcode-rules', data)
    } catch { return null as unknown as BarcodeRule }
  },
  updateBarcodeRule: async (id: string, data: object) => {
    try {
      return await request.put<BarcodeRule>(`/v1/wms/barcode-rules/${id}`, data)
    } catch { return null as unknown as BarcodeRule }
  },
}
