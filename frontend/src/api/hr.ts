import { request } from '@/utils/request'

// ── 员工管理 ──────────────────────────────────────────────────────────

export interface HrEmployee {
  id: number
  empNo: string
  name: string
  jobType: string
  workCenterId?: number
  hireDate: string
  leaveDate?: string
  status: string  // ACTIVE / INACTIVE / SUSPENDED
  phone?: string
  idCard?: string
  emergencyContact?: string
  emergencyPhone?: string
  remark?: string
  createdAt?: string
  updatedAt?: string
}

export interface HrEmployeeQuery {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  jobType?: string
  workCenterId?: number
  empNo?: string
  name?: string
}

export interface EmployeePageResult {
  list: HrEmployee[]
  total: number
}

export interface CreateEmployeePayload {
  empNo: string
  name: string
  jobType: string
  workCenterId?: number
  hireDate: string
  phone?: string
  idCard?: string
  emergencyContact?: string
  emergencyPhone?: string
  remark?: string
}

export interface UpdateEmployeePayload {
  name?: string
  jobType?: string
  workCenterId?: number
  phone?: string
  idCard?: string
  emergencyContact?: string
  emergencyPhone?: string
  remark?: string
}

export interface EmployeeOverview {
  total: number
  activeCount: number
  inactiveCount: number
  suspendedCount: number
  byJobType: { jobType: string; count: number }[]
}

// 员工管理 API
export function getEmployees(params: HrEmployeeQuery) {
  return request.get<EmployeePageResult>('/v1/hr/employees', { params })
}

export function getEmployee(id: string) {
  return request.get<HrEmployee>(`/v1/hr/employees/${id}`)
}

export function createEmployee(data: CreateEmployeePayload) {
  return request.post<HrEmployee>('/v1/hr/employees', data)
}

export function updateEmployee(id: string, data: UpdateEmployeePayload) {
  return request.put<HrEmployee>(`/v1/hr/employees/${id}`, data)
}

export function updateEmployeeStatus(id: string, status: string) {
  return request.patch(`/v1/hr/employees/${id}/status`, { status })
}

export function deleteEmployee(id: string) {
  return request.delete(`/v1/hr/employees/${id}`)
}

export function getEmployeeOverview() {
  return request.get<EmployeeOverview>('/v1/hr/employees/overview')
}

export function exportEmployees(params: HrEmployeeQuery) {
  return request.get('/v1/hr/employees/export', { params, responseType: 'blob' })
}

// ── 员工履历 ──────────────────────────────────────────────────────────

export interface HrEmployeeHistory {
  id: string
  tenantId: string
  employeeId: string
  eventType: 'ONBOARD' | 'TRANSFER' | 'PROMOTION' | 'STATUS_CHANGE' | 'RESIGN' | 'INFO_UPDATE'
  description: string
  operatorId?: string
  fromJobType?: string
  toJobType?: string
  fromWorkCenterId?: number
  toWorkCenterId?: number
  fromStatus?: string
  toStatus?: string
  remark?: string
  createdAt: string
}

export function getEmployeeHistory(employeeId: string) {
  return request.get<HrEmployeeHistory[]>(`/v1/hr/employees/${employeeId}/history`)
}

// ── 工种与工作中心 ──────────────────────────────────────────────────────

export interface HrJobType {
  id: number
  name: string
  code?: string
  description?: string
  enabled: number
}

export interface MfgWorkCenter {
  id: number
  name: string
  code?: string
  description?: string
  enabled: number
}

// ── 班次管理 ──────────────────────────────────────────────────────────

export interface HrShift {
  id: number
  code: string
  name: string
  startTime: string  // HH:mm
  endTime: string    // HH:mm
  isCrossDay: number  // 0/1
  durationHours: number
  enabled: number  // 0/1
  createdAt?: string
  updatedAt?: string
}

export interface CreateShiftPayload {
  code: string
  name: string
  startTime: string
  endTime: string
  enabled?: number
}

export interface UpdateShiftPayload {
  code?: string
  name?: string
  startTime?: string
  endTime?: string
  enabled?: number
}

// ── 技能认证 ──────────────────────────────────────────────────────────

