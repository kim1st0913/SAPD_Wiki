import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function listFiles(dir) {
  return fs
    .readdirSync(path.join(ROOT, dir))
    .filter((name) => name.endsWith(".js"))
    .map((name) => path.join(dir, name));
}

function includesAll(source, values) {
  return values.every((value) => source.includes(value));
}

function countOccurrences(source, value) {
  return source.split(value).length - 1;
}

function lineFindings(relativePath, predicate) {
  return readText(relativePath)
    .split(/\r?\n/)
    .map((line, index) => ({ relativePath, line, lineNumber: index + 1 }))
    .filter(predicate);
}

const appJs = readText("frontend/capability-browser/app.js");
const stylesCss = readText("frontend/capability-browser/styles.css");
const displayLabelsJs = readText("frontend/capability-browser/displayLabels.js");
const userAnnotationDrawerJs = readText("frontend/capability-browser/components/UserAnnotationDrawer.js");
const lifecycleJs = readText("frontend/capability-browser/components/ApplicationSecurityLifecycle.js");
const globalBaseline = readText("docs/06-implementation/frontend-global-design-baseline-2026-05-30.md");
const annotationDesign = readText("docs/06-implementation/workspace-annotation-and-capability-remix-design.md");
const annotationRequirements = readText("docs/06-implementation/global-annotation-requirements-and-regression-matrix.md");

const issues = [];

function renderedAnchorCount(html) {
  return countOccurrences(html, 'data-annotation-value="true"');
}

function createSandbox() {
  const documentStub = {
    addEventListener() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    createElement() {
      return {
        hidden: true,
        style: {},
        setAttribute() {},
        getBoundingClientRect() {
          return { width: 0, height: 0 };
        },
      };
    },
    body: {
      appendChild() {},
    },
  };
  const windowStub = {
    innerWidth: 1440,
    innerHeight: 900,
    addEventListener() {},
    clearTimeout() {},
    setTimeout(callback) {
      if (typeof callback === "function") callback();
      return 0;
    },
    requestAnimationFrame(callback) {
      if (typeof callback === "function") callback();
      return 0;
    },
    scrollTo() {},
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
    },
    sapdComponents: {
      utils: {
        list(value) {
          if (Array.isArray(value)) return value;
          if (value == null || value === "") return [];
          return [value];
        },
        text(value) {
          return value == null ? "" : String(value);
        },
        escapeHtml(value) {
          return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
        },
        titleOf(item, fallback = "/") {
          if (item && typeof item === "object") return item.title || item.name || item.label || item.code || item.description || fallback;
          return item || fallback;
        },
        codeTitleOf(item, fallback = "/") {
          if (!item || typeof item !== "object") return item || fallback;
          const code = item.code || item.id || "";
          const title = item.title || item.name || item.label || "";
          return [code, title].filter(Boolean).join(" ") || fallback;
        },
      },
    },
  };
  windowStub.window = windowStub;
  windowStub.document = documentStub;
  return {
    window: windowStub,
    document: documentStub,
    console,
  };
}

function loadComponent(sandbox, relativePath) {
  vm.runInNewContext(readText(relativePath), sandbox, { filename: relativePath });
}

