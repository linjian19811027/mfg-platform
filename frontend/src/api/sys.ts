import { request, MOCK_ENABLED } from '@/utils/request'

export interface SysUser {
  id: string
  username: string
  realName: string
  email?: string
  phone?: string
  orgId?: string
  orgName?: string
  status: 'active' | 'disabled'
  roles?: string[]
  createdAt: string
}

export interface SysRole {
  id: string
  name: string
  code: string
}

export interface UserListParams {
  username?: string
  realName?: string
  status?: string
  page?: number
  pageSize?: number
}

// Mock 数据（后端接口未就绪时降级使用）
const MOCK_ROLES: SysRole[] = [
  { id: '1', name: '管理员', code: 'admin' },
  { id: '2', name: '操作员', code: 'operator' },
  { id: '3', name: '查看员', code: 'viewer' },
  { id: '4', name: '审批员', code: 'approver' },
]

const MOCK_USERS: SysUser[] = [
  { id: '1', username: 'admin', realName: '系统管理员', email: 'admin@example.com', phone: '13800000001', orgId: '1', orgName: '总部', status: 'active', roles: ['1'], createdAt: '2024-01-01 08:00:00' },
  { id: '2', username: 'zhangsan', realName: '张三', email: 'zhangsan@example.com', phone: '13800000002', orgId: '2', orgName: '生产部', status: 'active', roles: ['2', '3'], createdAt: '2024-02-15 09:30:00' },
  { id: '3', username: 'lisi', realName: '李四', email: 'lisi@example.com', phone: '13800000003', orgId: '2', orgName: '生产部', status: 'active', roles: ['3'], createdAt: '2024-03-10 10:00:00' },
  { id: '4', username: 'wangwu', realName: '王五', email: 'wangwu@example.com', phone: '13800000004', orgId: '3', orgName: '质检部', status: 'disabled', roles: ['4'], createdAt: '2024-04-05 14:00:00' },
  { id: '5', username: 'zhaoliu', realName: '赵六', email: 'zhaoliu@example.com', phone: '13800000005', orgId: '3', orgName: '质检部', status: 'active', roles: ['2', '4'], createdAt: '2024-05-20 11:00:00' },
  { id: '6', username: 'sunqi', realName: '孙七', email: 'sunqi@example.com', phone: '13800000006', orgId: '4', orgName: '设备部', status: 'active', roles: ['2'], createdAt: '2024-06-01 09:00:00' },
  { id: '7', username: 'zhouba', realName: '周八', email: 'zhouba@example.com', phone: '13800000007', orgId: '1', orgName: '总部', status: 'disabled', roles: ['3'], createdAt: '2024-07-12 16:00:00' },
]

let mockUsers = [...MOCK_USERS]
// let nextId = 8 // mock auto-increment

function mockDelay<T>(data: T, ms = 300): Promise<T> {
  if (!MOCK_ENABLED) return Promise.reject(new Error('[Mock 关闭] sys API — Mock 降级已禁用'))
  console.warn('[Mock 降级] sys API — 后端未就绪，使用前端 Mock 数据')
  return new Promise(resolve => setTimeout(() => resolve(data), ms))
}

function filterMockUsers(params: UserListParams) {
  let list = [...mockUsers]
  if (params.username) list = list.filter(u => u.username.includes(params.username!))
  if (params.realName) list = list.filter(u => u.realName.includes(params.realName!))
  if (params.status) list = list.filter(u => u.status === params.status)
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const total = list.length
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total }
}