export interface HrCertificationType {
  id: number
  code: string
  name: string
  isMandatory: number  // 0/1
  defaultValidityMonths: number
  enabled: number  // 0/1
  createdAt?: string
  updatedAt?: string
}

export interface CreateCertTypePayload {
  code: string
  name: string
  isMandatory?: number
  defaultValidityMonths?: number
  enabled?: number
}

export interface UpdateCertTypePayload {
  code?: string
  name?: string
  isMandatory?: number
  defaultValidityMonths?: number
  enabled?: number
}

export interface HrEmployeeCertification {
  id: number
  empId: number
  certTypeId: number
  certNo: string
  issueDate: string
  expireDate: string
  issuer?: string
  attachmentPath?: string
  isExpired: number  // 0/1
  isExpiringSoon: number  // 0/1
  remark?: string
  createdAt?: string
  updatedAt?: string
}

export interface CertificationQuery {
  empId?: number
  certTypeId?: number
  expired?: number
  expiringSoon?: number
  page?: number
  pageSize?: number
}

export interface CreateCertificationPayload {
  empId: number
  certTypeId: number
  certNo: string
  issueDate: string
  expireDate: string
  issuer?: string
  attachmentPath?: string
  remark?: string
}

export interface RenewCertificationPayload {
  expireDate: string
  remark?: string
}

// 技能认证 API
export function getCertificationTypes() {
  return request.get<HrCertificationType[]>('/v1/base/certification-types')
}

export function createCertificationType(data: CreateCertTypePayload) {
  return request.post<HrCertificationType>('/v1/base/certification-types', data)
}

export function updateCertificationType(id: number, data: UpdateCertTypePayload) {
  return request.put<HrCertificationType>(`/v1/base/certification-types/${id}`, data)
}

export function deleteCertificationType(id: number) {
  return request.delete<void>(`/v1/base/certification-types/${id}`)
}

export function addCertification(data: CreateCertificationPayload) {
  const { empId, ...body } = data
  return request.post<HrEmployeeCertification>(`/v1/hr/employees/${empId}/certifications`, body)
}

export function renewCertification(id: string, data: RenewCertificationPayload) {
  return request.patch(`/v1/hr/certifications/${id}/renew`, data)
}

export function deleteCertification(id: string) {
  return request.delete(`/v1/hr/certifications/${id}`)
}

export function getEmployeeCertifications(employeeId: string) {
  return request.get<HrEmployeeCertification[]>(`/v1/hr/employees/${employeeId}/certifications`)
}

export function getExpiringCertifications(params: CertificationQuery) {
  return request.get<{ list: HrEmployeeCertification[]; total: number }>('/v1/hr/certifications/expiring', { params })
}

export function exportCertifications(params: CertificationQuery) {
  return request.get('/v1/hr/certifications/export', { params, responseType: 'blob' })
}

// ── 排班管理 ──────────────────────────────────────────────────────────

export interface HrShiftSchedule {
  id: number
  empId: number
  empName?: string
  scheduleDate: string
  shiftId: number
  shiftName?: string
  shiftCode?: string
  workCenterId?: number
  equipmentId?: number
  remark?: string
  createdAt?: string
  updatedAt?: string
}

export interface ScheduleQuery {
  page?: number
  pageSize?: number
  empId?: number
  shiftId?: number
  workCenterId?: number
  startDate?: string
  endDate?: string
}

export interface ScheduleStats {
  totalSchedules: number
  byShift: { shiftCode: string; count: number }[]
  byWorkCenter: { workCenterId: number; workCenterName: string; count: number }[]
  upcomingExpiring: number
}

export interface CreateSchedulePayload {
  empId: number
  scheduleDate: string
  shiftId: number
  workCenterId?: number
  equipmentId?: number
  remark?: string
}

export interface BatchCreateSchedulePayload {
  empId: number
  shiftId: number
  startDate: string
  endDate: string
  workCenterId?: number
  equipmentId?: number
  remark?: string
}

// 排班管理 API
export function getShifts() {
  return request.get<HrShift[]>('/v1/base/shifts')
}

export function createShift(data: CreateShiftPayload) {
  return request.post<HrShift>('/v1/base/shifts', data)
}