function renderLifecycleSamples() {
  const sandbox = createSandbox();
  loadComponent(sandbox, "frontend/capability-browser/displayLabels.js");
  loadComponent(sandbox, "frontend/capability-browser/components/ApplicationSecurityLifecycle.js");
  const component = sandbox.window.sapdComponents.ApplicationSecurityLifecycle;
  const devHtml = component.renderRelationTable({
    overview: { mode: "dev" },
    profileRows: [
      {
        stageId: "AP-01",
        stageGoal: "定义安全目标",
        mainActivity: "1）需求分析\n2）安全设计",
        mainActivityReference: "LC-AP 参考来源",
        developmentTypes: "敏捷开发",
        developmentServices: ["需求管理服务"],
        developmentModules: ["威胁建模模块"],
      },
    ],
    rows: [
      {
        stageId: "AP-01",
        securityActivities: "威胁建模",
        policyReference: "安全活动来源",
        policyRequirements: "必须识别安全需求",
        threatScenarios: "权限绕过",
        supplementalPolicies: "补充控制要求",
        technicalServices: [{ code: "SVC-01", title: "身份认证服务", objectKind: "安全技术服务" }],
        technologyModules: [{ code: "MOD-01", title: "认证模块", objectKind: "安全技术模块" }],
      },
    ],
  });
  const dataHtml = component.renderRelationTable({
    overview: { mode: "data" },
    rows: [
      {
        stageId: "DT-01",
        processDefinition: "数据收集与识别",
        scenes: [{ code: "SC-01", title: "数据采集", description: "采集业务系统数据" }],
        technicalServices: [{ code: "SVC-02", title: "数据脱敏服务", objectKind: "安全技术服务" }],
        technologyModules: [{ code: "MOD-02", title: "脱敏模块", objectKind: "安全技术模块" }],
      },
    ],
    policyRows: [
      {
        category: "访问控制",
        sequence: "1",
        policies: [{ level: "I", code: "P-01", text: "重要数据必须授权访问", reference: "策略来源" }],
        technicalServices: [{ code: "SVC-03", title: "访问控制服务", objectKind: "安全技术服务" }],
        technologyModules: [{ code: "MOD-03", title: "授权模块", objectKind: "安全技术模块" }],
      },
    ],
  });
  const referenceHtml = component.renderReferenceSections({
    softwareDevelopmentTypes: [{ title: "瀑布开发" }],
    applicationSystemTypes: [{ title: "核心业务系统", components: [{ title: "交易组件" }] }],
  });
  return { devHtml, dataHtml, referenceHtml };
}