export const sysApi = {
  // 用户列表
  getUsers: async (params: UserListParams): Promise<{ list: SysUser[]; total: number }> => {
    try {
      return await request.get<{ list: SysUser[]; total: number }>('/v1/sys/users', params)
    } catch {
      return mockDelay(filterMockUsers(params))
    }
  },

  // 创建用户
  createUser: async (data: object): Promise<{ id: string }> => {
    return await request.post<{ id: string }>('/v1/sys/users', data)
  },

  // 更新用户
  updateUser: async (id: string, data: object): Promise<void> => {
    return await request.put<void>(`/v1/sys/users/${id}`, data)
  },

  // 启用/禁用用户
  toggleUserStatus: async (id: string, status: 'active' | 'disabled'): Promise<void> => {
    return await request.patch<void>(`/v1/sys/users/${id}/status`, { status })
  },

  // 重置密码
  resetPassword: async (id: string): Promise<{ tempPassword: string }> => {
    return await request.post<{ tempPassword: string }>(`/v1/sys/users/${id}/reset-password`)
  },

  // 角色列表
  getRoles: async (): Promise<SysRole[]> => {
    try {
      return await request.get<SysRole[]>('/v1/sys/roles')
    } catch {
      return mockDelay(MOCK_ROLES)
    }
  },

  // 组织列表（用于下拉选择）
  getOrgs: async (): Promise<{ id: string; name: string }[]> => {
    try {
      return await request.get<{ id: string; name: string }[]>('/v1/sys/orgs/simple')
    } catch {
      return mockDelay([
        { id: '1', name: '总部' },
        { id: '2', name: '生产部' },
        { id: '3', name: '质检部' },
        { id: '4', name: '设备部' },
        { id: '5', name: '仓储部' },
      ])
    }
  },
}

// ==================== 角色管理 ====================

export interface SysRoleDetail {
  id: string
  name: string
  code: string
  type: 'CUSTOM' | 'TENANT_ADMIN' | 'SUPER_ADMIN'
  description?: string
  userCount: number
  status: 'active' | 'disabled'
  createdAt: string
}

export interface RoleListParams {
  name?: string
  page?: number
  pageSize?: number
}

export interface PermissionNode {
  code: string
  name: string
  children?: PermissionNode[]
}

// ---- Mock 角色种子数据 ----
const mockRoles: SysRoleDetail[] = [
  {
    id: '1',
    name: '超级管理员',
    code: 'SUPER_ADMIN',
    type: 'SUPER_ADMIN',
    description: '系统超级管理员，拥有全部权限',
    userCount: 1,
    status: 'active',
    createdAt: '2024-01-01 00:00:00',
  },
  {
    id: '2',
    name: '租户管理员',
    code: 'TENANT_ADMIN',
    type: 'TENANT_ADMIN',
    description: '租户管理员，拥有租户内全部权限',
    userCount: 3,
    status: 'active',
    createdAt: '2024-01-01 00:00:00',
  },
  {
    id: '3',
    name: '运营人员',
    code: 'operator',
    type: 'CUSTOM',
    description: '日常运营操作角色',
    userCount: 5,
    status: 'active',
    createdAt: '2024-01-15 10:00:00',
  },
  {
    id: '4',
    name: '只读用户',
    code: 'readonly',
    type: 'CUSTOM',
    description: '仅有查看权限',
    userCount: 8,
    status: 'disabled',
    createdAt: '2024-02-01 14:30:00',
  },
]

function filterMockRoles(params: RoleListParams) {
  let list = [...mockRoles]
  if (params.name) list = list.filter(r => r.name.includes(params.name!))
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const total = list.length
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total }
}

