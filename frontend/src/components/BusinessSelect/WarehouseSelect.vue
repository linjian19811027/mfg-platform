<template>
  <a-select
    v-model="internalValue"
    :loading="loading"
    :placeholder="placeholder || $t('common.placeholder.select')"
    allow-search
    allow-clear
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
import { wmsApi, Warehouse } from '@/api/wms'

const props = defineProps<{
  modelValue?: string
  placeholder?: string
}>()

const emit = defineEmits(['update:modelValue', 'change'])

const loading = ref(false)
const internalValue = ref(props.modelValue)
const options = ref<Warehouse[]>([])

const fetchData = async () => {
  loading.value = true
  try {
    const res = await wmsApi.getWarehouses()
    options.value = res.list
  } catch (error) {
    console.error('Fetch warehouses failed:', error)
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
