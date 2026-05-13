(function () {
  const components = (window.sapdComponents = window.sapdComponents || {});
  const utils = components.utils;

  function render({ navigationTree, selectedObjectId, selectedEnvironmentId }) {
    const environments = utils.list(navigationTree);
    if (!environments.length) {
      return '<div class="detail-empty"><strong>暂无环境对象</strong><span>请确认信息化环境维度数据是否已导出。</span></div>';
    }
    return environments
      .map(
        (environment) => `
          <details class="environment-group" open>
            <summary class="environment-group-head">
              <strong>${utils.escapeHtml(environment.title || "未命名环境")}</strong>
              <span>${utils.escapeHtml(environment.segmentCount ?? utils.list(environment.segments).length)} 类 / ${utils.escapeHtml(environment.objectCount ?? utils.list(environment.objects).length)} 对象</span>
            </summary>
            <div class="environment-object-list">
              <button
                class="environment-object-row environment-summary-row ${environment.id === selectedEnvironmentId && !selectedObjectId ? "active" : ""}"
                type="button"
                data-environment-id="${utils.escapeHtml(environment.id)}"
              >
                <strong>查看该环境全部对象</strong>
                <span>按环境子类、对象、作用域、服务、模块/措施汇总</span>
              </button>
              ${utils
                .list(environment.segments)
                .map(
                  (segment) => `
                    <div class="environment-segment-group">
                      <div class="environment-segment-head">
                        <strong>${utils.escapeHtml(segment.title || "未定义环境子类")}</strong>
                        <span>${utils.escapeHtml(segment.objectCount ?? utils.list(segment.objects).length)} 个对象</span>
                      </div>
                      ${utils
                        .list(segment.objects)
                        .map(
                          (object) => `
                            <button
                              class="environment-object-row ${object.id === selectedObjectId ? "active" : ""}"
                              type="button"
                              data-environment-id="${utils.escapeHtml(object.environmentId || environment.id)}"
                              data-environment-object-id="${utils.escapeHtml(object.id)}"
                            >
                              <strong>${utils.escapeHtml(object.title || "未命名对象")}</strong>
                              <span>作用域 ${utils.escapeHtml(object.scopeCount ?? 0)} / 服务 ${utils.escapeHtml(object.serviceCount ?? 0)} / 模块/措施 ${utils.escapeHtml(object.moduleCount ?? 0)}</span>
                            </button>
                          `,
                        )
                        .join("")}
                    </div>
                  `,
                )
                .join("")}
            </div>
          </details>
        `,
      )
      .join("");
  }

  components.EnvironmentTree = { render };
})();