// 权限树 mock 数据
const PERMISSION_TREE: PermissionNode[] = [
  {
    code: 'plm', name: 'PLM 产品管理',
    children: [
      { code: 'plm:view', name: '查看' },
      { code: 'plm:create', name: '新建' },
      { code: 'plm:edit', name: '编辑' },
      { code: 'plm:delete', name: '删除' },
      { code: 'plm:approve', name: '审批' },
    ],
  },
  {
    code: 'mes', name: 'MES 生产执行',
    children: [
      { code: 'mes:view', name: '查看' },
      { code: 'mes:create', name: '新建' },
      { code: 'mes:edit', name: '编辑' },
      { code: 'mes:delete', name: '删除' },
      { code: 'mes:approve', name: '审批' },
    ],
  },
  {
    code: 'wms', name: 'WMS 仓储管理',
    children: [
      { code: 'wms:view', name: '查看' },
      { code: 'wms:create', name: '新建' },
      { code: 'wms:edit', name: '编辑' },
      { code: 'wms:delete', name: '删除' },
      { code: 'wms:approve', name: '审批' },
    ],
  },
  {
    code: 'qms', name: 'QMS 质量管理',
    children: [
      { code: 'qms:view', name: '查看' },
      { code: 'qms:create', name: '新建' },
      { code: 'qms:edit', name: '编辑' },
      { code: 'qms:delete', name: '删除' },
      { code: 'qms:approve', name: '审批' },
    ],
  },
  {
    code: 'scm', name: 'SCM 供应链管理',
    children: [
      { code: 'scm:view', name: '查看' },
      { code: 'scm:create', name: '新建' },
      { code: 'scm:edit', name: '编辑' },
      { code: 'scm:delete', name: '删除' },
      { code: 'scm:approve', name: '审批' },
    ],
  },
  {
    code: 'erp', name: 'ERP 企业资源',
    children: [
      { code: 'erp:view', name: '查看' },
      { code: 'erp:create', name: '新建' },
      { code: 'erp:edit', name: '编辑' },
      { code: 'erp:delete', name: '删除' },
      { code: 'erp:approve', name: '审批' },
    ],
  },
  {
    code: 'aps', name: 'APS 高级排程',
    children: [
      { code: 'aps:view', name: '查看' },
      { code: 'aps:create', name: '新建' },
      { code: 'aps:edit', name: '编辑' },
      { code: 'aps:delete', name: '删除' },
      { code: 'aps:approve', name: '审批' },
    ],
  },
  {
    code: 'eam', name: 'EAM 设备管理',
    children: [
      { code: 'eam:view', name: '查看' },
      { code: 'eam:create', name: '新建' },
      { code: 'eam:edit', name: '编辑' },
      { code: 'eam:delete', name: '删除' },
      { code: 'eam:approve', name: '审批' },
    ],
  },
  {
    code: 'sys', name: '系统管理',
    children: [
      { code: 'sys:user:view', name: '用户查看' },
      { code: 'sys:user:manage', name: '用户管理' },
      { code: 'sys:role:view', name: '角色查看' },
      { code: 'sys:role:manage', name: '角色管理' },
      { code: 'sys:org:view', name: '组织查看' },
      { code: 'sys:org:manage', name: '组织管理' },
      { code: 'sys:log:view', name: '日志查看' },
      { code: 'sys:permission:view', name: '权限管理' },
    ],
  },
]


export const roleApi = {
  // 角色列表
  getRoleList: async (params: RoleListParams): Promise<{ list: SysRoleDetail[]; total: number }> => {
    try {
      return await request.get<{ list: SysRoleDetail[]; total: number }>('/v1/sys/roles/list', params)
    } catch {
      return mockDelay(filterMockRoles(params))
    }
  },

  // 创建角色
  createRole: async (data: object): Promise<{ id: string }> => {
    return await request.post<{ id: string }>('/v1/sys/roles', data)
  },

  // 更新角色
  updateRole: async (id: string, data: object): Promise<void> => {
    return await request.put<void>(`/v1/sys/roles/${id}`, data)
  },

  // 删除角色
  deleteRole: async (id: string): Promise<void> => {
    return await request.delete<void>(`/v1/sys/roles/${id}`)
  },

  // 切换角色状态
  toggleRoleStatus: async (id: string, status: 'active' | 'disabled'): Promise<void> => {
    return await request.patch<void>(`/v1/sys/roles/${id}/status`, { status })
  },

  // 获取角色权限
  getRolePermissions: async (id: string): Promise<string[]> => {
    try {
      return await request.get<string[]>(`/v1/sys/roles/${id}/permissions`)
    } catch {
      return mockDelay([])
    }
  },

  // 更新角色权限
  updateRolePermissions: async (id: string, permissions: string[]): Promise<void> => {
    return await request.put<void>(`/v1/sys/roles/${id}/permissions`, { permissions })
  },

  // 获取权限树
  getPermissionTree: async (): Promise<PermissionNode[]> => {
    try {
      return await request.get<PermissionNode[]>('/v1/sys/permissions/tree')
    } catch {
      return mockDelay(PERMISSION_TREE)
    }
  },
}


