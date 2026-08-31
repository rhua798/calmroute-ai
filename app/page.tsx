"use client";

import { FormEvent, useMemo, useState } from "react";

const screens = {
  hud: ["AR-HUD", "保持左侧车道", "320 m 后驶入 G50 湖州方向"],
  cluster: ["仪表", "下一步：靠左", "预计 14:08 到达 · 剩余 168 km"],
  center: ["中控", "已生成备选路线", "绕行 8 km，可节省 16 分钟"],
} as const;
type Screen = keyof typeof screens;

type Incident = "charge" | "missed" | "road" | "parking";

const incidents: Record<Incident, {
  label: string;
  title: string;
  reason: string;
  original: string;
  recommendation: string;
  impact: string;
  action: string;
}> = {
  charge: {
    label: "充电排队",
    title: "安吉服务区预计排队 18 分钟",
    reason: "实时可用桩降至 2 个，近 15 分钟进站车辆持续增加。",
    original: "继续等待 · +18 min",
    recommendation: "切换长兴服务区 · +8 km",
    impact: "无需排队，预计抵达时间不变；多耗电约 2%。",
    action: "切换补能点",
  },
  missed: {
    label: "错过出口",
    title: "已错过湖州南出口",
    reason: "系统确认车辆已驶过匝道，当前道路禁止掉头。",
    original: "原路口已不可用",
    recommendation: "前方 6.4 km 安全重规划",
    impact: "新增 9 分钟；用餐和入住时间仍在可接受范围内。",
    action: "采用恢复路线",
  },
  road: {
    label: "道路异常",
    title: "前方近路通行置信度偏低",
    reason: "路线包含 1.8 km 未铺装道路，近期存在道路阻断反馈。",
    original: "近路 · 风险较高",
    recommendation: "保持主路 · +6 min",
    impact: "避免低等级道路；全程增加 4.2 km，电量充足。",
    action: "保持主路",
  },
  parking: {
    label: "停车困难",
    title: "目的地停车场预计满位",
    reason: "到达时段与景区高峰重叠，近 30 分钟余位持续下降。",
    original: "景区停车 · 等待未知",
    recommendation: "云谷停车场 + 接驳",
    impact: "步行减少 900 m，费用增加 8 元，抵达时间延后 4 分钟。",
    action: "预留停车方案",
  },
};

const examples = [
  "周六 9 点从上海出发去莫干山，先接朋友，中午想吃本地菜；电量 72%，不走小路，民宿要能停车。",
  "明早从杭州带父母去安吉，两人容易晕车，希望路线平稳，中午 12 点前吃饭并安排一次补能。",
  "周日下午从苏州去湖州看展，当天往返，优先不排队的充电站，目的地附近需要安全停车。",
];

