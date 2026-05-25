<template>
  <a-select
    v-model="internalValue"
    :loading="loading"
    :placeholder="placeholder || $t('common.placeholder.select')"
    allow-search
    allow-clear
    :trigger-props="{ updateAtScroll: true, autoFixPosition: true }"
    
    @change="handleChange"
  >
    <a-option
      v-for="item in options"
      :key="item.id"
      :value="item.id"
      :label="item.name"
    >
      {{ item.name }} ({{ item.code }})
    </a-option>
  </a-select>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue'
import { orgApi, OrgNode } from '@/api/sys'

const props = defineProps<{
  modelValue?: string
  placeholder?: string
}>()

const emit = defineEmits(['update:modelValue', 'change'])

const loading = ref(false)
const internalValue = ref(props.modelValue)
const options = ref<OrgNode[]>([])

const flattenOrg = (nodes: OrgNode[]): OrgNode[] => {
  const result: OrgNode[] = []
  const walk = (list: OrgNode[]) => {
    for (const n of list) {
      // 这里的逻辑可以根据业务调整，如果只要叶子节点或者只要特定类型的
      // 目前我们把所有节点都放进去，如果是工作中心，通常是 WORKSTATION 类型
      result.push(n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(nodes)
  return result
}

const fetchData = async () => {
  loading.value = true
  try {
    const tree = await orgApi.getOrgTree()
    const allNodes = flattenOrg(tree)
    // 过滤出工作中心（假设类型包含 WORKSTATION 或 LINE）
    // 如果没有类型限制，就显示全部
    options.value = allNodes
  } catch (error) {
    console.error('Fetch work centers failed:', error)
  } finally {
    loading.value = false
  }
}

const handleChange = (val: any) => {
  const selected = options.value.find(o => o.id === val)
  emit('update:modelValue', val)
  emit('change', selected)
}

watch(() => props.modelValue, (val) => {
  internalValue.value = val
})

onMounted(() => {
  fetchData()
})
</script>
