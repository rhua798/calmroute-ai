import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "产品案例研究 | 安心领航",
  description: "CalmRoute AI 从出行不确定性到主动式 AI 导航体验的完整产品推导过程。",
  openGraph: {
    title: "产品案例研究 | 安心领航",
    description: "从出行不确定性到主动式 AI 导航体验的完整产品推导过程。",
    images: [],
  },
  twitter: {
    title: "产品案例研究 | 安心领航",
    description: "从出行不确定性到主动式 AI 导航体验的完整产品推导过程。",
    images: [],
  },
};

const journey = [
  ["行前", "说清需求", "多目的地、时间与偏好需要在多个应用间反复确认", "用自然语言统一表达出行约束"],
  ["接人", "维持节奏", "上车点、停车位和等待时间会同时影响后续行程", "自动重算时间窗口与后续服务"],
  ["补能", "不被排队打乱", "到站才发现充电排队，改站又担心绕路和电量", "在风险影响行程前提供可解释的备选方案"],
  ["到达", "确认最后一公里", "停车、入口和入住信息分散，容易在陌生环境中手忙脚乱", "在到达前聚合停车与目的地服务"],
];

const screenRules = [
  ["AR-HUD", "立即执行", "当前车道、转向动作、高紧迫风险", "最多 1 个主动作"],
  ["仪表", "维持预期", "下一步、剩余距离、电量与抵达时间", "不承载复杂选择"],
  ["中控", "全局决策", "行程编辑、方案对比、推荐理由与服务", "驾驶中减少多步操作"],
  ["语音", "免手确认", "高紧迫提醒、方案摘要与简单确认", "默认一句话说清结论"],
];