function renderGlobalSamples() {
  const sandbox = createSandbox();
  [
    "frontend/capability-browser/displayLabels.js",
    "frontend/capability-browser/components/FocusScopeServiceMatrix.js",
    "frontend/capability-browser/components/FocusManagementMapping.js",
    "frontend/capability-browser/components/EnvironmentScopeServiceMatrix.js",
    "frontend/capability-browser/components/TechnicalMeasureMaintenanceTable.js",
    "frontend/capability-browser/components/TechnicalServiceMaintenanceTable.js",
    "frontend/capability-browser/components/TechnologyModuleMaintenanceTable.js",
    "frontend/capability-browser/components/LcapReferenceMaintenanceTable.js",
    "frontend/capability-browser/components/MaintenanceDetailPanel.js",
    "frontend/capability-browser/components/DetailInspector.js",
    "frontend/capability-browser/components/StandardFrameworkTable.js",
  ].forEach((relativePath) => loadComponent(sandbox, relativePath));
  const components = sandbox.window.sapdComponents;
  const samples = {
    capabilityTechnical: components.FocusScopeServiceMatrix.render({
      rows: [
        {
          scope: { code: "ALL", title: "全部作用域" },
          services: [{ code: "SVC-01", title: "身份认证服务", objectKind: "安全技术服务" }],
          modules: [{ code: "MOD-01", title: "认证模块", objectKind: "安全技术模块" }],
        },
      ],
    }),
    capabilityManagement: components.FocusManagementMapping.render({
      rows: [
        {
          securityWorks: [{ title: "边界防护策略持续管理" }],
          stakeholders: [{ title: "安全管理职能", layer: "管理层" }],
          processGroups: [{ title: "边界防护策略运营流程组" }],
          processReferences: [{ title: "边界防护策略持续管理流程" }],
          activities: [{ title: "策略复核活动" }],
        },
      ],
    }),
    environment: components.EnvironmentScopeServiceMatrix.render({
      rows: [
        {
          id: "env-row-1",
          segments: [{ code: "SEG-01", title: "园区网络", objectKind: "环境子类" }],
          object: { code: "OBJ-01", title: "办公网络" },
          scope: { code: "ALL", title: "全部作用域" },
          services: [{ code: "SVC-02", title: "访问控制服务", objectKind: "安全技术服务" }],
          modules: [{ code: "MOD-02", title: "访问控制模块", objectKind: "安全技术模块" }],
        },
      ],
      showObjectColumn: true,
      grouped: true,
    }),
    measures: components.TechnicalMeasureMaintenanceTable.render({
      rows: [
        {
          id: "measure-1",
          index: 1,
          measureName: "云自身网络 ACL 及安全组",
          serviceNames: [{ code: "SVC-03", title: "网络准入控制", objectKind: "安全技术服务" }],
          scopeNames: [{ title: "网络" }],
          environmentNames: [{ title: "园区网" }],
          environmentObjectNames: [{ title: "分支机构" }],
        },
      ],
    }),
    services: components.TechnicalServiceMaintenanceTable.render({
      rows: [
        {
          id: "service-1",
          index: 1,
          serviceLabel: "I-US&T-AS.IA-01 用户身份管理",
          ownershipFocuses: ["身份、凭证与访问管理能力 / 实现用户身份管理"],
          linkedModuleMeasures: [{ title: "目录服务", objectKind: "安全技术模块" }],
          linkedSystems: [{ title: "身份管理", objectKind: "安全系统" }],
          linkedEnvironments: [{ title: "园区网", objectKind: "信息化环境" }],
        },
      ],
      search: "用户身份管理",
    }),
    modules: components.TechnologyModuleMaintenanceTable.render({
      rows: [
        {
          id: "module-1",
          title: "统一终端安全运营",
          description: "统一终端安全运营模块",
          linkedServices: [{ code: "SVC-04", title: "终端检测响应服务", objectKind: "安全技术服务" }],
          linkedSystems: [{ title: "桌面安全管理" }],
          scopeMappingStatus: "已映射",
          informationObjectMappingStatus: "已映射",
          informationEnvironmentStatus: "已映射",
        },
      ],
      search: "统一",
    }),
    lcapReference: components.LcapReferenceMaintenanceTable.render({
      softwareRows: [{ id: "soft-1", title: "敏捷开发", description: "短迭代开发模式" }],
      applicationRows: [{ id: "app-1", title: "核心业务系统", description: "核心交易系统", components: [{ title: "交易组件" }] }],
    }),
    detailPanel: components.MaintenanceDetailPanel.render({
      detailPanel: {
        code: "DET-01",
        title: "对象详情",
        description: "对象说明",
        facts: [{ label: "状态", value: "待确认" }],
        sections: [{ title: "关联对象", items: [{ title: "访问控制服务" }] }],
      },
    }),
    detailInspector: components.DetailInspector.render({
      detailInspector: {
        code: "T-AS.AD-01",
        title: "网络安全体系架构管控能力",
        description: "能力说明",
        technicalSummary: { scopeCount: 1, serviceCount: 1, moduleCount: 1 },
        managementSummary: { securityWorkCount: 1, processGroupCount: 1, processReferenceCount: 1, missingActivityCount: 0 },
        services: [{ title: "安全设计服务" }],
        securityWorks: [{ title: "安全设计工作" }],
      },
    }),
    standards: components.StandardFrameworkTable.render({
      activeFrameworkId: "mlps-level-3",
      rows: [
        {
          id: "standard-1",
          values: {
            "保护措施编号": "AT-6",
            "名称": "威胁情报持续管理",
            "关联安全能力/关注点": "T-AS.AD-01",
            "等保要求": "安全建设管理",
            "等保控制项": "安全方案设计",
          },
        },
      ],
      columns: ["保护措施编号", "名称", "关联安全能力/关注点", "等保要求", "等保控制项"],
      focusByCode: {
        "T-AS.AD-01": {
          category: "安全技术能力 T",
          domain: "T-AS 基础架构安全",
          capabilityCode: "T-AS.AD",
          capability: "网络安全体系架构管控能力",
          title: "遵循安全设计原则对网络安全架构进行设计和管控",
        },
      },
      search: "T-AS.AD-01",
    }),
  };
  return Object.fromEntries(Object.entries(samples).map(([key, html]) => [key, renderedAnchorCount(html)]));
}

