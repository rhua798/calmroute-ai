"use client";

import { useState } from "react";

const screens = {
  hud: ["AR-HUD", "保持左侧车道", "320 m 后驶入 G50 湖州方向"],
  cluster: ["仪表", "下一步：靠左", "预计 14:08 到达 · 剩余 168 km"],
  center: ["中控", "已生成备选路线", "绕行 8 km，可节省 16 分钟"],
} as const;
type Screen = keyof typeof screens;

export default function Home() {
  const [accepted, setAccepted] = useState(false);
  const [screen, setScreen] = useState<Screen>("hud");
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top"><i>A</i><b>安心领航</b><small>AI DRIVE COMPANION</small></a>
        <nav><a href="#demo">体验原型</a><a href="#screens">跨屏策略</a><a href="#metrics">数据验证</a></nav>
        <span className="case">PRODUCT CASE 01</span>
      </header>

      <section className="hero" id="top">
        <div className="copy">
          <p className="eyebrow"><i />AI 主动式出行助手</p>
          <h1>让每一次出发，<br/><em>都有把握。</em></h1>
          <p className="lead">从一句自然语言需求出发，主动编排行程、预判风险，并把复杂决策转化为驾驶者一眼就懂的下一步。</p>
          <div className="actions"><a className="primary" href="#demo">体验完整旅程 <b>↗</b></a><a href="#screens">查看设计逻辑 ↓</a></div>
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
        <Heading number="01" label="主动式异常处理" title={<>不只告诉你发生了什么，<br/>更给出<span>可信的下一步。</span></>} desc="系统持续检查时间、电量、路况与服务可用性，在风险真正影响行程前完成预判。" />
        <div className="demo-grid">
          <article className="plan"><header><span>今日行程</span><b>上海 → 莫干山</b></header>
            <Trip time="09:20" title="虹桥接朋友" detail="P6 停车场 · 停留 12 分钟" status="准时" />
            <Trip time="11:38" title={accepted ? "长兴服务区补能" : "安吉服务区补能"} detail="预计充至 82% · 18 分钟" status={accepted ? "已切换" : "预计排队"} warning />
            <Trip time="12:25" title="山里人家午餐" detail="偏好：本地菜 · 已预留停车位" status="顺路 1.8 km" />
            <Trip time="14:08" title="抵达莫干山民宿" detail="预计剩余电量 31%" status="提前 52 分钟" />
          </article>
          <article className={`agent ${accepted ? "done" : ""}`}><header><i>AI</i><p><b>安心助手</b><span>刚刚完成全局行程检查</span></p><small>主动建议</small></header>
            <label>{accepted ? "风险已解除" : "检测到行程风险"}</label><h3>{accepted ? "已切换至长兴服务区" : "安吉服务区预计排队 18 分钟"}</h3>
            <p>{accepted ? "后续用餐和抵达时间已同步更新，预计 14:08 到达民宿。" : "建议切换至 12 km 外的长兴服务区。虽然多行驶 8 km，但无需排队，预计到达时间不变。"}</p>
            <div className="compare"><p><span>原方案</span><b>{accepted ? "已取消" : "+18 min"}</b><small>安吉服务区</small></p><i>→</i><p><span>推荐方案</span><b>{accepted ? "已生效" : "0 min"}</b><small>长兴服务区</small></p></div>
            <button onClick={() => setAccepted(v => !v)}>{accepted ? "撤销切换" : "接受并更新行程"}<b>{accepted ? "↩" : "→"}</b></button>
          </article>
        </div>
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
