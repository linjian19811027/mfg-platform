<template>
  <a-tree-select
    v-model="internalValue"
    :data="treeData"
    :placeholder="placeholder || $t('common.placeholder.select')"
    allow-clear
    allow-search
    :field-names="{
      key: 'id',
      title: 'name',
      children: 'children'
    }"
    :trigger-props="{ updateAtScroll: true, autoFixPosition: true }"
    @change="handleChange"
  />
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue'
import { plmApi, MaterialCategory } from '@/api/plm'

const props = defineProps<{
  modelValue?: string
  placeholder?: string
}>()

const emit = defineEmits(['update:modelValue', 'change'])

const internalValue = ref(props.modelValue)
const treeData = ref<MaterialCategory[]>([])

const fetchCategories = async () => {
  try {
    const res = await plmApi.getCategories()
    treeData.value = res
  } catch (error) {
    console.error('Fetch categories failed:', error)
  }
}

const handleChange = (val: any) => {
  emit('update:modelValue', val)
  emit('change', val)
}

watch(() => props.modelValue, (val) => {
  internalValue.value = val
})

onMounted(() => {
  fetchCategories()
})
</script>