// ==================== 审计日志 ====================

export type AuditActionType = 'create' | 'edit' | 'delete' | 'login' | 'logout' | 'approve' | string
export type AuditResult = 'success' | 'fail' | string

export interface AuditLog {
  id: string
  createdAt?: string
  username?: string
  module?: string
  logType?: string
  action?: string
  requestUrl?: string
  ipAddress?: string
  responseCode?: number
  responseBody?: string
  requestBody?: string
  errorMessage?: string
  signature?: string
  // 向后兼容
  operatedAt?: string
  operator?: string
  actionType?: string
  target?: string
  ip?: string
  result?: string
  errorMsg?: string
}

export interface AuditLogParams {
  operator?: string
  module?: string
  actionType?: string
  result?: string
  startTime?: string
  endTime?: string
  page?: number
  pageSize?: number
}

// Mock 数据
const MODULES = ['用户管理', '角色管理', '权限管理', '设备管理', '生产计划', '质量检验', '仓储管理', '采购管理', '销售管理', '系统配置']
const OPERATORS = ['admin', 'zhangsan', 'lisi', 'wangwu', 'zhaoliu', 'sunqi']
const ACTION_TYPES: AuditActionType[] = ['create', 'edit', 'delete', 'login', 'logout', 'approve']
const TARGETS = [
  '用户[张三]', '角色[操作员]', '设备[CNC-001]', '生产计划[PO-2024-001]',
  '质检单[QC-2024-088]', '入库单[WH-2024-055]', '采购订单[PO-2024-033]',
  '销售订单[SO-2024-012]', '权限[mes:create]', '系统参数[分页大小]',
  '用户[李四]', '设备[注塑机-003]', '生产计划[PO-2024-002]', '角色[审批员]',
]

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function genTime(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() - offsetDays)
  d.setHours(Math.floor(Math.random() * 10) + 8)
  d.setMinutes(Math.floor(Math.random() * 60))
  d.setSeconds(Math.floor(Math.random() * 60))
  return d.toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
}

function genIp(): string {
  return `192.168.${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 200) + 10}`
}

const MOCK_AUDIT_LOGS: AuditLog[] = Array.from({ length: 52 }, (_, i) => {
  const actionType = randomItem(ACTION_TYPES)
  const result: AuditResult = Math.random() > 0.15 ? 'success' : 'fail'
  const module = actionType === 'login' || actionType === 'logout' ? '系统认证' : randomItem(MODULES)
  const target = actionType === 'login' ? `用户[${randomItem(OPERATORS)}]` : actionType === 'logout' ? `用户[${randomItem(OPERATORS)}]` : randomItem(TARGETS)
  return {
    id: String(i + 1),
    operatedAt: genTime(Math.floor(i / 3)),
    operator: randomItem(OPERATORS),
    module,
    actionType,
    target,
    ip: genIp(),
    result,
    requestParams: actionType !== 'login' && actionType !== 'logout' ? {
      id: `${Math.floor(Math.random() * 9000) + 1000}`,
      action: actionType,
      data: { field1: '示例值', field2: Math.floor(Math.random() * 100) },
    } : { username: randomItem(OPERATORS), clientInfo: 'Chrome/120.0' },
    responseData: result === 'success'
      ? { code: 200, message: 'ok', data: { affected: 1 } }
      : undefined,
    errorMsg: result === 'fail' ? randomItem(['权限不足', '数据不存在', '参数校验失败', '操作超时']) : undefined,
  }
})