export default function Home() {
  const [accepted, setAccepted] = useState(false);
  const [screen, setScreen] = useState<Screen>("hud");
  const [request, setRequest] = useState(examples[0]);
  const [generated, setGenerated] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [incident, setIncident] = useState<Incident>("charge");
  const [resolved, setResolved] = useState(false);
  const understanding = useMemo(() => parseRequest(request), [request]);
  const incidentData = incidents[incident];

  function generatePlan(event: FormEvent) {
    event.preventDefault();
    if (!request.trim()) return;
    setPlanning(true);
    setGenerated(false);
    setResolved(false);
    setAccepted(false);
    window.setTimeout(() => {
      setGenerated(true);
      setPlanning(false);
    }, 650);
  }

  function selectIncident(next: Incident) {
    setIncident(next);
    setResolved(false);
    setAccepted(false);
  }

  function resolveIncident() {
    setResolved(value => !value);
    setAccepted(value => !value);
  }
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top"><i>A</i><b>安心领航</b><small>AI DRIVE COMPANION</small></a>
        <nav><a href="/case-study">案例研究</a><a href="#screens">跨屏策略</a><a href="#metrics">数据验证</a></nav>
        <span className="case">PRODUCT CASE 01</span>
      </header>

      <section className="hero" id="top">
        <div className="copy">
          <p className="eyebrow"><i />AI 主动式出行助手</p>
          <h1><span>让每一次出发，</span><em>都有把握。</em></h1>
          <p className="lead">从一句自然语言需求出发，主动编排行程、预判风险，并把复杂决策转化为驾驶者一眼就懂的下一步。</p>
          <div className="actions"><a className="primary" href="#demo">体验完整旅程 <b>↗</b></a><a href="/case-study">阅读完整案例 →</a></div>
          <div className="facts"><p><b>4</b><span>跨服务能力</span></p><p><b>3</b><span>座舱屏幕协同</span></p><p><b>6</b><span>核心体验指标</span></p></div>
        </div>
        <div className="map" aria-label="上海到莫干山行程示意图">
          <div className="grid"/><div className="route"><i/><i/><i/></div>
          <span className="place sh"><b>上海</b>09:00 出发</span><span className="place hz"><b>湖州</b>补能 18 min</span><span className="place mg"><b>莫干山</b>14:08 抵达</span>
          <article className="score"><span>出行确定性</span><strong>{accepted ? 91 : 78}<small>/100</small></strong><div><i style={{width: accepted ? "91%" : "78%"}}/></div><p>{accepted ? "风险已解除，抵达时间保持不变" : "最大风险：充电站预计排队 18 分钟"}</p></article>
          <article className="eta"><span>预计全程</span><strong>{accepted ? "4h 46m" : "5h 02m"}</strong><small>263 km · 抵达剩余 31%</small></article>
        </div>
      </section>

      <section className="demo" id="demo">
        <Heading number="01" label="可交互 Agent Demo" title={<>说出你的需求，<br/>把不确定变成<span>下一步。</span></>} desc="输入真实出行需求，Agent 将拆解约束、生成行程，并在异常发生时解释代价、重排全局计划。" />
        <form className="request-console" onSubmit={generatePlan}>
          <div className="request-label"><span>01</span><p><b>描述这次出行</b><small>自然语言输入 · 支持时间、同行人、补能、餐饮与停车偏好</small></p><i>可编辑</i></div>
          <textarea aria-label="出行需求" value={request} onChange={event => setRequest(event.target.value)} rows={4} />
          <div className="example-row"><span>试试示例</span>{examples.map((example, index) => <button type="button" key={example} onClick={() => setRequest(example)}>场景 {index + 1}</button>)}</div>
          <button className="generate-button" disabled={!request.trim() || planning}>{planning ? "正在理解需求并编排行程…" : "生成安心行程"}<b>{planning ? "•••" : "→"}</b></button>
        </form>

        {generated && <div className="agent-workspace" aria-live="polite">
          <div className="understood">
            <div className="workspace-head"><p><small>02</small><b>Agent 已理解</b></p><span>已识别 {understanding.tags.length} 项约束</span></div>
            <h3>{understanding.origin} <i>→</i> {understanding.destination}</h3>
            <div className="constraint-tags">{understanding.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
            <p className="agent-note"><b>规划说明</b> 优先保证道路可通行与补能选择权，再优化总时长；停车与用餐作为行程节点统一编排。</p>
          </div>
          <article className="plan"><header><span>03 · 已生成行程</span><b>{understanding.origin} → {understanding.destination}</b></header>
            <Trip time={understanding.startTime} title={`${understanding.origin}出发`} detail="已完成电量与全局路况检查" status="准备就绪" />
            <Trip time="09:20" title="接同行人" detail="P6 停车场 · 停留 12 分钟" status="顺路" />
            <Trip time="11:38" title={resolved && incident === "charge" ? "长兴服务区补能" : "安吉服务区补能"} detail="预计充至 82% · 18 分钟" status={resolved && incident === "charge" ? "已切换" : "留有备选"} warning={incident === "charge" && !resolved} />
            <Trip time="12:25" title="本地菜午餐" detail="已纳入停车与营业时间" status="顺路 1.8 km" />
            <Trip time={resolved && incident === "missed" ? "14:17" : "14:08"} title={`抵达${understanding.destination}`} detail={resolved && incident === "parking" ? "云谷停车场 · 接驳抵达" : "预计剩余电量 31% · 已规划停车"} status={resolved ? "行程已同步" : "提前 52 分钟"} />
          </article>
        </div>}

        {generated && <div className="exception-lab">
          <div className="workspace-head"><p><small>04</small><b>在途中注入异常</b></p><span>点击切换场景，观察 Agent 如何恢复行程</span></div>
          <div className="incident-tabs">{(Object.keys(incidents) as Incident[]).map(key => <button type="button" className={incident === key ? "active" : ""} onClick={() => selectIncident(key)} key={key}>{incidents[key].label}</button>)}</div>
          <article className={`agent ${resolved ? "done" : ""}`}>
            <header><i>AI</i><p><b>安心助手</b><span>{resolved ? "已重新检查后续全部节点" : "在仍有选择余量时发现异常"}</span></p><small>{resolved ? "已处理" : "需要决策"}</small></header>
            <div className="agent-body">
              <div><label>{resolved ? "行程已恢复" : "检测到行程风险"}</label><h3>{resolved ? `${incidentData.action}成功` : incidentData.title}</h3><p>{resolved ? `已同步更新补能、用餐、停车与抵达预期。${incidentData.impact}` : incidentData.reason}</p></div>
              <div className="compare"><p><span>原方案</span><b>{incidentData.original}</b><small>{resolved ? "已取消" : "当前风险"}</small></p><i>→</i><p><span>推荐方案</span><b>{incidentData.recommendation}</b><small>{incidentData.impact}</small></p></div>
            </div>
            <div className="decision-reason"><b>为什么推荐？</b><span>保留安全选择权</span><span>总行程影响可控</span><span>后续节点无需取消</span></div>
            <button onClick={resolveIncident}>{resolved ? "撤销并恢复原方案" : `${incidentData.action}并更新全程`}<b>{resolved ? "↩" : "→"}</b></button>
          </article>
        </div>
        }
      </section>

      <section className="screens" id="screens">
        <Heading number="02" label="跨屏信息策略" title={<>同一段导航，<span>各司其职。</span></>} desc="依据驾驶任务的紧迫性与复杂度，将信息分配到最合适的触点。" />
        <div className="tabs">{(Object.keys(screens) as Screen[]).map(key => <button className={screen === key ? "active" : ""} onClick={() => setScreen(key)} key={key}>{screens[key][0]}</button>)}</div>
        <div className="cockpit"><div className="road"><i/><i/><b/></div><div className="instruction"><span>立即执行</span><h3>{screens[screen][1]}</h3><p>{screens[screen][2]}</p></div>
          <aside><span>信息分配原则</span><p className={screen === "hud" ? "active" : ""}><b>01 眼前</b>只呈现当下必须执行的动作</p><p className={screen === "cluster" ? "active" : ""}><b>02 预期</b>维持驾驶状态与下一步预期</p><p className={screen === "center" ? "active" : ""}><b>03 决策</b>承载全局信息与复杂交互</p></aside>
        </div>
      </section>

      <section className="metrics" id="metrics">
        <Heading number="03" label="数据验证框架" title={<>用数据回答：<span>体验真的更好吗？</span></>} />
        <div className="metric-grid"><Metric name="复杂路口决策时间" value="2.9" unit="s" delta="↓ 39.6%"/><Metric name="出口错过率" value="10" unit="%" delta="↓ 20pp"/><Metric name="AI 建议接受率" value="76" unit="%" delta="↑ 14pp"/><Metric name="主观安全感" value="4.4" unit="/5" delta="↑ 0.8"/></div>
        <small className="note">* 当前为首轮探索性测试目标值，后续将补充任务脚本、测试录像与原始记录。</small>
      </section>
      <footer><div className="brand"><i>A</i><b>安心领航</b></div><p>下一代智能座舱出行体验概念项目 · 2027 校招作品集</p><a href="#top">回到顶部 ↑</a></footer>
    </main>
  );
}

