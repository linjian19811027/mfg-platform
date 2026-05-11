import axios from 'axios';

const API_URL = 'http://localhost:5173/api/v1/plm/standard-operations';

const stdOps = [
  { code: 'OP-WELD-01', name: '手工电弧焊', workCenterName: '焊接一车间', stdHours: 15, setupTime: 5, description: '基础焊接工序' },
  { code: 'OP-POLISH-01', name: '精细抛光', workCenterName: '表面处理课', stdHours: 10, setupTime: 2, description: '镜面抛光处理' },
  { code: 'OP-ASSY-01', name: '成品组装', workCenterName: '总装线', stdHours: 45, setupTime: 10, description: '最终产品组装' },
  { code: 'OP-INSP-01', name: '出厂检验', workCenterName: '质检科', stdHours: 5, setupTime: 1, description: '全项功能测试' },
];

async function seed() {
  for (const op of stdOps) {
    try {
      await axios.post(API_URL, op, {
        headers: { 'Authorization': 'Bearer test-token', 'x-tenant-id': '1' }
      });
      console.log(`Created: ${op.name}`);
    } catch (e) {
      console.error(`Failed: ${op.name}`, e.message);
    }
  }
}

// Note: This script assumes a valid token or that the backend is in a state that allows this.
// For now, I'll just provide the data structure.
console.log('Seed data ready.');