export default function CaseStudy() {
  return (
    <main className="case-page">
      <header className="case-nav">
        <a className="brand" href="/"><i>A</i><b>安心领航</b><small>CASE STUDY</small></a>
        <div><a href="#process">产品推导</a><a href="#system">方案系统</a><a href="#validation">验证结果</a></div>
        <a className="back-home" href="/">返回原型 ↗</a>
      </header>

      <section className="case-hero">
        <p className="case-kicker"><span>PRODUCT CASE 01</span> · 智能座舱 / AI 出行</p>
        <h1>从“路线导航”，<br/>到<span>“主动决策”</span>。</h1>
        <div className="case-intro">
          <p>安心领航试图解决的不是“如何算出一条路”，而是用户在多目的地、补能、停车和临时变化中，如何持续获得确定性。</p>
          <aside><b>项目状态</b><span>概念验证 / PRD v1.0</span><b>个人职责</b><span>产品定义、交互策略、数据框架</span><b>核心场景</b><span>上海 → 莫干山自驾</span></aside>
        </div>
      </section>

      <section className="case-section problem-section" id="process">
        <SectionLabel number="01" text="问题定义" />
        <div className="case-two-col">
          <h2 className="fixed-two-line"><span className="heading-line plain">用户缺的不是更多信息，</span><span className="heading-line accent">而是对下一步的把握。</span></h2>
          <div><p>传统导航以路线为中心，但一次真实出行还受到时间窗口、剩余电量、排队、停车和同行者需求影响。这些变量分散在不同服务中，最终仍需要驾驶者自己拼凑决策。</p><p>产品机会是：让 AI 管理约束和变化，让用户只需要理解当下最重要的一步。</p></div>
        </div>
        <div className="hypothesis-grid">
          <Hypothesis n="H1" title="不确定比绕路更令人焦虑" text="用户愿意多行驶少量里程，换取更可信的时间与补能结果。" />
          <Hypothesis n="H2" title="推荐理由决定接受意愿" text="只告诉用户“已重规划”不足以建立信任，需要说清关键权衡。" />
          <Hypothesis n="H3" title="主动服务需要克制" text="只有当风险达到阈值时才打断，否则主动会变成干扰。" />
        </div>
        <p className="evidence-note"><b>证据边界：</b>以上为待验证产品假设，并非已完成用户访谈后的研究结论。</p>
      </section>

      <section className="case-section journey-section">
        <SectionLabel number="02" text="场景旅程" />
        <div className="section-title-row"><h2>一次自驾，是一条持续变化的任务链。</h2><p>以“上海出发、接人、补能、用餐、抵达莫干山”为主线，观察每一阶段的决策负担。</p></div>
        <div className="journey-table">
          <div className="journey-head"><span>阶段</span><span>用户目标</span><span>主要阻力</span><span>产品机会</span></div>
          {journey.map(row => <div className="journey-row" key={row[0]}>{row.map((cell,i) => <div key={cell}>{i === 0 ? <b>{cell}</b> : cell}</div>)}</div>)}
        </div>
      </section>

      <section className="case-section system-section" id="system">
        <SectionLabel number="03" text="系统方案" />
        <div className="section-title-row"><h2 className="fixed-two-line"><span className="heading-line plain">AI 不直接“猜”路线，</span><span className="heading-line accent">而是编排可验证的能力。</span></h2><p>大模型负责理解需求、拆解任务与生成解释；地图、电量与服务数据负责给出真实结果；规则层负责安全和约束检查。</p></div>
        <div className="architecture">
          <div><small>01 / INPUT</small><b>用户目标与约束</b><span>地点、时间、偏好、电量</span></div><i>→</i>
          <div><small>02 / ORCHESTRATE</small><b>Agent 任务编排</b><span>搜索、算路、充电、停车</span></div><i>→</i>
          <div><small>03 / GUARDRAIL</small><b>约束与风险检查</b><span>安全、时间、电量、可用性</span></div><i>→</i>
          <div><small>04 / EXPERIENCE</small><b>可解释的下一步</b><span>结论、影响、理由、确认</span></div>
        </div>
        <div className="decision-rule"><div><span>打断条件</span><b>影响 × 紧迫性 × 可恢复性</b></div><p>当前方风险将显著影响抵达时间、剩余电量或安全时，系统才主动发起建议。每条建议必须同时提供方案变化和推荐理由。</p></div>
      </section>

      <section className="case-section screen-strategy">
        <SectionLabel number="04" text="跨屏策略" />
        <div className="section-title-row"><h2 className="fixed-two-line"><span className="heading-line plain">同一条信息，</span><span className="heading-line plain">不应在所有屏幕上重复。</span></h2><p>根据信息的紧迫性、复杂度和操作成本，为 AR-HUD、仪表、中控与语音分配不同职责。</p></div>
        <div className="screen-rule-grid">{screenRules.map((row,i) => <article key={row[0]}><small>0{i+1}</small><h3>{row[0]}</h3><b>{row[1]}</b><p>{row[2]}</p><span>{row[3]}</span></article>)}</div>
      </section>

      <section className="case-section validation-section" id="validation">
        <SectionLabel number="05" text="工程验证" />
        <div className="section-title-row"><h2>先验证系统能否工作，<br/><span>再讨论体验是否更好。</span></h2><p>在无法开展用户访谈的条件下，先用可复现的路线矩阵验证真实算路、服务地点搜索和异常重算；工程结果不冒充用户体验结论。</p></div>
        <div className="validation-grid">
          <article><small>TEST 01</small><h3>多城市路线矩阵</h3><p>10 条公开地点路线覆盖沪、苏、浙、皖；使用带城市与区县的地址降低地理编码歧义。</p></article>
          <article><small>TEST 02</small><h3>服务能力联调</h3><p>每条路线检查充电站与目的地停车场 POI 是否返回，不推断实时空闲、价格或排队。</p></article>
          <article><small>TEST 03</small><h3>异常恢复验证</h3><p>选取真实备选 POI 作为途经点二次算路，记录距离、时间、响应延迟与失败原因。</p></article>
        </div>
        <div className="success-metrics"><span><b>20 次</b>两轮路线执行</span><span><b>85%</b>真实算路链路成功率</span><span><b>85%</b>双类 POI 返回率</span><span><b>85%</b>途经点重算成功率</span></div>
        <p className="evidence-note"><b>已知限制：</b>两轮单次成功率分别为 90% 与 80%，暴露第三方超时和地图引擎错误的波动；宁波场景虽返回成功但距离异常，因此新增解析地址确认步骤。当前已加入相同在途请求合并、地图调用排队、一次退避重试与前端安全回退；地址不做持久化缓存。稳定性修复尚待下一轮完整路线矩阵复测，工程测试也不衡量理解、信任或驾驶安全。</p>
      </section>

      <section className="case-cta"><p>NEXT / INTERACTIVE PROTOTYPE</p><h2>查看“充电站排队”如何触发主动决策。</h2><a href="/#demo">进入交互原型 <span>↗</span></a></section>
      <footer><div className="brand"><i>A</i><b>安心领航</b></div><p>CalmRoute AI · 产品案例研究 v1.0</p><a href="#top">回到顶部 ↑</a></footer>
    </main>
  );
}

function SectionLabel({number,text}:{number:string;text:string}) { return <div className="case-label"><span>{number}</span><b>{text}</b></div>; }
function Hypothesis({n,title,text}:{n:string;title:string;text:string}) { return <article><small>{n} · 待验证</small><h3>{title}</h3><p>{text}</p></article>; }
