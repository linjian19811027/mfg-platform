/** 通用分页查询参数 */
export interface PageQuery {
  page?: number
  pageSize?: number
}

/** 通用分页响应结构 */
export interface PageResult<T> {
  list: T[]
  total: number
}

/** 文件类型 */
export type FileType = 'image' | 'document' | 'spreadsheet' | 'pdf' | 'other'

/** 物料质量状态 */
export type QualityStatus = 'UNINSPECTED' | 'QUALIFIED' | 'UNQUALIFIED' | 'PENDING'

/** 通用选项（下拉框） */
export interface SelectOption<T = string> {
  label: string
  value: T
  disabled?: boolean
}

/** 日期范围查询 */
export interface DateRangeQuery {
  startDate?: string
  endDate?: string
}