function filterAuditLogs(params: AuditLogParams) {
  let list = [...MOCK_AUDIT_LOGS]
  if (params.operator) list = list.filter(l => (l.username ?? l.operator ?? '').includes(params.operator!))
  if (params.module) list = list.filter(l => l.module === params.module)
  if (params.actionType) list = list.filter(l => (l.logType ?? l.actionType) === params.actionType)
  if (params.result) list = list.filter(l => l.result === params.result)
  if (params.startTime) list = list.filter(l => (l.createdAt ?? l.operatedAt ?? '') >= params.startTime!)
  if (params.endTime) list = list.filter(l => (l.createdAt ?? l.operatedAt ?? '') <= params.endTime! + ' 23:59:59')
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const total = list.length
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total }
}

export const auditLogApi = {
  getAuditLogs: async (params: AuditLogParams): Promise<{ list: AuditLog[]; total: number }> => {
    try {
      return await request.get<{ list: AuditLog[]; total: number }>('/v1/sys/audit-logs', params)
    } catch {
      return mockDelay(filterAuditLogs(params))
    }
  },
}


// ==================== 组织架构管理 ====================

export interface OrgNode {
  id: string
  name: string
  code: string
  parentId: string | null
  manager?: string
  phone?: string
  description?: string
  level: number
  sort: number
  children?: OrgNode[]
}

export interface OrgFormData {
  name: string
  code: string
  parentId: string | null
  manager?: string
  phone?: string
  description?: string
}

// Mock 数据：3层组织树（总部 → 部门 → 车间/小组）
let mockOrgTree: OrgNode[] = [
  {
    id: '1', name: '总部', code: 'HQ', parentId: null, manager: '张总', phone: '13800000001',
    description: '公司总部', level: 1, sort: 1,
    children: [
      {
        id: '2', name: '生产部', code: 'PROD', parentId: '1', manager: '李部长', phone: '13800000002',
        description: '负责生产制造', level: 2, sort: 1,
        children: [
          { id: '5', name: '一车间', code: 'PROD-W1', parentId: '2', manager: '王主任', phone: '13800000005', description: '第一生产车间', level: 3, sort: 1 },
          { id: '6', name: '二车间', code: 'PROD-W2', parentId: '2', manager: '赵主任', phone: '13800000006', description: '第二生产车间', level: 3, sort: 2 },
          { id: '7', name: '装配组', code: 'PROD-AS', parentId: '2', manager: '孙组长', phone: '13800000007', description: '产品装配小组', level: 3, sort: 3 },
        ],
      },
      {
        id: '3', name: '质检部', code: 'QC', parentId: '1', manager: '陈部长', phone: '13800000003',
        description: '负责质量检验', level: 2, sort: 2,
        children: [
          { id: '8', name: '进料检验组', code: 'QC-IQC', parentId: '3', manager: '刘组长', phone: '13800000008', description: '来料检验', level: 3, sort: 1 },
          { id: '9', name: '过程检验组', code: 'QC-IPQC', parentId: '3', manager: '周组长', phone: '13800000009', description: '过程质量控制', level: 3, sort: 2 },
        ],
      },
      {
        id: '4', name: '设备部', code: 'EAM', parentId: '1', manager: '吴部长', phone: '13800000004',
        description: '负责设备维护', level: 2, sort: 3,
        children: [
          { id: '10', name: '维修组', code: 'EAM-MR', parentId: '4', manager: '郑组长', phone: '13800000010', description: '设备维修保养', level: 3, sort: 1 },
          { id: '11', name: '点检组', code: 'EAM-INS', parentId: '4', manager: '冯组长', phone: '13800000011', description: '设备日常点检', level: 3, sort: 2 },
        ],
      },
    ],
  },
]

