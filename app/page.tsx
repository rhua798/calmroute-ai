"use client";

import { FormEvent, useMemo, useState } from "react";

const screens = {
  hud: ["AR-HUD", "保持左侧车道", "320 m 后驶入 G50 湖州方向"],
  cluster: ["仪表", "下一步：靠左", "预计 14:08 到达 · 剩余 168 km"],
  center: ["中控", "已生成备选路线", "绕行 8 km，可节省 16 分钟"],
} as const;
type Screen = keyof typeof screens;

type Incident = "charge" | "missed" | "road" | "parking";
type PlanStop = { id: string; type: "start" | "pickup" | "charge" | "meal" | "recovery" | "arrival"; time: string; title: string; detail: string; status: string };
type RoutePath = { distanceMeters: number; durationSeconds: number; strategy: string; tolls: number; trafficLights: number; steps: Array<{ instruction: string; road: string; distanceMeters: number; action: string }> };
type RoutePoi = { id: string; name: string; location: string; address: string; type: string; typecode: string; distanceMeters: number; parkingType: string };
type RouteApiResult = { source: "amap"; paths: RoutePath[]; chargingCandidates?: RoutePoi[]; parkingCandidates?: RoutePoi[] };
type GeneratedPlan = { origin: string; destination: string; startTime: string; arrivalTime: string; battery: number; stops: PlanStop[]; revision: number; source: "amap" | "demo"; distanceKm: number | null; driveMinutes: number; routeStrategies: string[]; routeOptions: RoutePath[]; chargingCandidates: RoutePoi[]; parkingCandidates: RoutePoi[] };

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
    title: "模拟异常：前方补能点出现排队",
    reason: "基于用户调研中的高频痛点注入场景；当前地图接口仅提供充电站位置，不提供实时空闲桩与排队数据。",
    original: "原补能点 · 排队时间未知",
    recommendation: "切换备用补能点 · +8 km",
    impact: "选择备选地点后重新计算全程；实时排队与价格仍需补能平台确认。",
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
    title: "模拟异常：目的地停车困难",
    reason: "基于景区出行调研中的高频痛点注入场景；当前地图接口仅提供停车场位置，不提供实时余位。",
    original: "景区停车 · 等待未知",
    recommendation: "云谷停车场 + 接驳",
    impact: "选择备选地点后重新计算全程；实时余位与费用仍需停车平台确认。",
    action: "预留停车方案",
  },
};

const examples = [
  "周六 9 点从上海虹桥火车站出发去莫干山风景名胜区，先接朋友，中午想吃本地菜；电量 72%，不走小路，目的地要能停车。",
  "明早从杭州市民中心带父母去安吉竹博园，两人容易晕车，希望路线平稳，中午 12 点前吃饭并安排一次补能。",
  "周日下午从苏州中心出发去湖州博物馆，当天往返，优先不排队的充电站，目的地附近需要安全停车。",
];