if (
  !includesAll(appJs, [
    "const ANNOTATION_VALUE_SELECTOR",
    "const ANNOTATION_CELL_VALUE_SELECTOR = \"td\"",
    "const ANNOTATION_TARGET_REF_SELECTOR = \"[data-annotation-target-ref]\"",
    "function annotationCellValueNode",
    "function annotationCellValueText",
    "function annotationTargetFromDataset",
    "function annotationTargetAttrsForHtml",
    "function contentSlideUserTarget",
    "function guideSlideTargetMetaFromNote",
    "function restoreGuideSlideContextFromNote",
    "function hydrateMaintenanceAnnotationTargets",
    "function resolveAnnotationAnchorElement",
    "function expandAnnotationHiddenLineage",
    'data-annotation-slide-stage="true"',
    "findAnnotationAnchorElement(note, { includeHidden: true })",
    '[data-annotation-value="true"]',
    "document.querySelectorAll(ANNOTATION_TARGET_REF_SELECTOR)",
    "document.querySelectorAll(ANNOTATION_VALUE_SELECTOR)",
    "document.querySelectorAll(ANNOTATION_CELL_VALUE_SELECTOR)",
  ])
) {
  issues.push({
    severity: "error",
    type: "global_annotation_anchor_contract_missing",
    message: "批注模块缺少全局值锚点 / 普通表格单元格兜底 / 折叠分组展开定位契约。",
  });
}

if (
  !includesAll(appJs, [
    "contentSlideUserTarget(selected, activeSlide, activeSlideIndex)",
    "contentSlideUserTarget(row, activeSlide, activeIndex)",
    "contentSlideUserTarget(row, slide, index)",
    "restoreGuideSlideContextFromNote(note)",
    "state.selectedContentSlideIndex = slideTarget.slideIndex",
    "data-annotation-target-ref",
    "security_guide_slide",
  ])
) {
  issues.push({
    severity: "error",
    type: "guide_slide_annotation_target_missing",
    message: "幻灯片内容页缺少逐页批注目标，右侧抽屉或右键菜单可能只能绑定整份指南。",
  });
}

if (
  !includesAll(appJs, [
    'state.activeView === "dev-lifecycle"',
    "state.selectedDevProcessId",
    'state.activeView === "data-lifecycle"',
    "state.selectedDataProcessId",
    'view === "dev-lifecycle"',
    'view === "data-lifecycle"',
  ])
) {
  issues.push({
    severity: "error",
    type: "lifecycle_annotation_context_restore_missing",
    message: "LC-AP / LC-DT 批注锚点缺少生命周期阶段 / 过程上下文记录或定位恢复逻辑。",
  });
}

if (
  !includesAll(lifecycleJs, [
    "function annotationValueAttrs",
    'data-annotation-value="true"',
    "data-copy-text",
    "data-annotation-tooltip",
    'class="lifecycle-field-line is-numbered"${annotationValueAttrs(line)}',
    'class="lifecycle-chip-item"${annotationValueAttrs(item.label)}',
    'class="data-scenario-title-cell"${annotationValueAttrs(titleText)}',
    'class="data-scenario-definition"${annotationValueAttrs(scene.description)}',
    'class="data-scenario-title"${annotationValueAttrs([scene.code, scene.title].filter(Boolean).join(" "))}',
    "<p${annotationValueAttrs(scene.description)}",
    "<strong${annotationValueAttrs(policy.code)}",
    "<span${annotationValueAttrs(policy.text)}",
    "<span${annotationValueAttrs(titleOf(system))}",
  ])
) {
  issues.push({
    severity: "error",
    type: "lifecycle_value_anchor_contract_missing",
    message: "LC-AP / LC-DT 页面关键业务值缺少 data-annotation-value / data-copy-text 值级批注锚点。",
  });
}