function Heading({number,label,title,desc}:{number:string;label:string;title:React.ReactNode;desc?:string}) { return <div className="heading"><p><small>{number}</small><b>{label}</b></p><h2>{title}</h2>{desc && <span>{desc}</span>}</div>; }
function Trip({time,title,detail,status,warning}:{time:string;title:string;detail:string;status:string;warning?:boolean}) { return <div className={`trip ${warning ? "warning" : ""}`}><time>{time}</time><i/><p><b>{title}</b><span>{detail}</span></p><small>{status}</small></div>; }
function Metric({name,value,unit,delta}:{name:string;value:string;unit:string;delta:string}) { return <article><span>{name}</span><strong>{value}<small>{unit}</small></strong><p><i>{delta}</i> 对比基准方案</p></article>; }

function parseRequest(value: string) {
  const origin = value.match(/从([^，,。\s]{2,8})(?:出发|去)/)?.[1] ?? "上海";
  const destination = value.match(/(?:去|到)([^，,。；;]{2,10})/)?.[1]?.replace(/自驾|旅行|玩/g, "") ?? "莫干山";
  const time = value.match(/(\d{1,2})[点:时](\d{1,2})?/) ?? [];
  const startTime = time[1] ? `${time[1].padStart(2, "0")}:${(time[2] || "00").padStart(2, "0")}` : "09:00";
  const tags = [
    `${startTime} 出发`,
    value.includes("电量") || value.includes("充电") || value.includes("补能") ? "需要补能规划" : "检查续航余量",
    value.includes("小路") ? "避开低等级道路" : "优先可靠路线",
    value.includes("停车") ? "目的地停车" : "到达前检查停车",
    value.includes("吃") || value.includes("餐") || value.includes("饭") ? "安排沿途用餐" : "保留休息时间",
  ];
  if (/父母|孩子|老人|晕车/.test(value)) tags.push("同行人舒适优先");
  else if (/朋友|两人|同行/.test(value)) tags.push("含同行节点");
  return { origin, destination, startTime, tags };
}
