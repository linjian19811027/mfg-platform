<template>
  <a-select
    v-model="internalValue"
    :loading="loading"
    :placeholder="placeholder || $t('common.placeholder.select')"
    allow-search
    allow-clear
    @change="handleChange"
    :disabled="!warehouseId"
  >
    <a-option
      v-for="item in options"
      :key="item.id"
      :value="item.id"
      :label="item.code"
    >
      {{ item.code }}
    </a-option>
  </a-select>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue'
import { wmsApi, WmsLocation } from '@/api/wms'

const props = defineProps<{
  modelValue?: string
  warehouseId?: string
  placeholder?: string
}>()

const emit = defineEmits(['update:modelValue', 'change'])

const loading = ref(false)
const internalValue = ref(props.modelValue)
const options = ref<WmsLocation[]>([])

const fetchData = async () => {
  if (!props.warehouseId) {
    options.value = []
    return
  }
  loading.value = true
  try {
    const res = await wmsApi.getLocations({ warehouseId: props.warehouseId, pageSize: 500 })
    options.value = (res.list ?? []) as any[]
  } catch (error) {
    console.error('Fetch locations failed:', error)
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

watch(() => props.warehouseId, () => {
  internalValue.value = ''
  emit('update:modelValue', '')
  fetchData()
})

onMounted(() => {
  fetchData()
})
</script>
