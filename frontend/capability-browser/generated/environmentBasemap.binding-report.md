# Environment Basemap Binding Report

- Generated at: 2026-06-08T09:55:05.267Z
- Total nodes: 97
- Total edges: 73
- Bound: 91
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
|7M0SGe99AU4GMtvV9rx2-230|工厂|bound|alias|information_environment|工业控制网络|fe375438-1741-48b3-bf97-20ee88f9d3e6||OT|
|7M0SGe99AU4GMtvV9rx2-248|L3|bound|alias|environment_segment|L3层|dc7a8266-199e-4c45-95f3-599a8bde854a||工厂 / OT|
|7M0SGe99AU4GMtvV9rx2-249|L2|bound|alias|environment_segment|L2层|3764dfbf-7094-4973-8ca9-c5bad2c9c688||工厂 / OT|
|7M0SGe99AU4GMtvV9rx2-250|L1|bound|alias|environment_segment|L1层|2326e423-059d-4cb0-8fcb-82c877a2792c||工厂 / OT|
|7M0SGe99AU4GMtvV9rx2-247|网络周界|bound|exact|information_environment|网络周界|f0ddae58-b900-4eb5-854f-4c3b36513d61||数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-200|远程办公接入|bound|exact|information_environment|远程办公接入|f987426d-4abd-4f5e-956f-3b6d093206f1|||
|7M0SGe99AU4GMtvV9rx2-181|运维管理网|bound|alias|information_environment|运维管理网络|8ac6c076-8aa3-402e-abd4-bdf116869b3f||数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-123|传统数据中心|bound|exact|information_environment|传统数据中心|df92a491-8fca-4a28-9999-3715cfcdb6fd||数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-143|业务应用|bound|parent_context|environment_segment|应用及数据|6ef9a567-b895-41c5-9d02-5f1a599f4ee4||传统数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-78|云数据中心|bound|exact|information_environment|云数据中心|bfc540c6-7ca8-4142-a682-0bc7de04b6c5||数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-112|工作负载|bound|parent_context|environment_segment|工作负载|111bd108-95a8-428b-a456-bc766e4d5e4b||云数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-111|业务应用|bound|parent_context|environment_segment|业务应用|ccca2519-375b-4ebd-8734-a1bef4a68cd5||云数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-110|大数据平台/数据中台|bound|exact|environment_segment|大数据平台/数据中台|7c4dcdcd-5c96-4f94-a3c5-c902182a684f||云数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-45|广域网|bound|exact|information_environment|广域网|29017e8d-ccc5-4dd2-8713-29b23e4d26f8||IT|
|7M0SGe99AU4GMtvV9rx2-13|园区|bound|alias|information_environment|园区网|2478232e-3c33-4b4f-9313-5d1aa10feb99||IT|
|xDkBI2kzSbe3P-stVFY9-32|园区内部网络|bound|alias|information_object|园区网内部网络|f471b170-312f-4774-85d6-c59efc05275f||园区 / IT|
|xDkBI2kzSbe3P-stVFY9-34|PC终端|bound|parent_context|environment_segment|PC终端|880c0aa8-7e15-4105-9463-0b20b0841ceb||园区 / IT|
|xDkBI2kzSbe3P-stVFY9-36|移动终端|bound|parent_context|environment_segment|移动终端|1f9a6750-f44a-48bc-aa86-5ee63317fd35||园区 / IT|
|xDkBI2kzSbe3P-stVFY9-38|办公人员|bound|exact|information_object|办公人员|98ba8ea8-5a5f-45d1-a16c-6d6e47ddf016||园区 / IT|
|7M0SGe99AU4GMtvV9rx2-2|PC终端设备|bound|alias|information_object|终端设备|f2b74758-d248-4128-af40-92eb9fa9fd19||PC终端 / 园区 / IT|
|7M0SGe99AU4GMtvV9rx2-3|PC终端操作系统|bound|alias|information_object|终端操作系统|c7cc41d2-ed8b-42b2-9b44-3f0c651b9fde||PC终端 / 园区 / IT|
|7M0SGe99AU4GMtvV9rx2-4|PC终端软件应用|bound|alias|information_object|终端软件应用|1737b4cf-c277-403d-b84b-b64841217332||PC终端 / 园区 / IT|
|7M0SGe99AU4GMtvV9rx2-8|移动终端操作系统|bound|alias|information_object|终端操作系统|c7cc41d2-ed8b-42b2-9b44-3f0c651b9fde||移动终端 / 园区 / IT|
|7M0SGe99AU4GMtvV9rx2-9|移动终端软件应用|bound|alias|information_object|终端软件应用|1737b4cf-c277-403d-b84b-b64841217332||移动终端 / 园区 / IT|
|7M0SGe99AU4GMtvV9rx2-15|分支机构|bound|exact|information_environment|分支机构|cdcc72a6-5f8d-46f9-844e-1400eafcd734||IT|
|7M0SGe99AU4GMtvV9rx2-16|分支机构内部网络|bound|exact|information_object|分支机构内部网络|0a1aafd8-cc07-4334-a004-379d4a627b02||分支机构 / IT|
|7M0SGe99AU4GMtvV9rx2-18|PC终端|bound|parent_context|environment_segment|PC终端|8f714983-4d03-41ca-a5f5-2ad0d526f6e8||分支机构 / IT|
|7M0SGe99AU4GMtvV9rx2-20|移动终端|bound|parent_context|environment_segment|移动终端|44d5795f-a453-4b3f-ba94-384ce6be62f9||分支机构 / IT|
|7M0SGe99AU4GMtvV9rx2-22|办公人员|bound|exact|information_object|办公人员|98ba8ea8-5a5f-45d1-a16c-6d6e47ddf016||分支机构 / IT|
|7M0SGe99AU4GMtvV9rx2-24|PC终端设备|bound|alias|information_object|终端设备|f2b74758-d248-4128-af40-92eb9fa9fd19||PC终端 / 分支机构 / IT|
|7M0SGe99AU4GMtvV9rx2-25|PC终端操作系统|bound|alias|information_object|终端操作系统|c7cc41d2-ed8b-42b2-9b44-3f0c651b9fde||PC终端 / 分支机构 / IT|
|7M0SGe99AU4GMtvV9rx2-26|PC终端软件应用|bound|alias|information_object|终端软件应用|1737b4cf-c277-403d-b84b-b64841217332||PC终端 / 分支机构 / IT|
|7M0SGe99AU4GMtvV9rx2-29|移动终端操作系统|bound|alias|information_object|终端操作系统|c7cc41d2-ed8b-42b2-9b44-3f0c651b9fde||移动终端 / 分支机构 / IT|
|7M0SGe99AU4GMtvV9rx2-30|移动终端软件应用|bound|alias|information_object|终端软件应用|1737b4cf-c277-403d-b84b-b64841217332||移动终端 / 分支机构 / IT|
|7M0SGe99AU4GMtvV9rx2-40|广域网骨干节点|bound|exact|information_object|广域网骨干节点|3e3438e3-2f4d-4ca0-bfda-7e087dc6c721||广域网 / IT|
|7M0SGe99AU4GMtvV9rx2-41|分支机构接入互联网边界|bound|exact|information_object|分支机构接入互联网边界|60c695da-672e-472b-946c-cd443e505889||分支机构 / IT|
|7M0SGe99AU4GMtvV9rx2-42|园区出口边界|bound|alias|information_object|园区网出口边界|663bb076-7ffb-4550-b196-a1276606f7c8||IT|
|7M0SGe99AU4GMtvV9rx2-43|分支机构接入广域网边界|bound|exact|information_object|分支机构接入广域网边界|b7dfe9bf-4cc4-4e21-bbcf-69f0c8ec00de||分支机构 / IT|
|7M0SGe99AU4GMtvV9rx2-51|互联网出口边界|bound|exact|information_object|互联网出口边界|4594abef-d89f-4dd0-92d0-98e76fc32657||网络周界 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-52|互联网入口边界|bound|exact|information_object|互联网入口边界|964be62e-7910-49cf-8734-f6951448d486||网络周界 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-53|外联网边界|bound|exact|environment_segment|外联网边界|88224b67-fcb1-4736-8e64-cdcfdb0f8212||网络周界 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-54|跨网边界|bound|exact|information_object|跨网边界|08fa0753-502a-47d6-97b6-e3e856f93e6e||网络周界 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-79|数据中心出口边界|bound|parent_context|information_object|云数据中心出口边界|2e9a8fb2-5a18-4e27-a27e-4054736f608f||云数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-80|数据中心内部虚拟网络|bound|alias|information_object|云数据中心内部 虚拟网络|ba95f9f8-e221-454d-ba68-2c775898a052||云数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-94|物理主机硬件|bound|exact|information_object|物理主机硬件|81f11ade-72b4-40d7-abb0-79697d3ccfc9||工作负载 / 云数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-95|物理主机操作系统|bound|exact|information_object|物理主机操作系统|edaa109e-9606-4b84-902b-33587c28d141||工作负载 / 云数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-96|虚拟主机操作系统|bound|exact|information_object|虚拟主机操作系统|001f4f7b-aa19-4553-ac84-84742a835e0c||工作负载 / 云数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-97|容器|bound|exact|information_object|容器|abfbb2bd-232f-484f-a3e9-5e34a0cc2e24||工作负载 / 云数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-98|应用网关层|bound|exact|information_object|应用网关层|5c53cd9d-9cea-4943-999a-d788831dac55||业务应用 / 云数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-99|用户接口层|bound|exact|information_object|用户接口层|770c70d5-d1d6-4fe1-93e5-951180a4a38a||业务应用 / 云数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-100|API网关层|bound|exact|information_object|API网关层|9f77f642-d2a3-4143-8375-33925004d660||业务应用 / 云数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-101|应用服务层|bound|exact|information_object|应用服务层|1713589f-0f0d-4b35-a1f8-c797c62ce864||业务应用 / 云数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-102|数据访问层|bound|exact|information_object|数据访问层|13e9bd79-ea86-4c11-8c16-6d9824271e56||业务应用 / 云数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-103|数据存储层|bound|exact|information_object|数据存储层|93eda1df-097b-4942-a593-f3318aa5f99d||业务应用 / 云数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-104|数据分析层|bound|exact|information_object|数据分析层|369a19ef-9ba5-45a4-ad26-65805bea78c9||大数据平台/数据中台 / 云数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-105|数据服务层|bound|exact|information_object|数据服务层|fd27a1f4-13d8-4bbc-95f1-475ff997a619||大数据平台/数据中台 / 云数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-106|数据存储计算层|bound|exact|information_object|数据存储计算层|6ef4e338-9b73-42b3-b834-27279633f968||大数据平台/数据中台 / 云数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-107|数据接入层|bound|exact|information_object|数据接入层|69142559-93cb-4b4a-aa84-b1057a472968||大数据平台/数据中台 / 云数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-126|工作负载|bound|parent_context|environment_segment|工作负载|af7800f8-9557-469d-a7e9-a9a36a4d468b||传统数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-127|物理主机硬件|bound|exact|information_object|物理主机硬件|81f11ade-72b4-40d7-abb0-79697d3ccfc9||工作负载 / 传统数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-128|物理主机操作系统|bound|exact|information_object|物理主机操作系统|edaa109e-9606-4b84-902b-33587c28d141||工作负载 / 传统数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-138|数据中心出口边界|bound|parent_context|information_object|数据中心出口边界|bbe7c2cc-0cfb-42a5-a2a3-ff41c883c45e||传统数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-139|数据中心内部网络|bound|exact|information_object|数据中心内部网络|7e1da6c4-9dd5-4171-91cd-525a93963238||传统数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-145|应用前端|bound|exact|information_object|应用前端|bd46fece-0f23-48bb-812b-88e8a92b5ff5||业务应用 / 传统数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-146|应用后端|bound|exact|information_object|应用后端|9d3b67f5-e5ea-42bd-866d-77c39b8f57fd||业务应用 / 传统数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-147|数据库|bound|exact|information_object|数据库|da718f1a-1a94-4063-bfb5-4a1b65222d22||业务应用 / 传统数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-168|数据管理层|bound|exact|information_object|数据管理层|2603e4f4-ac94-4bf7-8d88-07256ee0ad3d||大数据平台/数据中台 / 云数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-169|运维管理终端|bound|parent_context|environment_segment|PC终端|b51a0761-f906-472e-908c-c0dc99af057d||运维管理网 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-170|PC终端设备|bound|alias|information_object|终端设备|f2b74758-d248-4128-af40-92eb9fa9fd19||运维管理终端 / 运维管理网 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-171|PC终端操作系统|bound|alias|information_object|终端操作系统|c7cc41d2-ed8b-42b2-9b44-3f0c651b9fde||运维管理终端 / 运维管理网 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-172|PC终端软件应用|bound|alias|information_object|终端软件应用|1737b4cf-c277-403d-b84b-b64841217332||运维管理终端 / 运维管理网 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-175|运维管理人员|bound|exact|information_object|运维管理人员|c23fd75b-62dd-4a0f-b8c8-25e4c9966005||运维管理网 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-176|运维管理网络接入边界|bound|alias|information_object|运维管理终端接入边界|aefb23d0-1142-4739-b3fd-61e968175413||运维管理网 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-177|运维管理网络入口边界|bound|exact|information_object|运维管理网络入口边界|5a634e62-a21d-496e-93a7-58e24e4d1f64||运维管理网 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-188|运维管理网络内部边界|bound|exact|information_object|运维管理网络内部边界|99595e23-cc76-465f-9cfe-605163560c30||运维管理网 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-191|PC终端|bound|parent_context|environment_segment|PC终端|3d35d396-ed33-4354-aa5a-6e2ea293efaa||远程办公接入|
|7M0SGe99AU4GMtvV9rx2-192|PC终端设备|bound|alias|information_object|终端设备|f2b74758-d248-4128-af40-92eb9fa9fd19||PC终端 / 远程办公接入|
|7M0SGe99AU4GMtvV9rx2-193|PC终端操作系统|bound|alias|information_object|终端操作系统|c7cc41d2-ed8b-42b2-9b44-3f0c651b9fde||PC终端 / 远程办公接入|
|7M0SGe99AU4GMtvV9rx2-194|PC终端软件应用|bound|alias|information_object|终端软件应用|1737b4cf-c277-403d-b84b-b64841217332||PC终端 / 远程办公接入|
|7M0SGe99AU4GMtvV9rx2-197|办公人员|bound|exact|information_object|办公人员|98ba8ea8-5a5f-45d1-a16c-6d6e47ddf016||远程办公接入|
|7M0SGe99AU4GMtvV9rx2-201|客户访问接入|bound|exact|information_environment|客户访问接入|fd8f2e00-00e2-4edc-aaf1-a458a958dc67|||
|7M0SGe99AU4GMtvV9rx2-202|移动终端|bound|parent_context|environment_segment|移动终端|0c0b1337-7839-4475-abee-cbbdc40556c1||客户访问接入|
|7M0SGe99AU4GMtvV9rx2-205|移动应用|bound|exact|information_object|移动应用|cbd0a14b-9c3d-4779-adea-7fa3a22d0a37||移动终端 / 客户访问接入|
|7M0SGe99AU4GMtvV9rx2-215|基础设施管理平台|bound|alias|information_object|基础设施管理平台 （虚拟化管理平台/云管理平台/容器编排平台）|ce391bdb-6e54-443a-948e-b59affafb951||云数据中心 / 数据中心机房 / IT|
|7M0SGe99AU4GMtvV9rx2-231|L4-L3间网络边界|bound|exact|information_object|L4-L3间网络边界|4292a70e-c0ee-44ba-b584-3d162a7d684f||工厂 / OT|
|7M0SGe99AU4GMtvV9rx2-232|L3内部网络|bound|exact|information_object|L3内部网络|f56e4867-13b1-4c6e-8a5e-476ea468b3bb||L3 / 工厂 / OT|
|7M0SGe99AU4GMtvV9rx2-233|L3主机操作系统|bound|exact|information_object|L3主机操作系统|6192be7d-c430-4d03-8584-50189a23a50a||L3 / 工厂 / OT|
|7M0SGe99AU4GMtvV9rx2-239|L3-L2间网络边界|bound|exact|information_object|L3-L2间网络边界|f11790bc-cdea-457e-8288-5e891fea9b5c||L2 / 工厂 / OT|
|7M0SGe99AU4GMtvV9rx2-240|L2内部网络|bound|exact|information_object|L2内部网络|d234457f-58fc-4991-a7e4-f1189bc4db4f||L2 / 工厂 / OT|
|7M0SGe99AU4GMtvV9rx2-241|L2主机操作系统|bound|alias|information_object|L2层主机操作系统|07c590e5-b558-46e3-b6e4-9b373ff4edcb||L2 / 工厂 / OT|
|7M0SGe99AU4GMtvV9rx2-243|L2-L1间网络边界|bound|exact|information_object|L2-L1间网络边界|fff3cdfb-d8ed-4bac-8ea2-88b92e6701fd||L1 / 工厂 / OT|