// let nextOrgId = 12 // mock auto-increment
// 
// function flattenOrg(nodes: OrgNode[]): OrgNode[] {
//   const result: OrgNode[] = []
//   function walk(list: OrgNode[]) {
//     for (const n of list) {
//       result.push(n)
//       if (n.children?.length) walk(n.children)
//     }
//   }
//   walk(nodes)
//   return result
// }
// 
// function findAndDelete(nodes: OrgNode[], id: string): boolean {
//   for (let i = 0; i < nodes.length; i++) {
//     if (nodes[i].id === id) { nodes.splice(i, 1); return true }
//     if (nodes[i].children && findAndDelete(nodes[i].children!, id)) return true
//   }
//   return false
// }
// 
// function findAndUpdate(nodes: OrgNode[], id: string, data: Partial<OrgNode>): boolean {
//   for (const n of nodes) {
//     if (n.id === id) { Object.assign(n, data); return true }
//     if (n.children && findAndUpdate(n.children, id, data)) return true
//   }
//   return false
// }
// 

function findNode(nodes: OrgNode[], id: string): OrgNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children) { const found = findNode(n.children, id); if (found) return found }
  }
  return null
}

export const orgApi = {
  // 获取组织树
  getOrgTree: async (): Promise<OrgNode[]> => {
    try {
      return await request.get<OrgNode[]>('/v1/sys/orgs/tree')
    } catch {
      return mockDelay(JSON.parse(JSON.stringify(mockOrgTree)))
    }
  },

  // 创建组织
  createOrg: async (data: OrgFormData): Promise<{ id: string }> => {
    return await request.post<{ id: string }>('/v1/sys/orgs', data)
  },

  // 更新组织
  updateOrg: async (id: string, data: Partial<OrgFormData>): Promise<void> => {
    return await request.put<void>(`/v1/sys/orgs/${id}`, data)
  },

  // 删除组织
  deleteOrg: async (id: string): Promise<void> => {
    return await request.delete<void>(`/v1/sys/orgs/${id}`)
  },

  // 获取单个组织详情
  getOrg: async (id: string): Promise<OrgNode | null> => {
    try {
      return await request.get<OrgNode>(`/v1/sys/orgs/${id}`)
    } catch {
      return mockDelay(findNode(mockOrgTree, id))
    }
  },
}


// ==================== 计量单位管理 ====================

export type UomType = 'length' | 'weight' | 'volume' | 'time' | 'quantity' | 'area'

export interface Uom {
  id: string
  name: string
  symbol: string
  type: UomType
  isBase: boolean
  conversionFactor?: number
  description?: string
  status: 'active' | 'disabled'
  createdAt: string
}

export interface UomListParams {
  name?: string
  type?: string
  page?: number
  pageSize?: number
}

export interface UomFormData {
  name: string
  symbol: string
  type: UomType
  isBase: boolean
  description?: string
}

