import request from '@/utils/request'

// 员工管理
export function getEmployees(params: any) {
  return request.get('/v1/hr/employees', { params })
}

export function getEmployee(id: string) {
  return request.get(`/v1/hr/employees/${id}`)
}

export function createEmployee(data: any) {
  return request.post('/v1/hr/employees', data)
}

export function updateEmployee(id: string, data: any) {
  return request.put(`/v1/hr/employees/${id}`, data)
}

export function updateEmployeeStatus(id: string, status: string) {
  return request.patch(`/v1/hr/employees/${id}/status`, { status })
}

export function deleteEmployee(id: string) {
  return request.delete(`/v1/hr/employees/${id}`)
}

export function getEmployeeOverview() {
  return request.get('/v1/hr/employees/overview')
}

export function exportEmployees(params: any) {
  return request.get('/v1/hr/employees/export', { params, responseType: 'blob' })
}

// 技能认证
export function getCertificationTypes() {
  return request.get('/v1/hr/certifications/types')
}

export function addCertification(data: any) {
  return request.post('/v1/hr/certifications', data)
}

export function renewCertification(id: string, data: any) {
  return request.patch(`/v1/hr/certifications/${id}/renew`, data)
}

export function deleteCertification(id: string) {
  return request.delete(`/v1/hr/certifications/${id}`)
}

export function getEmployeeCertifications(employeeId: string) {
  return request.get(`/v1/hr/certifications/employee/${employeeId}`)
}

export function getExpiringCertifications(params: any) {
  return request.get('/v1/hr/certifications/expiring', { params })
}

export function exportCertifications(params: any) {
  return request.get('/v1/hr/certifications/export', { params, responseType: 'blob' })
}

// 排班管理
export function getShifts() {
  return request.get('/v1/hr/shifts')
}

export function createSchedule(data: any) {
  return request.post('/v1/hr/schedules', data)
}

export function batchCreateSchedule(data: any) {
  return request.post('/v1/hr/schedules/batch', data)
}

export function deleteSchedule(id: string) {
  return request.delete(`/v1/hr/schedules/${id}`)
}

export function getSchedules(params: any) {
  return request.get('/v1/hr/schedules', { params })
}

export function getScheduleStats(params: any) {
  return request.get('/v1/hr/schedules/stats', { params })
}

// 工时统计
export function getWorkHourDashboard(params: any) {
  return request.get('/v1/hr/work-hours/dashboard', { params })
}

export function getWorkHourSummary(params: any) {
  return request.get('/v1/hr/work-hours/summary', { params })
}

export function getWorkHourRecords(params: any) {
  return request.get('/v1/hr/work-hours/records', { params })
}

export function exportWorkHours(params: any) {
  return request.get('/v1/hr/work-hours/export', { params, responseType: 'blob' })
}