if (
  !includesAll(displayLabelsJs, [
    "function annotationValueAttrs",
    "function relationChip",
    'data-annotation-value="true"',
    "data-copy-text",
    "data-annotation-tooltip",
    "display.annotationValueAttrs = annotationValueAttrs",
  ])
) {
  issues.push({
    severity: "error",
    type: "shared_relation_chip_annotation_contract_missing",
    message: "共享 relationChip 缺少显式值级批注锚点，后续页面仍可能靠 class 猜测批注值。",
  });
}

const uncheckedRelationChipLines = [
  "frontend/capability-browser/app.js",
  ...listFiles("frontend/capability-browser/components"),
].flatMap((relativePath) =>
  lineFindings(relativePath, ({ line }) => {
    if (!line.includes("relation-chip")) return false;
    if (line.includes("ANNOTATION_VALUE_SELECTOR")) return false;
    if (line.trim().startsWith("\".relation-chip\"")) return false;
    if (line.includes("relation-chip muted")) return false;
    if (line.includes("relation-chip-text")) return false;
    if (line.includes("relationChipList")) return false;
    if (line.includes("annotationAttrs")) return false;
    if (line.includes("annotationValueAttrs")) return false;
    if (line.includes("annotationValueAttrsForHtml")) return false;
    if (line.includes('data-annotation-value="true"')) return false;
    return true;
  }),
);
if (uncheckedRelationChipLines.length) {
  issues.push({
    severity: "error",
    type: "manual_relation_chip_without_annotation_anchor",
    message: "仍存在手写 relation-chip 未接入值级批注锚点。",
    locations: uncheckedRelationChipLines.map(({ relativePath, lineNumber }) => `${relativePath}:${lineNumber}`),
  });
}

const renderedSamples = renderLifecycleSamples();
const lifecycleAnchorCounts = {
  dev: renderedAnchorCount(renderedSamples.devHtml),
  data: renderedAnchorCount(renderedSamples.dataHtml),
  reference: renderedAnchorCount(renderedSamples.referenceHtml),
};
if (lifecycleAnchorCounts.dev < 8 || lifecycleAnchorCounts.data < 8 || lifecycleAnchorCounts.reference < 3) {
  issues.push({
    severity: "error",
    type: "lifecycle_rendered_value_anchors_missing",
    message: `LC-AP / LC-DT 渲染样例值锚点数量不足：${JSON.stringify(lifecycleAnchorCounts)}`,
  });
}

const globalAnchorCounts = renderGlobalSamples();
const minimums = {
  capabilityTechnical: 2,
  capabilityManagement: 4,
  environment: 3,
  measures: 4,
  services: 4,
  modules: 1,
  lcapReference: 1,
  detailPanel: 2,
  detailInspector: 4,
  standards: 1,
};
const missingGlobalSamples = Object.entries(minimums).filter(([key, minimum]) => (globalAnchorCounts[key] || 0) < minimum);
if (missingGlobalSamples.length) {
  issues.push({
    severity: "error",
    type: "global_rendered_value_anchors_missing",
    message: `全局批注渲染样例值锚点数量不足：${JSON.stringify(globalAnchorCounts)}`,
    samples: missingGlobalSamples.map(([key, minimum]) => ({ key, minimum, actual: globalAnchorCounts[key] || 0 })),
  });
}

if (
  !includesAll(globalBaseline, [
    "全局批注契约",
    "global-annotation-requirements-and-regression-matrix.md",
    "知识库字典",
    "安全标准 / 框架",
    "安全指南",
    "普通表格单元格",
    "折叠目录",
    "文字级批注墨水",
    "值 / 字段",
    "只高亮具体值本身",
    "基线",
    "新页面接入清单",
  ])
) {
  issues.push({
    severity: "error",
    type: "annotation_global_baseline_missing",
    message: "全局前端基线缺少跨页面批注契约、普通单元格兜底、折叠目录定位和视觉范围规则。",
  });
}

