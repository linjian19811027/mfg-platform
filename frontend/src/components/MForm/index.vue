<template>
  <a-form
    ref="formRef"
    :model="modelValue"
    :layout="layout"
    :label-col-props="layout === 'horizontal' ? labelColProps : undefined"
  >
    <a-grid :cols="24" :col-gap="16" :row-gap="0">
      <a-grid-item
        v-for="field in schema"
        :key="field.field"
        :span="field.span ?? 24"
      >
        <a-form-item
          :field="field.field"
          :label="field.label"
          :rules="buildRules(field)"
          :validate-trigger="field.type === 'select' || field.type === 'date' || field.type === 'datetime' ? ['change'] : ['blur', 'change']"
        >
          <!-- input -->
          <a-input
            v-if="field.type === 'input'"
            :model-value="(modelValue[field.field] as string)"
            :placeholder="field.placeholder"
            :disabled="field.disabled"
            v-bind="field.props"
            @update:model-value="update(field.field, $event)"
          />

          <!-- number -->
          <a-input-number
            v-else-if="field.type === 'number'"
            :model-value="(modelValue[field.field] as number)"
            :placeholder="field.placeholder"
            :disabled="field.disabled"
            v-bind="field.props"
            @update:model-value="update(field.field, $event)"
          />

          <!-- select -->
          <a-select
            v-else-if="field.type === 'select'"
            :model-value="modelValue[field.field]"
            :placeholder="field.placeholder"
            :disabled="field.disabled"
            :options="field.options"
            v-bind="field.props"
            @update:model-value="update(field.field, $event)"
          />

          <!-- date -->
          <a-date-picker
            v-else-if="field.type === 'date'"
            :model-value="(modelValue[field.field] as string)"
            :placeholder="field.placeholder"
            :disabled="field.disabled"
            style="width: 100%"
            v-bind="field.props"
            @update:model-value="update(field.field, $event)"
          />

          <!-- datetime -->
          <a-date-picker
            v-else-if="field.type === 'datetime'"
            :model-value="(modelValue[field.field] as string)"
            :placeholder="field.placeholder"
            :disabled="field.disabled"
            show-time
            style="width: 100%"
            v-bind="field.props"
            @update:model-value="update(field.field, $event)"
          />

          <!-- textarea -->
          <a-textarea
            v-else-if="field.type === 'textarea'"
            :model-value="(modelValue[field.field] as string)"
            :placeholder="field.placeholder"
            :disabled="field.disabled"
            v-bind="field.props"
            @update:model-value="update(field.field, $event)"
          />

          <!-- switch -->
          <a-switch
            v-else-if="field.type === 'switch'"
            :model-value="(modelValue[field.field] as boolean)"
            :disabled="field.disabled"
            v-bind="field.props"
            @update:model-value="update(field.field, $event)"
          />

          <!-- radio -->
          <a-radio-group
            v-else-if="field.type === 'radio'"
            :model-value="modelValue[field.field]"
            :disabled="field.disabled"
            v-bind="field.props"
            @update:model-value="update(field.field, $event)"
          >
            <a-radio
              v-for="opt in field.options"
              :key="String(opt.value)"
              :value="opt.value"
            >{{ opt.label }}</a-radio>
          </a-radio-group>

          <!-- checkbox -->
          <a-checkbox-group
            v-else-if="field.type === 'checkbox'"
            :model-value="(modelValue[field.field] as unknown[])"
            :disabled="field.disabled"
            :options="field.options"
            v-bind="field.props"
            @update:model-value="update(field.field, $event)"
          />

          <!-- business-selects -->
          <SupplierSelect
            v-else-if="field.type === 'supplier-select'"
            :model-value="(modelValue[field.field] as string)"
            :disabled="field.disabled"
            v-bind="field.props"
            @update:model-value="update(field.field, $event)"
          />

          <WorkCenterSelect
            v-else-if="field.type === 'work-center-select'"
            :model-value="(modelValue[field.field] as string)"
            :disabled="field.disabled"
            v-bind="field.props"
            @update:model-value="update(field.field, $event)"
          />

          <WarehouseSelect
            v-else-if="field.type === 'warehouse-select'"
            :model-value="(modelValue[field.field] as string)"
            :disabled="field.disabled"
            v-bind="field.props"
            @update:model-value="update(field.field, $event)"
          />

          <UomSelect
            v-else-if="field.type === 'uom-select'"
            :model-value="(modelValue[field.field] as string)"
            :disabled="field.disabled"
            v-bind="field.props"
            @update:model-value="update(field.field, $event)"
          />

          <MaterialSelect
            v-else-if="field.type === 'material-select'"
            :model-value="(modelValue[field.field] as string)"
            :disabled="field.disabled"
            v-bind="field.props"
            @update:model-value="update(field.field, $event)"
          />

          <CategorySelect
            v-else-if="field.type === 'category-select'"
            :model-value="(modelValue[field.field] as string)"
            :disabled="field.disabled"
            v-bind="field.props"
            @update:model-value="update(field.field, $event)"
          />

          <!-- slot -->
          <template v-else-if="field.type === 'slot' && field.slotName">
            <slot :name="field.slotName" :field="field" :value="modelValue[field.field]" :update="(v: unknown) => update(field.field, v)" />
          </template>
        </a-form-item>
      </a-grid-item>
    </a-grid>

    <!-- 操作按钮 -->
    <div v-if="showActions" class="m-form__actions">
      <a-space>
        <a-button @click="emit('cancel')">{{ effectiveCancelText }}</a-button>
        <a-button type="primary" :loading="loading" @click="handleSubmit">{{ effectiveSubmitText }}</a-button>
      </a-space>
    </div>
  </a-form>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SupplierSelect from '@/components/BusinessSelect/SupplierSelect.vue'
