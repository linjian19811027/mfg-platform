<template>
  <a-select
    v-model="internalValue"
    :loading="loading"
    :placeholder="placeholder || $t('common.placeholder.select')"
    allow-search
    allow-clear
    @change="handleChange"
    @search="handleSearch"
    :filter-option="false"
  >
    <a-option
      v-for="item in options"
      :key="item.id"
      :value="item.id"
      :label="`${item.code} - ${item.name}`"
    >
      {{ item.code }} - {{ item.name }}
    </a-option>
  </a-select>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue'
import { plmApi, Material } from '@/api/plm'
import { debounce } from 'lodash-es'

const props = defineProps<{
  modelValue?: string
  placeholder?: string
}>()

const emit = defineEmits(['update:modelValue', 'change'])

const loading = ref(false)
const internalValue = ref(props.modelValue)
const options = ref<Material[]>([])

const fetchData = async (keyword?: string) => {
  loading.value = true
  try {
    const res = await plmApi.getMaterials({ keyword, pageSize: 50 })
    options.value = res.list
  } catch (error) {
    console.error('Fetch materials failed:', error)
  } finally {
    loading.value = false
  }
}

const handleSearch = debounce((val: string) => {
  fetchData(val)
}, 300)

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