export function updateShift(id: number, data: UpdateShiftPayload) {
  return request.put<HrShift>(`/v1/base/shifts/${id}`, data)
}

export function deleteShift(id: number) {
  return request.delete<void>(`/v1/base/shifts/${id}`)
}

export function createSchedule(data: CreateSchedulePayload) {
  return request.post<HrShiftSchedule>('/v1/hr/schedules', data)
}

export function batchCreateSchedule(data: BatchCreateSchedulePayload) {
  return request.post<HrShiftSchedule[]>('/v1/hr/schedules/batch', data)
}

export function deleteSchedule(id: string) {
  return request.delete(`/v1/hr/schedules/${id}`)
}

export function getSchedules(params: ScheduleQuery) {
  return request.get<{ list: HrShiftSchedule[]; total: number }>('/v1/hr/schedules', { params })
}

export function getScheduleStats(params: { startDate?: string; endDate?: string }) {
  return request.get<ScheduleStats>('/v1/hr/schedules/stats', { params })
}

// ── 工时统计 ──────────────────────────────────────────────────────────

export interface HrWorkHourRecord {
  id: number
  empId: number
  empName?: string
  reportDate: string
  operationCode: string
  workCenterId?: number
  workCenterName?: string
  actualHours: number
  mesReportId?: number
  createdAt?: string
  updatedAt?: string
}

export interface HrWorkHourSummary {
  id: number
  empId: number
  empName?: string
  summaryDate: string
  dimension: string  // DAY / WEEK / MONTH
  totalHours: number
  normalHours: number
  overtimeHours: number
  createdAt?: string
  updatedAt?: string
}

export interface WorkHourDashboard {
  todayTotalHours: number
  weekTotalHours: number
  monthTotalHours: number
  overtimeRate: number
  recentTrend: { date: string; hours: number }[]
}

export interface WorkHourRecordQuery {
  page?: number
  pageSize?: number
  empId?: number
  startDate?: string
  endDate?: string
  workCenterId?: number
}

export interface WorkHourSummaryQuery {
  empId?: number
  dimension: string  // DAY / WEEK / MONTH
  startDate?: string
  endDate?: string
}

export interface WorkHourSummaryResult {
  list: HrWorkHourSummary[]
  total: number
}

// 工时统计 API
export function getWorkHourDashboard(params: { startDate?: string; endDate?: string }) {
  return request.get<WorkHourDashboard>('/v1/hr/work-hours/dashboard', { params })
}

export function getWorkHourSummary(params: WorkHourSummaryQuery) {
  return request.get<WorkHourSummaryResult>('/v1/hr/work-hours/summary', { params })
}

export function getWorkHourRecords(params: WorkHourRecordQuery) {
  return request.get<{ list: HrWorkHourRecord[]; total: number }>('/v1/hr/work-hours/records', { params })
}

export function exportWorkHours(params: WorkHourRecordQuery) {
  return request.get('/v1/hr/work-hours/export', { params, responseType: 'blob' })
}

// 工种与工作中心 API
export function getJobTypes() {
  return request.get<HrJobType[]>('/v1/hr/job-types')
}

export function createJobType(data: { name: string; code?: string; description?: string }) {
  return request.post('/v1/hr/job-types', data)
}

export function updateJobType(id: number, data: { name?: string; code?: string; description?: string; enabled?: number }) {
  return request.put(`/v1/hr/job-types/${id}`, data)
}

export function deleteJobType(id: number) {
  return request.delete(`/v1/hr/job-types/${id}`)
}

export function getWorkCenters() {
  return request.get<MfgWorkCenter[]>('/v1/base/work-centers')
}

export function createWorkCenter(data: { name: string; code?: string; type?: string; jobTypeId?: number }) {
  return request.post('/v1/base/work-centers', data)
}

export function updateWorkCenter(id: number, data: { name?: string; code?: string; type?: string; jobTypeId?: number; enabled?: number }) {
  return request.put(`/v1/base/work-centers/${id}`, data)
}

export function deleteWorkCenter(id: number) {
  return request.delete(`/v1/base/work-centers/${id}`)
}