import WorkCenterSelect from '@/components/BusinessSelect/WorkCenterSelect.vue'
import WarehouseSelect from '@/components/BusinessSelect/WarehouseSelect.vue'
import UomSelect from '@/components/BusinessSelect/UomSelect.vue'
import MaterialSelect from '@/components/BusinessSelect/MaterialSelect.vue'
import CategorySelect from '@/components/BusinessSelect/CategorySelect.vue'

export interface MFormField {
  field: string
  label: string
  type: 'input' | 'number' | 'select' | 'date' | 'datetime' | 'textarea' | 'switch' | 'radio' | 'checkbox' | 'slot' | 'supplier-select' | 'work-center-select' | 'warehouse-select' | 'uom-select' | 'material-select' | 'category-select'
  placeholder?: string
  required?: boolean
  rules?: unknown[]
  options?: { label: string; value: unknown }[]
  slotName?: string
  disabled?: boolean
  span?: number
  props?: Record<string, unknown>
}

const props = withDefaults(defineProps<{
  schema: MFormField[]
  modelValue: Record<string, unknown>
  loading?: boolean
  showActions?: boolean
  submitText?: string
  cancelText?: string
  layout?: 'vertical' | 'horizontal'
  labelColProps?: object
}>(), {
  loading: false,
  showActions: true,
  layout: 'vertical',
})

const { t } = useI18n()
const effectiveSubmitText = computed(() => props.submitText || t('common.save'))
const effectiveCancelText = computed(() => props.cancelText || t('common.cancel'))

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>]
  'submit': [value: Record<string, unknown>]
  'cancel': []
}>()

const formRef = ref()

function update(field: string, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

function buildRules(field: MFormField): unknown[] {
  const rules: unknown[] = []
  if (field.required) {
    rules.push({ required: true, message: t('common.required', { label: field.label }) })
  }
  if (field.rules?.length) {
    rules.push(...field.rules)
  }
  return rules
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
    emit('submit', { ...props.modelValue })
  } catch {
    // 校验失败，不提交
  }
}

defineExpose({ validate: () => formRef.value?.validate() })
</script>

<style scoped>
.m-form__actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
  margin-top: 8px;
}
</style>