## Candidate Nodes - Manual Confirmation Needed

None.

## Unbound Nodes

None.

## Ignored Nodes

| mxId | label | status | confidence | objectType | objectName | objectId | candidates | context |
|---|---|---|---|---|---|---|---|---|
|7M0SGe99AU4GMtvV9rx2-252|OT|ignored|none|environment_segment|||||
|7M0SGe99AU4GMtvV9rx2-251|IT|ignored|none|environment_segment|||||
|7M0SGe99AU4GMtvV9rx2-216|数据中心机房|ignored|none|environment_zone||||IT|
|7M0SGe99AU4GMtvV9rx2-56|互联网|ignored|none|external_network|||||
|7M0SGe99AU4GMtvV9rx2-57|外联网|ignored|none|external_network|||||
|7M0SGe99AU4GMtvV9rx2-208|客户|ignored|none|actor||||客户访问接入|

## Duplicate Bound Object IDs

| objectId | objectName | count | allowed | reason | labels |
|---|---|---:|---|---|---|
|98ba8ea8-5a5f-45d1-a16c-6d6e47ddf016|办公人员|3|yes|same catalog object reused across environment contexts|办公人员|
|f2b74758-d248-4128-af40-92eb9fa9fd19|终端设备|4|yes|same catalog object reused across environment contexts|PC终端设备|
|c7cc41d2-ed8b-42b2-9b44-3f0c651b9fde|终端操作系统|6|yes|same catalog object reused across environment contexts|PC终端操作系统, 移动终端操作系统|
|1737b4cf-c277-403d-b84b-b64841217332|终端软件应用|6|yes|same catalog object reused across environment contexts|PC终端软件应用, 移动终端软件应用|
|81f11ade-72b4-40d7-abb0-79697d3ccfc9|物理主机硬件|2|yes|same catalog object reused across environment contexts|物理主机硬件|
|edaa109e-9606-4b84-902b-33587c28d141|物理主机操作系统|2|yes|same catalog object reused across environment contexts|物理主机操作系统|

## Missing Expected Objects

None.
