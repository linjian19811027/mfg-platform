# API 测试脚本 - 测试各模块接口并写入测试数据
$BASE = "http://localhost:3000/api/v1"
$TID = "DEFAULT"

function Invoke-Api {
    param($Method, $Path, $Body = $null)
    $uri = "$BASE$Path"
    $h = @{ "Authorization" = "Bearer $script:TOKEN"; "Content-Type" = "application/json" }
    try {
        if ($Body) {
            $r = Invoke-RestMethod -Uri $uri -Method $Method -Headers $h -Body ($Body | ConvertTo-Json -Depth 10)
        } else {
            $r = Invoke-RestMethod -Uri $uri -Method $Method -Headers $h
        }
        return $r.data ?? $r
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        Write-Host "  ❌ $Method $Path -> $status : $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

function Test-Ok { param($label, $obj)
    if ($obj -and ($obj.id -or $obj.list -ne $null -or $obj.Count -ge 0)) {
        Write-Host "  ✅ $label" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  $label (空响应)" -ForegroundColor Yellow
    }
}

# ── 登录 ──────────────────────────────────────────────────────────────────
Write-Host "`n=== 登录 ===" -ForegroundColor Cyan
$loginResp = Invoke-RestMethod -Uri "$BASE/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"admin","password":"Admin@123456","tenantCode":"DEFAULT"}'
$script:TOKEN = $loginResp.data.accessToken
if ($script:TOKEN) { Write-Host "  ✅ 登录成功" -ForegroundColor Green } else { Write-Host "  ❌ 登录失败"; exit 1 }

# ── PLM ───────────────────────────────────────────────────────────────────
Write-Host "`n=== PLM 模块 ===" -ForegroundColor Cyan

# 物料分类
$cat = Invoke-Api POST "/plm/materials/categories?tenantId=$TID" @{code="RAW";name="原材料";level=1}
Test-Ok "物料分类创建" $cat

# 物料
$mat = Invoke-Api POST "/plm/materials" @{tenantId=$TID;code="MAT-001";name="不锈钢板304";type="RAW";uomId="1";status="ACTIVE"}
Test-Ok "物料创建" $mat

$mats = Invoke-Api GET "/plm/materials?tenantId=$TID"
Test-Ok "物料列表" $mats

# BOM
$bom = Invoke-Api POST "/plm/boms" @{tenantId=$TID;bom=@{materialId=($mat.id ?? "1");version="V1.0";status="DRAFT"};lines=@()}
Test-Ok "BOM创建" $bom

# 工艺路线
$routing = Invoke-Api POST "/plm/routings" @{tenantId=$TID;routing=@{code="RT-001";name="标准加工路线";materialId=($mat.id ?? "1");status="DRAFT"};operations=@()}
Test-Ok "工艺路线创建" $routing

# ── SCM ───────────────────────────────────────────────────────────────────
Write-Host "`n=== SCM 模块 ===" -ForegroundColor Cyan

$supplier = Invoke-Api POST "/scm/suppliers?tenantId=$TID" @{code="SUP-001";name="华东钢铁有限公司";type="QUALIFIED";contactName="张经理";contactPhone="13800001001";region="华东"}
Test-Ok "供应商创建" $supplier

$suppliers = Invoke-Api GET "/scm/suppliers?tenantId=$TID"
Test-Ok "供应商列表" $suppliers

$pr = Invoke-Api POST "/scm/purchase-requests?tenantId=$TID" @{materialId=($mat.id ?? "1");quantity=1000;uomId="1";expectedDate="2026-06-01";reason="生产需求";requestedBy="admin"}
Test-Ok "采购申请创建" $pr

$po = Invoke-Api POST "/scm/purchase-orders?tenantId=$TID" @{data=@{supplierId=($supplier.id ?? "1");currency="CNY";orderDate="2026-04-17";expectedDate="2026-05-01"};lines=@(@{materialId=($mat.id ?? "1");quantity=1000;unitPrice=50;uomId="1"})}
Test-Ok "采购订单创建" $po

# ── WMS ───────────────────────────────────────────────────────────────────
Write-Host "`n=== WMS 模块 ===" -ForegroundColor Cyan

$wh = Invoke-Api POST "/wms/warehouses?tenantId=$TID" @{code="WH-001";name="主仓库";type="PHYSICAL";status="ACTIVE"}
Test-Ok "仓库创建" $wh

$inv = Invoke-Api GET "/wms/inventory?tenantId=$TID"
Test-Ok "库存查询" $inv

# ── ERP ───────────────────────────────────────────────────────────────────
Write-Host "`n=== ERP 模块 ===" -ForegroundColor Cyan

$customer = Invoke-Api POST "/erp/customers?tenantId=$TID" @{code="CUS-001";name="上海机械制造有限公司";type="KEY";creditLimit=500000;contactName="李总";contactPhone="13900001001"}
Test-Ok "客户创建" $customer

$customers = Invoke-Api GET "/erp/customers?tenantId=$TID"
Test-Ok "客户列表" $customers

$so = Invoke-Api POST "/erp/sales-orders?tenantId=$TID" @{data=@{customerId=($customer.id ?? "1");currency="CNY";orderDate="2026-04-17";deliveryDate="2026-05-17"};lines=@(@{materialId=($mat.id ?? "1");quantity=100;unitPrice=200;uomId="1"})}
Test-Ok "销售订单创建" $so

# ── EAM ───────────────────────────────────────────────────────────────────
Write-Host "`n=== EAM 模块 ===" -ForegroundColor Cyan

$eq = Invoke-Api POST "/eam/equipment" @{tenantId=$TID;code="EQ-001";name="数控加工中心CNC-001";type="MACHINE";status="RUNNING";workshopId="车间A";model="VMC850";manufacturer="大连机床"}
Test-Ok "设备创建" $eq

$eqs = Invoke-Api GET "/eam/equipment?tenantId=$TID"
Test-Ok "设备列表" $eqs

# ── MES ───────────────────────────────────────────────────────────────────
Write-Host "`n=== MES 模块 ===" -ForegroundColor Cyan

$wo = Invoke-Api POST "/mes/work-orders" @{tenantId=$TID;code="WO-2026-001";materialId=($mat.id ?? "1");plannedQty=100;status="RELEASED";priority=5;plannedStartDate="2026-04-18";plannedEndDate="2026-04-25"}
Test-Ok "工单创建" $wo

$wos = Invoke-Api GET "/mes/work-orders?tenantId=$TID"
Test-Ok "工单列表" $wos

# ── QMS ───────────────────────────────────────────────────────────────────
Write-Host "`n=== QMS 模块 ===" -ForegroundColor Cyan

$std = Invoke-Api POST "/qms/standards" @{tenantId=$TID;code="STD-001";name="不锈钢板来料检验标准";inspectionType="IQC";status="ACTIVE"}
Test-Ok "检验标准创建" $std

$stds = Invoke-Api GET "/qms/standards?tenantId=$TID"
Test-Ok "检验标准列表" $stds

# ── APS ───────────────────────────────────────────────────────────────────
Write-Host "`n=== APS 模块 ===" -ForegroundColor Cyan

$res = Invoke-Api POST "/aps/resources?tenantId=$TID" @{code="RES-001";name="数控加工中心";type="MACHINE";status="AVAILABLE";capacity=8;efficiency=0.85}
Test-Ok "资源创建" $res

$ress = Invoke-Api GET "/aps/resources?tenantId=$TID"
Test-Ok "资源列表" $ress

# ── SYS ───────────────────────────────────────────────────────────────────
Write-Host "`n=== SYS 模块 ===" -ForegroundColor Cyan

$users = Invoke-Api GET "/sys/users?tenantId=$TID"
Test-Ok "用户列表" $users

$roles = Invoke-Api GET "/sys/roles/list?tenantId=$TID"
Test-Ok "角色列表" $roles

Write-Host "`n=== 测试完成 ===" -ForegroundColor Cyan
