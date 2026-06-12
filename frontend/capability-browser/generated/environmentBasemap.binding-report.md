# Environment Basemap Binding Report

- Generated at: 2026-06-12T15:37:09.998Z
- Total nodes: 98
- Total edges: 74
- Bound: 92
- Candidate: 0
- Unbound: 0
- Ignored: 6

## Binding Rules
- manual overrides by mxId win first
- exact normalized name match
- alias table match
- parent/container context narrows duplicate candidates
- candidateOnlyLabels prevent uncertain aliases from becoming bound
- no fuzzy matching and no coordinate-only binding

## Bound Nodes

| mxId | label | status | confidence | objectType | objectName | objectId | candidates | context |
|---|---|---|---|---|---|---|---|---|
|AkYI7P9UyD1rbXxni8A_-3|工厂|bound|alias|information_environment|工业控制网络|shadow:information_environment:d24d3f70aacc4002||OT|
|AkYI7P9UyD1rbXxni8A_-4|L3|bound|alias|environment_segment|L3层|shadow:environment_segment:7d7c77f753885da1||工厂 / OT|
|AkYI7P9UyD1rbXxni8A_-5|L2|bound|alias|environment_segment|L2层|shadow:environment_segment:d5f849bcd5faee6a||工厂 / OT|
|AkYI7P9UyD1rbXxni8A_-6|L1|bound|alias|environment_segment|L1层|shadow:environment_segment:babb81e242dac156||工厂 / OT|
|AkYI7P9UyD1rbXxni8A_-8|网络周界|bound|exact|information_environment|网络周界|shadow:information_environment:f63e716ac2e47a80||数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-9|远程办公接入|bound|exact|information_environment|远程办公接入|shadow:information_environment:9486d4eca0610e0b|||
|AkYI7P9UyD1rbXxni8A_-10|运维管理网|bound|alias|information_environment|运维管理网络|shadow:information_environment:eda884e02269d4a7||数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-11|传统数据中心|bound|exact|information_environment|传统数据中心|shadow:information_environment:83dcf14d157e81b7||数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-12|业务应用|bound|parent_context|environment_segment|应用及数据|shadow:environment_segment:d8ae65d579fb5d25||传统数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-13|云数据中心|bound|exact|information_environment|云数据中心|shadow:information_environment:135ca0edbf6c0450||数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-14|工作负载|bound|parent_context|environment_segment|工作负载|shadow:environment_segment:be682cc6f17c76e2||云数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-15|业务应用|bound|parent_context|environment_segment|业务应用|shadow:environment_segment:52296e4c24c5b9d2||云数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-16|大数据平台/数据中台|bound|exact|environment_segment|大数据平台/数据中台|shadow:environment_segment:84df534045c32937||云数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-17|广域网|bound|exact|information_environment|广域网|shadow:information_environment:0bce7fa32411a3e2||IT|
|AkYI7P9UyD1rbXxni8A_-18|园区|bound|alias|information_environment|园区网|shadow:information_environment:2becb9c86368df93||IT|
|AkYI7P9UyD1rbXxni8A_-19|园区网内部网络|bound|exact|information_object|园区网内部网络|shadow:information_object_context:b4cdf0caf60b5ad3||园区 / IT|
|AkYI7P9UyD1rbXxni8A_-21|PC终端|bound|parent_context|environment_segment|PC终端|shadow:environment_segment:742c252119cd1402||园区 / IT|
|AkYI7P9UyD1rbXxni8A_-23|移动终端|bound|parent_context|environment_segment|移动终端|shadow:environment_segment:25cd3cf9d177cd68||园区 / IT|
|AkYI7P9UyD1rbXxni8A_-25|办公人员|bound|parent_context|information_object|办公人员|shadow:information_object_context:c01133731e66d2e8||园区 / IT|
|AkYI7P9UyD1rbXxni8A_-27|PC终端设备|bound|parent_context|information_object|PC终端设备|shadow:information_object_context:27bce3f61ab3d9fe||PC终端 / 园区 / IT|
|AkYI7P9UyD1rbXxni8A_-28|PC终端操作系统|bound|parent_context|information_object|PC终端操作系统|shadow:information_object_context:faadbf9097accc56||PC终端 / 园区 / IT|
|AkYI7P9UyD1rbXxni8A_-29|PC终端软件应用|bound|parent_context|information_object|PC终端软件应用|shadow:information_object_context:96da0a96ce1cdc69||PC终端 / 园区 / IT|
|AkYI7P9UyD1rbXxni8A_-32|移动终端操作系统|bound|parent_context|information_object|移动终端操作系统|shadow:information_object_context:695c3804df9364b3||移动终端 / 园区 / IT|
|AkYI7P9UyD1rbXxni8A_-33|移动终端软件应用|bound|parent_context|information_object|移动终端软件应用|shadow:information_object_context:537ad4c3f163fc86||移动终端 / 园区 / IT|
|AkYI7P9UyD1rbXxni8A_-35|分支机构|bound|exact|information_environment|分支机构|shadow:information_environment:6f1d6c3e35c9fc8d||IT|
|AkYI7P9UyD1rbXxni8A_-37|分支机构内部网络|bound|exact|information_object|分支机构内部网络|shadow:information_object_context:9003bfbf8359ef8b||分支机构 / IT|
|AkYI7P9UyD1rbXxni8A_-38|PC终端|bound|parent_context|environment_segment|PC终端|shadow:environment_segment:bf0aed81eb85ee59||分支机构 / IT|
|AkYI7P9UyD1rbXxni8A_-39|移动终端|bound|parent_context|environment_segment|移动终端|shadow:environment_segment:549d572065dc99ae||分支机构 / IT|
|AkYI7P9UyD1rbXxni8A_-41|办公人员|bound|parent_context|information_object|办公人员|shadow:information_object_context:60ecbfb7ea4af62d||分支机构 / IT|
|AkYI7P9UyD1rbXxni8A_-43|PC终端设备|bound|parent_context|information_object|PC终端设备|shadow:information_object_context:86c7556b86a20b4d||PC终端 / 分支机构 / IT|
|AkYI7P9UyD1rbXxni8A_-44|PC终端操作系统|bound|parent_context|information_object|PC终端操作系统|shadow:information_object_context:445b12c5a33f1269||PC终端 / 分支机构 / IT|
|AkYI7P9UyD1rbXxni8A_-45|PC终端软件应用|bound|parent_context|information_object|PC终端软件应用|shadow:information_object_context:a88d854c83fa2212||PC终端 / 分支机构 / IT|
|AkYI7P9UyD1rbXxni8A_-48|移动终端操作系统|bound|parent_context|information_object|移动终端操作系统|shadow:information_object_context:6b6627aa0646010a||移动终端 / 分支机构 / IT|
|AkYI7P9UyD1rbXxni8A_-49|移动终端软件应用|bound|parent_context|information_object|移动终端软件应用|shadow:information_object_context:4cd8eb8ea67e3eb9||移动终端 / 分支机构 / IT|
|AkYI7P9UyD1rbXxni8A_-55|广域网骨干节点|bound|exact|information_object|广域网骨干节点|shadow:information_object_context:ddbe4a155c057fe4||广域网 / IT|
|AkYI7P9UyD1rbXxni8A_-56|分支机构接入互联网边界|bound|exact|information_object|分支机构接入互联网边界|shadow:information_object_context:4833100b22557f4f||分支机构 / IT|
|AkYI7P9UyD1rbXxni8A_-57|园区网出口边界|bound|exact|information_object|园区网出口边界|shadow:information_object_context:a1dc6455b30c9a2f||IT|
|AkYI7P9UyD1rbXxni8A_-58|分支机构接入广域网边界|bound|exact|information_object|分支机构接入广域网边界|shadow:information_object_context:66b04c4aa557e6a8||分支机构 / IT|
|AkYI7P9UyD1rbXxni8A_-64|互联网出口边界|bound|exact|information_object|互联网出口边界|shadow:information_object_context:844776c9162f2dd0||网络周界 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-65|互联网入口边界|bound|exact|information_object|互联网入口边界|shadow:information_object_context:2937e39db287f261||网络周界 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-66|外联网出口边界|bound|exact|information_object|外联网出口边界|shadow:information_object_context:65642ed125f8d83d||网络周界 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-67|跨网边界|bound|exact|information_object|跨网边界|shadow:information_object_context:9a64531f9c0909c8||网络周界 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-73|云数据中心出口边界|bound|exact|information_object|云数据中心出口边界|shadow:information_object_context:5cdb405ace1d527c||云数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-74|云数据中心内部虚拟网络|bound|exact|information_object|云数据中心内部 虚拟网络|shadow:information_object_context:1614d9543e7454bf||云数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-75|物理主机硬件|bound|parent_context|information_object|物理主机硬件|shadow:information_object_context:f8b265922e4f2692||工作负载 / 云数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-76|物理主机操作系统|bound|parent_context|information_object|物理主机操作系统|shadow:information_object_context:3e7fef51ff56a820||工作负载 / 云数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-77|虚拟主机操作系统|bound|exact|information_object|虚拟主机操作系统|shadow:information_object_context:43381dd3efc03d7d||工作负载 / 云数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-78|容器|bound|exact|information_object|容器|shadow:information_object_context:03e9d0c236fabc91||工作负载 / 云数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-79|应用网关层|bound|exact|information_object|应用网关层|shadow:information_object_context:9d4c538e5835d52c||业务应用 / 云数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-80|用户接口层|bound|exact|information_object|用户接口层|shadow:information_object_context:2ed960f25f14d774||业务应用 / 云数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-81|API网关层|bound|exact|information_object|API网关层|shadow:information_object_context:b0e2109a6fd43812||业务应用 / 云数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-82|应用服务层|bound|exact|information_object|应用服务层|shadow:information_object_context:df7b4628b9ded587||业务应用 / 云数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-83|数据访问层|bound|exact|information_object|数据访问层|shadow:information_object_context:66a6d40e2811157f||业务应用 / 云数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-84|数据存储层|bound|exact|information_object|数据存储层|shadow:information_object_context:e2c40efc35d39fe1||业务应用 / 云数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-85|数据分析层|bound|exact|information_object|数据分析层|shadow:information_object_context:351cb474eefbc1ce||大数据平台/数据中台 / 云数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-86|数据服务层|bound|exact|information_object|数据服务层|shadow:information_object_context:12f515b36ecbec1f||大数据平台/数据中台 / 云数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-87|数据存储计算层|bound|exact|information_object|数据存储计算层|shadow:information_object_context:8b0a48ddb9493eec||大数据平台/数据中台 / 云数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-88|数据接入层|bound|exact|information_object|数据接入层|shadow:information_object_context:21c564fd87332e30||大数据平台/数据中台 / 云数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-97|工作负载|bound|parent_context|environment_segment|工作负载|shadow:environment_segment:fe94187fe804e991||传统数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-98|物理主机硬件|bound|parent_context|information_object|物理主机硬件|shadow:information_object_context:e1316731b608533e||工作负载 / 传统数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-99|物理主机操作系统|bound|parent_context|information_object|物理主机操作系统|shadow:information_object_context:234402e7a966e64b||工作负载 / 传统数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-101|数据中心出口边界|bound|parent_context|information_object|数据中心出口边界|shadow:information_object_context:55d48f9bbbe56734||传统数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-102|数据中心内部网络|bound|exact|information_object|数据中心内部网络|shadow:information_object_context:dfd9cd35189def7a||传统数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-105|应用前端|bound|exact|information_object|应用前端|shadow:information_object_context:d8bdf51387211608||业务应用 / 传统数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-106|应用后端|bound|exact|information_object|应用后端|shadow:information_object_context:656cd64ab09c0a2e||业务应用 / 传统数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-107|数据库|bound|exact|information_object|数据库|shadow:information_object_context:9ebf9e69218001bf||业务应用 / 传统数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-122|数据管理层|bound|exact|information_object|数据管理层|shadow:information_object_context:b1e337da1a9b2701||大数据平台/数据中台 / 云数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-123|PC终端|bound|parent_context|environment_segment|PC终端|shadow:environment_segment:c80e2fd64e9b63d6||运维管理网 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-124|PC终端设备|bound|parent_context|information_object|PC终端设备|shadow:information_object_context:8d3d5d9bdba16854||PC终端 / 运维管理网 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-125|PC终端操作系统|bound|parent_context|information_object|PC终端操作系统|shadow:information_object_context:dc57582cd64573c6||PC终端 / 运维管理网 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-126|PC终端软件应用|bound|parent_context|information_object|PC终端软件应用|shadow:information_object_context:151e42e0ac32ca36||PC终端 / 运维管理网 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-129|运维管理人员|bound|exact|information_object|运维管理人员|shadow:information_object_context:490fb8b7384f5809||运维管理网 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-130|运维管理终端接入边界|bound|exact|information_object|运维管理终端接入边界|shadow:information_object_context:e9ec307e31dc8b9b||运维管理网 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-133|运维管理网络入口边界|bound|exact|information_object|运维管理网络入口边界|shadow:information_object_context:38a8797ed24fc7dc||运维管理网 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-137|运维管理网络内部边界|bound|exact|information_object|运维管理网络内部边界|shadow:information_object_context:96b1e3958f325f89||运维管理网 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-140|PC终端|bound|parent_context|environment_segment|PC终端|shadow:environment_segment:9d3e0d771b3aed35||远程办公接入|
|AkYI7P9UyD1rbXxni8A_-141|PC终端设备|bound|parent_context|information_object|PC终端设备|shadow:information_object_context:a15d7679ea02656a||PC终端 / 远程办公接入|
|AkYI7P9UyD1rbXxni8A_-142|PC终端操作系统|bound|parent_context|information_object|PC终端操作系统|shadow:information_object_context:3cb2ae0671d6b889||PC终端 / 远程办公接入|
|AkYI7P9UyD1rbXxni8A_-143|PC终端软件应用|bound|parent_context|information_object|PC终端软件应用|shadow:information_object_context:a1a60bea92a1f9ad||PC终端 / 远程办公接入|
|AkYI7P9UyD1rbXxni8A_-146|办公人员|bound|parent_context|information_object|办公人员|shadow:information_object_context:8ba92773e3b5c4b4||远程办公接入|
|AkYI7P9UyD1rbXxni8A_-148|客户访问接入|bound|exact|information_environment|客户访问接入|shadow:information_environment:b2aaaf052ed690b4|||
|AkYI7P9UyD1rbXxni8A_-150|移动终端|bound|parent_context|environment_segment|移动终端|shadow:environment_segment:09ad6e9bc66e2ceb||客户访问接入|
|AkYI7P9UyD1rbXxni8A_-151|移动终端软件应用|bound|parent_context|information_object|移动终端软件应用|shadow:information_object_context:8b00dedbc5dc9e0b||移动终端 / 客户访问接入|
|AkYI7P9UyD1rbXxni8A_-154|基础设施管理平台|bound|alias|information_object|基础设施管理平台 （虚拟化管理平台/云管理平台/容器编排平台）|shadow:information_object_context:c3961efc0902c3bd||云数据中心 / 数据中心机房 / IT|
|AkYI7P9UyD1rbXxni8A_-157|L4-L3间网络边界|bound|exact|information_object|L4-L3间网络边界|shadow:information_object_context:b55b5a56a9455253||工厂 / OT|
|AkYI7P9UyD1rbXxni8A_-159|L3内部网络|bound|exact|information_object|L3内部网络|shadow:information_object_context:efc4ff4b706de0d6||L3 / 工厂 / OT|
|AkYI7P9UyD1rbXxni8A_-160|L3主机操作系统|bound|exact|information_object|L3主机操作系统|shadow:information_object_context:c420dad6abf41ba6||L3 / 工厂 / OT|
|AkYI7P9UyD1rbXxni8A_-164|L3-L2间网络边界|bound|exact|information_object|L3-L2间网络边界|shadow:information_object_context:83655c3226d9161a||L2 / 工厂 / OT|
|AkYI7P9UyD1rbXxni8A_-165|L2内部网络|bound|exact|information_object|L2内部网络|shadow:information_object_context:579ba08b09d12193||L2 / 工厂 / OT|
|AkYI7P9UyD1rbXxni8A_-166|L2主机操作系统|bound|alias|information_object|L2层主机操作系统|shadow:information_object_context:943cb0459c6b360f||L2 / 工厂 / OT|
|AkYI7P9UyD1rbXxni8A_-168|L2-L1间网络边界|bound|exact|information_object|L2-L1间网络边界|shadow:information_object_context:f282317920a21f01||L1 / 工厂 / OT|
|AkYI7P9UyD1rbXxni8A_-171|数据共享层|bound|exact|information_object|数据共享层|shadow:information_object_context:705a42ba90bb50a0||大数据平台/数据中台 / 云数据中心 / 数据中心机房 / IT|

## Candidate Nodes - Manual Confirmation Needed

None.

## Unbound Nodes

None.

## Ignored Nodes

| mxId | label | status | confidence | objectType | objectName | objectId | candidates | context |
|---|---|---|---|---|---|---|---|---|
|AkYI7P9UyD1rbXxni8A_-1|OT|ignored|none|environment_segment|||||
|AkYI7P9UyD1rbXxni8A_-2|IT|ignored|none|environment_segment|||||
|AkYI7P9UyD1rbXxni8A_-7|数据中心机房|ignored|none|environment_zone||||IT|
|AkYI7P9UyD1rbXxni8A_-68|互联网|ignored|none|external_network|||||
|AkYI7P9UyD1rbXxni8A_-69|外联网|ignored|none|external_network|||||
|AkYI7P9UyD1rbXxni8A_-152|客户|ignored|none|actor||||客户访问接入|

## Duplicate Bound Object IDs

None.

## Missing Expected Objects

None.