export default function Home() {
  const [screen, setScreen] = useState<Screen>("hud");
  const [request, setRequest] = useState(examples[0]);
  const [originInput, setOriginInput] = useState("上海虹桥火车站");
  const [destinationInput, setDestinationInput] = useState("莫干山风景名胜区");
  const [departureInput, setDepartureInput] = useState("09:00");
  const [batteryInput, setBatteryInput] = useState(72);
  const [generated, setGenerated] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [incident, setIncident] = useState<Incident>("charge");
  const [resolved, setResolved] = useState(false);
  const understanding = useMemo(() => parseRequest(request, originInput, destinationInput, departureInput, batteryInput), [request, originInput, destinationInput, departureInput, batteryInput]);
  const [basePlan, setBasePlan] = useState<GeneratedPlan>(() => buildPlan(parseRequest(examples[0], "上海虹桥火车站", "莫干山风景名胜区", "09:00", 72)));
  const [plan, setPlan] = useState<GeneratedPlan>(() => buildPlan(parseRequest(examples[0], "上海虹桥火车站", "莫干山风景名胜区", "09:00", 72)));
  const incidentData = dynamicIncident(incidents[incident], incident, plan);

  function updateDeparture(nextTime: string) {
    setRequest(current => syncDepartureInRequest(current, departureInput, nextTime));
    setDepartureInput(nextTime);
  }

  function updateBattery(rawValue: string) {
    const nextBattery = Math.max(10, Math.min(100, Number(rawValue) || 10));
    setRequest(current => syncBatteryInRequest(current, batteryInput, nextBattery));
    setBatteryInput(nextBattery);
  }

  async function generatePlan(event: FormEvent) {
    event.preventDefault();
    if (!request.trim()) return;
    setPlanning(true);
    setGenerated(false);
    setResolved(false);
    setRouteError("");
    try {
      const response = await fetch("/api/route", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ origin: understanding.origin, destination: understanding.destination }) });
      const data = await response.json() as RouteApiResult & { error?: string };
      if (!response.ok || !data.paths?.length) throw new Error(data.error || "ROUTE_REQUEST_FAILED");
      const nextPlan = buildPlan(understanding, data);
      setBasePlan(nextPlan);
      setPlan(nextPlan);
      setGenerated(true);
    } catch {
      const fallbackPlan = buildPlan(understanding);
      setBasePlan(fallbackPlan);
      setPlan(fallbackPlan);
      setGenerated(true);
      setRouteError("真实路线暂时不可用，当前已回退为演示估算。请检查地点名称或服务配置。");
    } finally {
      setPlanning(false);
    }
  }

  function selectIncident(next: Incident) {
    if (resolved) setPlan(basePlan);
    setIncident(next);
    setResolved(false);
  }

  async function resolveIncident() {
    if (resolved) {
      setPlan(basePlan);
      setResolved(false);
      return;
    }
    const candidate = incident === "charge" ? (plan.chargingCandidates[1] || plan.chargingCandidates[0]) : incident === "parking" ? (plan.parkingCandidates[1] || plan.parkingCandidates[0]) : undefined;
    setResolving(true);
    try {
      if (plan.source === "amap" && candidate && (incident === "charge" || incident === "parking")) {
        const response = await fetch("/api/route", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ origin: plan.origin, destination: plan.destination, waypoint: candidate.location }) });
        const data = await response.json() as RouteApiResult;
        if (!response.ok || !data.paths?.length) throw new Error("REROUTE_FAILED");
        setPlan(current => applyIncident(current, incident, data.paths[0], candidate));
      } else {
        setPlan(current => applyIncident(current, incident));
      }
      setResolved(true);
    } catch {
      setRouteError("备选地点重新算路失败，已保留原路线，请稍后重试。");
    } finally {
      setResolving(false);
    }
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
          <article className="score"><span>出行确定性</span><strong>78<small>/100</small></strong><div><i style={{width: "78%"}}/></div><p>最大风险：充电站预计排队 18 分钟</p></article>
          <article className="eta"><span>预计全程</span><strong>5h 02m</strong><small>263 km · 抵达剩余 31%</small></article>
        </div>
      </section>

      <section className="demo" id="demo">
        <Heading number="01" label="可交互 Agent Demo" title={<>说出你的需求，<br/>把不确定变成<span>下一步。</span></>} desc="输入真实出行需求，Agent 将拆解约束、生成行程，并在异常发生时解释代价、重排全局计划。" />
        <form className="request-console" onSubmit={generatePlan}>
          <div className="request-label"><span>01</span><p><b>描述这次出行</b><small>自然语言输入 · 支持时间、同行人、补能、餐饮与停车偏好</small></p><i>可编辑</i></div>
          <div className="route-fields">
            <label><span>出发地</span><input aria-label="出发地" value={originInput} onChange={event => setOriginInput(event.target.value)} /></label>
            <label><span>目的地</span><input aria-label="目的地" value={destinationInput} onChange={event => setDestinationInput(event.target.value)} /></label>
            <label><span>出发时间</span><input aria-label="出发时间" type="time" value={departureInput} onChange={event => updateDeparture(event.target.value)} /></label>
            <label><span>当前电量</span><div><input aria-label="当前电量" type="number" min="10" max="100" value={batteryInput} onChange={event => updateBattery(event.target.value)} /><b>%</b></div></label>
          </div>
          <textarea aria-label="出行需求" value={request} onChange={event => setRequest(event.target.value)} rows={4} />
          <div className="example-row"><span>试试示例</span>{examples.map((example, index) => <button type="button" key={example} onClick={() => { const parsed = parseExample(example); setRequest(example); setOriginInput(parsed.origin); setDestinationInput(parsed.destination); setDepartureInput(parsed.time); setBatteryInput(parsed.battery); }}>场景 {index + 1}</button>)}</div>
          <button className="generate-button" disabled={!request.trim() || planning}>{planning ? "正在理解需求并编排行程…" : "生成安心行程"}<b>{planning ? "•••" : "→"}</b></button>
        </form>
        {routeError && <p className="route-error" role="status">{routeError}</p>}

        {generated && <div className="agent-workspace" aria-live="polite">
          <div className="understood">
            <div className="workspace-head"><p><small>02</small><b>Agent 已理解</b></p><span>已识别 {understanding.tags.length} 项约束</span></div>
            <h3>{plan.origin} <i>→</i> {plan.destination}</h3>
            <div className="constraint-tags">{understanding.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
            <p className="agent-note"><b>规划说明</b> 优先保证道路可通行与补能选择权，再优化总时长；停车与用餐作为行程节点统一编排。</p>
            <div className={`route-proof ${plan.source}`}><b>{plan.source === "amap" ? "高德真实算路" : "演示估算"}</b><span>{plan.distanceKm ? `${plan.distanceKm} km · ` : ""}驾车约 {formatDuration(plan.driveMinutes)}</span><small>{plan.source === "amap" ? `已返回 ${plan.routeStrategies.length} 个路线策略 · ${plan.chargingCandidates.length} 个沿途充电 POI · ${plan.parkingCandidates.length} 个目的地停车 POI` : "未连接实时道路数据"}</small></div>
          </div>
          <article className="plan"><header><span>03 · 路线版本 R{plan.revision}</span><b>{plan.origin} → {plan.destination}</b></header>
            {plan.stops.map(stop => <Trip key={stop.id} time={stop.time} title={stop.title} detail={stop.detail} status={stop.status} warning={stop.type === "charge" && incident === "charge" && !resolved} />)}
          </article>
        </div>}

        {generated && <div className="exception-lab">
          <div className="workspace-head"><p><small>04</small><b>在途中注入异常</b></p><span>点击切换场景，观察 Agent 如何恢复行程</span></div>
          <div className="incident-tabs">{(Object.keys(incidents) as Incident[]).map(key => <button type="button" className={incident === key ? "active" : ""} onClick={() => selectIncident(key)} key={key}>{incidents[key].label}</button>)}</div>
          <article className={`agent ${resolved ? "done" : ""}`}>
            <header><i>AI</i><p><b>安心助手</b><span>{resolved ? "已重新检查后续全部节点" : "在仍有选择余量时发现异常"}</span></p><small>{resolved ? "已处理" : "需要决策"}</small></header>
            <div className="agent-body">
              <div><label>{resolved ? "行程已恢复" : "检测到行程风险"}</label><h3>{resolved ? `${incidentData.action}成功` : incidentData.title}</h3><p>{resolved ? `已同步更新补能、用餐、停车与抵达预期。${incident === "charge" || incident === "parking" ? "选中地点已作为途经点完成高德重新算路。" : incidentData.impact}` : incidentData.reason}</p></div>
              <div className="compare"><p><span>原方案</span><b>{incidentData.original}</b><small>{resolved ? "已取消" : "当前风险"}</small></p><i>→</i><p><span>推荐方案</span><b>{incidentData.recommendation}</b><small>{incidentData.impact}</small></p></div>
            </div>
            <div className="decision-reason"><b>为什么推荐？</b><span>保留安全选择权</span><span>总行程影响可控</span><span>后续节点无需取消</span></div>
            <button onClick={resolveIncident} disabled={resolving}>{resolving ? "正在调用高德重新算路…" : resolved ? "撤销并恢复原方案" : `${incidentData.action}并更新全程`}<b>{resolving ? "•••" : resolved ? "↩" : "→"}</b></button>
          </article>
        </div>
        }
      </section>

      <section className="screens" id="screens">
        <Heading number="02" label="跨屏信息策略" title={<>同一段导航，<span>各司其职。</span></>} desc="依据驾驶任务的紧迫性与复杂度，将信息分配到最合适的触点。" />
        <div className="tabs">{(Object.keys(screens) as Screen[]).map(key => <button className={screen === key ? "active" : ""} onClick={() => setScreen(key)} key={key}>{screens[key][0]}</button>)}</div>
        <div className={`cockpit ${screen === "center" ? "center-mode" : ""}`}>
          {screen === "center" ? <div className="center-console">
            <header><p><span>全局决策 · P2</span><b>选择更确定的路线</b></p><small>已比较 3 个可行方案</small></header>
            <div className="route-choice-grid">
              <article className="selected"><small>AI 推荐</small><h3>安心路线</h3><strong>2h 18m</strong><p>189.4 km · 经备选补能点</p><div><span>排队风险未知</span><span>全程影响可控</span></div></article>
              <article><small>时间优先</small><h3>最快路线</h3><strong>2h 05m</strong><p>184.6 km · 原补能点</p><div><span>少 13 min</span><span>补能选择较少</span></div></article>
              <article><small>里程优先</small><h3>少收费路线</h3><strong>2h 31m</strong><p>181.8 km · 少高速路段</p><div><span>少 ¥18</span><span>多 13 min</span></div></article>
            </div>
            <div className="center-decision"><p><span>推荐依据</span><b>优先保留补能选择权</b></p><p><span>影响</span><b>+4.8 km · +13 min</b></p><button type="button">采用安心路线 <b>→</b></button></div>
          </div> : <><div className="road"><i/><i/><b/></div><div className="instruction"><span>立即执行</span><h3>{screens[screen][1]}</h3><p>{screens[screen][2]}</p></div></>}
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

function parseRequest(value: string, origin: string, destination: string, startTime: string, battery: number) {
  const needsCharge = value.includes("电量") || value.includes("充电") || value.includes("补能") || battery < 80;
  const needsMeal = value.includes("吃") || value.includes("餐") || value.includes("饭");
  const hasCompanion = /朋友|两人|同行|父母|孩子|老人/.test(value);
  const tags = [
    `${startTime} 出发`,
    needsCharge ? `${battery}% 电量 · 需要补能` : `${battery}% 电量 · 续航充足`,
    value.includes("小路") ? "避开低等级道路" : "优先可靠路线",
    value.includes("停车") ? "目的地停车" : "到达前检查停车",
    needsMeal ? "安排沿途用餐" : "保留休息时间",
  ];
  if (/父母|孩子|老人|晕车/.test(value)) tags.push("同行人舒适优先");
  else if (hasCompanion) tags.push("含同行节点");
  return { origin: origin.trim() || "未填写", destination: destination.trim() || "未填写", startTime, battery, tags, needsCharge, needsMeal, hasCompanion, needsParking: value.includes("停车") };
}

function parseExample(value: string) {
  const origin = value.match(/从([^，,。\s]{2,8})(?:出发|去)/)?.[1] ?? "上海";
  const destination = value.match(/(?:去|到)([^，,。；;]{2,10})/)?.[1]?.replace(/自驾|旅行|玩|看展/g, "") ?? "莫干山";
  const timeMatch = value.match(/(\d{1,2})[点:时](\d{1,2})?/) ?? [];
  const time = timeMatch[1] ? `${timeMatch[1].padStart(2, "0")}:${(timeMatch[2] || "00").padStart(2, "0")}` : "09:00";
  const battery = Number(value.match(/电量\s*(\d{1,3})/)?.[1] ?? 70);
  return { origin, destination, time, battery };
}

function syncDepartureInRequest(text: string, previousTime: string, nextTime: string) {
  if (!nextTime) return text;
  const [previousHour, previousMinute] = previousTime.split(":");
  const [nextHour, nextMinute] = nextTime.split(":");
  const chineseTime = nextMinute === "00" ? `${Number(nextHour)} 点` : `${Number(nextHour)} 点 ${Number(nextMinute)} 分`;
  const candidates = [previousTime, `${Number(previousHour)}:${previousMinute}`, `${Number(previousHour)} 点`, `${Number(previousHour)}点`, `${Number(previousHour)} 时`, `${Number(previousHour)}时`];
  const matched = candidates.find(candidate => text.includes(candidate));
  if (matched) return text.replace(matched, chineseTime);
  return `${text.replace(/[。；;\s]+$/, "")}；出发时间 ${chineseTime}。`;
}

function syncBatteryInRequest(text: string, previousBattery: number, nextBattery: number) {
  const previousPattern = new RegExp(`电量\\s*${previousBattery}\\s*%?`);
  if (previousPattern.test(text)) return text.replace(previousPattern, `电量 ${nextBattery}%`);
  return `${text.replace(/[。；;\s]+$/, "")}；电量 ${nextBattery}%。`;
}

function buildPlan(input: ReturnType<typeof parseRequest>, realRoute?: RouteApiResult): GeneratedPlan {
  const seed = [...`${input.origin}${input.destination}`].reduce((total, char) => total + char.charCodeAt(0), 0);
  const primaryPath = realRoute?.paths?.[0];
  const driveMinutes = primaryPath ? Math.max(1, Math.round(primaryPath.durationSeconds / 60)) : 165 + (seed % 96);
  const stops: PlanStop[] = [{ id: "start", type: "start", time: input.startTime, title: `从${input.origin}出发`, detail: `当前电量 ${input.battery}% · 已检查全局约束`, status: "准备就绪" }];
  let cursor = 20;
  if (input.hasCompanion) {
    stops.push({ id: "pickup", type: "pickup", time: addMinutes(input.startTime, cursor), title: "接同行人", detail: "已按需求加入停靠点 · 预留 12 分钟", status: "已编排" });
    cursor += 12;
  }
  if (input.needsCharge) {
    const chargeAt = Math.max(cursor + 35, Math.round(driveMinutes * .48));
    const chargingPoi = realRoute?.chargingCandidates?.[0];
    stops.push({ id: "charge", type: "charge", time: addMinutes(input.startTime, chargeAt), title: chargingPoi?.name || `${input.destination}方向补能点`, detail: chargingPoi ? `${chargingPoi.address} · 高德沿途 POI` : "演示估算：充至 82% · 预计 18 分钟", status: chargingPoi ? "真实地点" : "待接入 POI" });
  }
  if (input.needsMeal) {
    const mealAt = Math.max(cursor + 70, Math.round(driveMinutes * .66));
    stops.push({ id: "meal", type: "meal", time: addMinutes(input.startTime, mealAt), title: "沿途用餐", detail: "已根据餐饮偏好预留 45 分钟", status: "可调整" });
  }
  const extra = (input.needsCharge ? 18 : 0) + (input.needsMeal ? 45 : 0) + (input.hasCompanion ? 12 : 0);
  const arrivalTime = addMinutes(input.startTime, driveMinutes + extra);
  const parkingPoi = realRoute?.parkingCandidates?.[0];
  stops.push({ id: "arrival", type: "arrival", time: arrivalTime, title: `抵达${input.destination}`, detail: parkingPoi ? `停车建议：${parkingPoi.name} · ${parkingPoi.address}` : input.needsParking ? "已加入到达前停车检查" : "到达前将再次检查停车条件", status: realRoute ? "高德路线" : "演示估算" });
  return { origin: input.origin, destination: input.destination, startTime: input.startTime, arrivalTime, battery: input.battery, stops: stops.sort((a, b) => toMinutes(a.time) - toMinutes(b.time)), revision: 1, source: realRoute ? "amap" : "demo", distanceKm: primaryPath ? Math.round(primaryPath.distanceMeters / 100) / 10 : null, driveMinutes, routeStrategies: realRoute?.paths.map(path => path.strategy) ?? [], routeOptions: realRoute?.paths ?? [], chargingCandidates: realRoute?.chargingCandidates ?? [], parkingCandidates: realRoute?.parkingCandidates ?? [] };
}

function applyIncident(current: GeneratedPlan, incident: Incident, realPath?: RoutePath, selectedPoi?: RoutePoi): GeneratedPlan {
  let stops = current.stops.map(stop => ({ ...stop }));
  const routeDelta = realPath ? Math.round(realPath.durationSeconds / 60) - current.driveMinutes : 0;
  if (routeDelta) stops = stops.map((stop, index) => index === 0 ? stop : { ...stop, time: addMinutes(stop.time, routeDelta) });
  if (incident === "charge") {
    const chargeIndex = stops.findIndex(stop => stop.type === "charge");
    const replacement: PlanStop = { id: "charge-alternative", type: "charge", time: chargeIndex >= 0 ? stops[chargeIndex].time : addMinutes(current.startTime, 95), title: selectedPoi?.name || `${current.destination}方向备用补能点`, detail: selectedPoi ? `${selectedPoi.address} · 已作为途经点重新算路` : "已避开排队点 · 多行驶 8 km · 预计补能 16 分钟", status: selectedPoi ? "高德重新算路" : "已自动替换" };
    if (chargeIndex >= 0) stops.splice(chargeIndex, 1, replacement);
    else {
      stops = stops.map(stop => stop.type === "arrival" ? { ...stop, time: addMinutes(stop.time, 16), status: "已重算 +16 min" } : stop);
      stops.splice(Math.max(1, stops.length - 1), 0, replacement);
    }
  }
  if (incident === "missed") {
    stops = stops.map((stop, index) => index === 0 ? stop : { ...stop, time: addMinutes(stop.time, 9), status: stop.type === "arrival" ? "已重算 +9 min" : stop.status });
    stops.splice(1, 0, { id: "recovery-exit", type: "recovery", time: addMinutes(current.startTime, 6), title: "从前方出口安全恢复", detail: "禁止掉头 · 已生成连续可执行路线", status: "新增 6.4 km" });
  }
  if (incident === "road") {
    stops = stops.map((stop, index) => index === 0 ? { ...stop, detail: `${stop.detail} · 已避开未铺装道路` } : { ...stop, time: addMinutes(stop.time, 6), status: stop.type === "arrival" ? "已重算 +6 min" : stop.status });
    stops.splice(1, 0, { id: "safe-road", type: "recovery", time: addMinutes(current.startTime, 12), title: "保持高置信度主路", detail: "绕开 1.8 km 低置信道路", status: "增加 4.2 km" });
  }
  if (incident === "parking") {
    stops = stops.map(stop => stop.type === "arrival" ? { ...stop, time: realPath ? stop.time : addMinutes(stop.time, 4), title: `经${selectedPoi?.name || "备用停车点"}抵达${current.destination}`, detail: selectedPoi ? `${selectedPoi.address} · 已作为途经点重新算路` : "已切换停车场并加入接驳步行段", status: selectedPoi ? "高德重新算路" : "停车方案已更新" } : stop);
  }
  const arrivalTime = stops.find(stop => stop.type === "arrival")?.time ?? current.arrivalTime;
  return { ...current, stops, arrivalTime, revision: current.revision + 1, distanceKm: realPath ? Math.round(realPath.distanceMeters / 100) / 10 : current.distanceKm, driveMinutes: realPath ? Math.round(realPath.durationSeconds / 60) : current.driveMinutes, routeStrategies: realPath ? [realPath.strategy] : current.routeStrategies };
}

function dynamicIncident(base: typeof incidents[Incident], incident: Incident, plan: GeneratedPlan) {
  if (incident === "charge") {
    const candidate = plan.chargingCandidates[1] || plan.chargingCandidates[0];
    return candidate ? { ...base, recommendation: candidate.name, impact: "选择后将该充电站作为途经点调用高德重新算路；不包含实时空闲桩、排队或价格。" } : base;
  }
  if (incident === "parking") {
    const candidate = plan.parkingCandidates[1] || plan.parkingCandidates[0];
    return candidate ? { ...base, recommendation: candidate.name, impact: `位于${candidate.address}；选择后将作为途经点重新算路，不代表实时余位。` } : base;
  }
  return base;
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function addMinutes(time: string, delta: number) {
  const total = (toMinutes(time) + delta + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} 小时 ${rest} 分钟` : `${rest} 分钟`;
}