if (
  !includesAll(annotationDesign, [
    "global-annotation-requirements-and-regression-matrix.md",
    "多粒度锚点",
    "字段 / 值",
    "知识库字典",
    "标准 / 框架",
    "折叠目录",
    "点击批注项时",
    "缺少上下文锚点",
  ])
) {
  issues.push({
    severity: "error",
    type: "annotation_product_contract_missing",
    message: "批注工作台设计文档缺少跨页面多粒度锚点和上下文恢复规则。",
  });
}

if (
  !includesAll(annotationRequirements, [
    "全局批注需求与回归矩阵",
    "保存后常驻提示",
    "点击定位临时提示",
    "抽屉遮挡处理",
    "全局设计基线已固化",
    "33/33 pass",
    "新页面接入清单",
    "页面对象声明",
    "锚点声明",
    "视觉接入",
    "回归准入",
    "数量徽标",
    "平滑预展开",
    "半胶囊",
    "侧耳",
    "不能露出批注抽屉面板",
    "融合",
    "低噪声边缘控件",
    "批注 1",
    "P0 页面",
    "/capability-mapping",
    "/environment-mapping",
    "/development-security",
    "/data-security",
    "/knowledge/technical-services",
    "/knowledge/technical-measures",
    "/standards/nist-csf-2",
    "/standards/mlps-level-3",
    "/guides/security-architecture-design",
    "真实交互契约",
    "不合格样式",
  ])
) {
  issues.push({
    severity: "error",
    type: "annotation_requirements_matrix_missing",
    message: "全局批注需求文档缺少 P0 页面矩阵、常驻态 / 定位态、遮挡处理或真实交互验收条款。",
  });
}

if (
  !includesAll(stylesCss, [
    '[data-user-note-anchor-marked="true"]',
    '[data-user-note-anchor-active="true"]',
    '[data-user-note-anchor-row-marked="true"]',
    '[data-user-note-anchor-row-active="true"]',
    '[data-user-note-anchor-cell-marked="true"]',
    '[data-user-note-anchor-cell-active="true"]',
    'tr[data-user-note-anchor-marked="true"] > td',
    'tr[data-user-note-anchor-active="true"] > td',
    '[data-maintenance-id][data-user-note-anchor-marked="true"] > td',
    "annotationGlowSweep",
    "annotationSoftPulse",
    "annotation-tooltip",
    "--annotation-tab-peek",
    "--annotation-tab-hover",
    "--annotation-tab-preview",
    "annotation-tab-count",
    "annotation-tab-label",
    "is-closing",
  ])
) {
  issues.push({
    severity: "error",
    type: "annotation_visual_state_contract_missing",
    message: "批注样式缺少保存后常驻态、点击定位临时态、行 / 单元格范围或自定义悬停气泡样式。",
  });
}

if (
  !includesAll(userAnnotationDrawerJs, [
    "annotation-tab-count",
    "annotation-tab-label",
    "当前页 ${currentPageCount} 条批注",
    "tabAriaLabel",
  ]) ||
  userAnnotationDrawerJs.includes("`批注 ${currentPageCount}`")
) {
  issues.push({
    severity: "error",
    type: "annotation_drawer_tab_contract_missing",
    message: "批注抽屉标签必须使用独立数量徽标和批注标签，不得恢复为 `批注 N` 拼接文案。",
  });
}

const result = {
  result: issues.some((issue) => issue.severity === "error") ? "fail" : "pass",
  checked: {
    globalAnchorContract: true,
    sharedRelationChipValueAnchors: true,
    lifecycleValueAnchors: true,
    lifecycleRenderedValueAnchors: lifecycleAnchorCounts,
    globalRenderedValueAnchors: globalAnchorCounts,
    manualRelationChipScan: true,
    collapsedGroupLocationContract: true,
    visualScopeBaseline: true,
    requirementsMatrix: true,
    productContract: true,
  },
  issues,
};

console.log(JSON.stringify(result, null, 2));
process.exitCode = result.result === "pass" ? 0 : 1;