// Mock 数据
let mockUoms: Uom[] = [
  // 长度
  { id: '1', name: '米', symbol: 'm', type: 'length', isBase: true, status: 'active', createdAt: '2024-01-01 08:00:00' },
  { id: '2', name: '毫米', symbol: 'mm', type: 'length', isBase: false, conversionFactor: 0.001, status: 'active', createdAt: '2024-01-01 08:00:00' },
  { id: '3', name: '厘米', symbol: 'cm', type: 'length', isBase: false, conversionFactor: 0.01, status: 'active', createdAt: '2024-01-01 08:00:00' },
  { id: '4', name: '千米', symbol: 'km', type: 'length', isBase: false, conversionFactor: 1000, status: 'active', createdAt: '2024-01-01 08:00:00' },
  // 重量
  { id: '5', name: '千克', symbol: 'kg', type: 'weight', isBase: true, status: 'active', createdAt: '2024-01-01 08:00:00' },
  { id: '6', name: '克', symbol: 'g', type: 'weight', isBase: false, conversionFactor: 0.001, status: 'active', createdAt: '2024-01-01 08:00:00' },
  { id: '7', name: '吨', symbol: 't', type: 'weight', isBase: false, conversionFactor: 1000, status: 'active', createdAt: '2024-01-01 08:00:00' },
  { id: '8', name: '毫克', symbol: 'mg', type: 'weight', isBase: false, conversionFactor: 0.000001, status: 'active', createdAt: '2024-01-01 08:00:00' },
  // 体积
  { id: '9', name: '升', symbol: 'L', type: 'volume', isBase: true, status: 'active', createdAt: '2024-01-01 08:00:00' },
  { id: '10', name: '毫升', symbol: 'mL', type: 'volume', isBase: false, conversionFactor: 0.001, status: 'active', createdAt: '2024-01-01 08:00:00' },
  { id: '11', name: '立方米', symbol: 'm³', type: 'volume', isBase: false, conversionFactor: 1000, status: 'active', createdAt: '2024-01-01 08:00:00' },
  // 时间
  { id: '12', name: '小时', symbol: 'h', type: 'time', isBase: true, status: 'active', createdAt: '2024-01-01 08:00:00' },
  { id: '13', name: '分钟', symbol: 'min', type: 'time', isBase: false, conversionFactor: 0.0166667, status: 'active', createdAt: '2024-01-01 08:00:00' },
  { id: '14', name: '秒', symbol: 's', type: 'time', isBase: false, conversionFactor: 0.000277778, status: 'active', createdAt: '2024-01-01 08:00:00' },
  { id: '15', name: '天', symbol: 'd', type: 'time', isBase: false, conversionFactor: 24, status: 'active', createdAt: '2024-01-01 08:00:00' },
  // 数量
  { id: '16', name: '个', symbol: 'pcs', type: 'quantity', isBase: true, status: 'active', createdAt: '2024-01-01 08:00:00' },
  { id: '17', name: '件', symbol: '件', type: 'quantity', isBase: false, conversionFactor: 1, status: 'active', createdAt: '2024-01-01 08:00:00' },
  { id: '18', name: '箱', symbol: '箱', type: 'quantity', isBase: false, conversionFactor: 12, description: '1箱=12个', status: 'active', createdAt: '2024-01-01 08:00:00' },
  { id: '19', name: '托盘', symbol: '托', type: 'quantity', isBase: false, conversionFactor: 120, description: '1托=120个', status: 'active', createdAt: '2024-01-01 08:00:00' },
  // 面积
  { id: '20', name: '平方米', symbol: 'm²', type: 'area', isBase: true, status: 'active', createdAt: '2024-01-01 08:00:00' },
  { id: '21', name: '平方厘米', symbol: 'cm²', type: 'area', isBase: false, conversionFactor: 0.0001, status: 'active', createdAt: '2024-01-01 08:00:00' },
  { id: '22', name: '平方毫米', symbol: 'mm²', type: 'area', isBase: false, conversionFactor: 0.000001, status: 'active', createdAt: '2024-01-01 08:00:00' },
]

// let nextUomId = 23 // mock auto-increment

function filterUoms(params: UomListParams) {
  let list = [...mockUoms]
  if (params.name) list = list.filter(u => u.name.includes(params.name!) || u.symbol.includes(params.name!))
  if (params.type) list = list.filter(u => u.type === params.type)
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const total = list.length
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total }
}

export const uomApi = {
  // 获取单位列表
  getUoms: async (params: UomListParams): Promise<{ list: Uom[]; total: number }> => {
    try {
      return await request.get<{ list: Uom[]; total: number }>('/v1/sys/uoms', params)
    } catch {
      return mockDelay(filterUoms(params))
    }
  },

  // 创建单位
  createUom: async (data: UomFormData): Promise<{ id: string }> => {
    return await request.post<{ id: string }>('/v1/sys/uoms', data)
  },

  // 更新单位
  updateUom: async (id: string, data: Partial<UomFormData>): Promise<void> => {
    return await request.put<void>(`/v1/sys/uoms/${id}`, data)
  },

  // 删除单位
  deleteUom: async (id: string): Promise<void> => {
    return await request.delete<void>(`/v1/sys/uoms/${id}`)
  },

  // 设置换算系数
  setConversion: async (id: string, conversionFactor: number): Promise<void> => {
    return await request.patch<void>(`/v1/sys/uoms/${id}/conversion`, { conversionFactor })
  },
}


// ==================== 租户管理 ====================

export type TenantStatus = 'trial' | 'formal' | 'expired' | 'disabled'

export interface Tenant {
  id: string
  name: string
  code: string
  contact: string
  phone?: string
  email?: string
  expireAt?: string
  status: TenantStatus
  remark?: string
  createdAt: string
}

export interface TenantListParams {
  name?: string
  status?: string
  page?: number
  pageSize?: number
}

export interface TenantFormData {
  name: string
  code: string
  contact: string
  phone?: string
  email?: string
  expireAt?: string
  status: TenantStatus
  remark?: string
}

// Mock 数据
const now = new Date()
function daysFromNow(days: number): string {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

let mockTenants: Tenant[] = [
  {
    id: '1', name: '华东制造集团', code: 'HDMFG', contact: '王总', phone: '13900001001',
    email: 'wang@hdmfg.com', expireAt: daysFromNow(180), status: 'formal',
    remark: '标准版客户', createdAt: '2024-01-10 09:00:00',
  },
  {
    id: '2', name: '南方精密科技', code: 'NFJM', contact: '李经理', phone: '13900001002',
    email: 'li@nfjm.com', expireAt: daysFromNow(20), status: 'formal',
    remark: '即将到期，需续费', createdAt: '2024-02-15 10:00:00',
  },
  {
    id: '3', name: '北方重工机械', code: 'BFZG', contact: '张总监', phone: '13900001003',
    email: 'zhang@bfzg.com', expireAt: daysFromNow(10), status: 'trial',
    remark: '试用期客户', createdAt: '2024-03-01 11:00:00',
  },
  {
    id: '4', name: '西部电子制造', code: 'XBDZ', contact: '陈主任', phone: '13900001004',
    email: 'chen@xbdz.com', expireAt: daysFromNow(-30), status: 'expired',
    remark: '已过期未续费', createdAt: '2023-12-01 08:00:00',
  },
  {
    id: '5', name: '中原汽配集团', code: 'ZYQP', contact: '刘总', phone: '13900001005',
    email: 'liu@zyqp.com', expireAt: daysFromNow(365), status: 'formal',
    remark: '年度合同客户', createdAt: '2024-01-20 14:00:00',
  },
  {
    id: '6', name: '东海食品加工', code: 'DHSP', contact: '孙经理', phone: '13900001006',
    email: 'sun@dhsp.com', expireAt: daysFromNow(25), status: 'trial',
    remark: '试用中', createdAt: '2024-04-05 09:30:00',
  },
  {
    id: '7', name: '长江纺织科技', code: 'CJFZ', contact: '赵总', phone: '13900001007',
    email: 'zhao@cjfz.com', expireAt: daysFromNow(-10), status: 'disabled',
    remark: '主动停用', createdAt: '2023-11-15 10:00:00',
  },
]

// let nextTenantId = 8 // mock auto-increment

function filterTenants(params: TenantListParams) {
  let list = [...mockTenants]
  if (params.name) list = list.filter(t => t.name.includes(params.name!) || t.code.includes(params.name!))
  if (params.status) list = list.filter(t => t.status === params.status)
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const total = list.length
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total }
}

export const tenantApi = {
  getTenants: async (params: TenantListParams): Promise<{ list: Tenant[]; total: number }> => {
    try {
      return await request.get<{ list: Tenant[]; total: number }>('/v1/sys/tenants', params)
    } catch {
      return mockDelay(filterTenants(params))
    }
  },

  createTenant: async (data: TenantFormData): Promise<{ id: string }> => {
    return await request.post<{ id: string }>('/v1/sys/tenants', data)
  },

  updateTenant: async (id: string, data: Partial<TenantFormData>): Promise<void> => {
    return await request.put<void>(`/v1/sys/tenants/${id}`, data)
  },

  toggleTenantStatus: async (id: string, status: TenantStatus): Promise<void> => {
    return await request.patch<void>(`/v1/sys/tenants/${id}/status`, { status })
  },
}
