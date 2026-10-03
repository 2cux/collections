import React, { useMemo, useState, useLayoutEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { ActivityHeatmap } from './components/activity-heatmap/activity-heatmap';
import arcStyles from './components/activity-heatmap/activity-heatmap.module.css';

function clearCompanionExit(element) {
  element.removeAttribute('data-exiting');
  for (const property of ['--exit-x', '--exit-y', '--exit-width']) element.style.removeProperty(property);
}

function HeatmapPlaceholder({ days, period, actions }) {
  const weeks = Math.max(1, Math.ceil(((new Date(`${days[0]?.date}T00:00:00Z`).getUTCDay() || 0) + days.length) / 7));
  const total = days.reduce((sum, day) => sum + day.count, 0);
  return <div className={arcStyles.root} aria-hidden="true" style={{ visibility: 'hidden' }}>
    <div className={arcStyles.header}><p className={arcStyles.summary}><span className={arcStyles.total}>{total} contributions</span><span className={arcStyles.period}>in {period}</span></p><div className={arcStyles.actions}>{actions}</div></div>
    <div className={arcStyles.scroller}><div className={arcStyles.canvas} style={{ '--weeks': weeks }}><div className={arcStyles.months} /><div className={arcStyles.plot} style={{ height: 'calc(7 * var(--cell) + 6 * var(--gap))' }} /></div></div>
    <div className={arcStyles.legend} style={{ height: 20 }} />
  </div>;
}
function GitHubActivity({ data }) {
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);
  const [period, setPeriod] = useState(String(data.years[0].year));
  if (!data.years.some(item => String(item.year) === period)) setPeriod(String(data.years[0].year));
  const [selectedDate, setSelectedDate] = useState(null);
  const toggleRef = useRef(null), closeRef = useRef(null), animations = useRef([]);
  const calendar = data.years.find(item => String(item.year) === period) || data.years[0];
  const annualDays = data.years[0].days;
  const annualTotal = annualDays.reduce((sum, day) => sum + day.count, 0);
  const days = calendar.days;
  const thresholds = useMemo(() => [1, 2, 3].map(level => Math.max(level, ...calendar.days.filter(day => day.level > 0 && day.level <= level).map(day => day.count))), [calendar]);
  useLayoutEffect(() => () => {
    animations.current.forEach(animation => animation.cancel());
    const home = document.querySelector('.greeting-home');
    for (const companion of home.querySelectorAll('.greeting-companion, .portfolio-card')) {
      clearCompanionExit(companion);
      companion.removeAttribute('aria-hidden');
      companion.inert = false;
    }
    home.classList.remove('is-activity-expanded');
    delete home.dataset.layoutAnimating;
    delete document.querySelector('.activity-card').dataset.animating;
  }, []);
  function toggle(open) {
    const home = document.querySelector('.greeting-home');
    const card = document.querySelector('.activity-card');
    const companion = home.querySelector('.greeting-companion');
    const portfolio = home.querySelector('.portfolio-card');
    const companions = [companion, portfolio];
    const companionRects = companions.map(element => element.getBoundingClientRect());
    const companionCards = [...companion.children, portfolio];
    const companionStart = companionCards.map(element => {
      const style = getComputedStyle(element);
      return { opacity: style.opacity, transform: style.transform };
    });
    const elements = [card, home.querySelector('.greeting-card'), home.querySelector('.greeting-links'), home.querySelector('.like-dock')];
    const before = elements.map(element => element.getBoundingClientRect());
    animations.current.forEach(animation => animation.cancel());
    companions.forEach(clearCompanionExit);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Float the outgoing widgets at their current position so they can fade
    // without reserving a row above the greeting in the expanded layout.
    if (open && !reduced) {
      companions.forEach((element, index) => {
        const rect = companionRects[index];
        element.dataset.exiting = 'true';
        element.style.setProperty('--exit-x', `${rect.x}px`);
        element.style.setProperty('--exit-y', `${rect.y}px`);
        element.style.setProperty('--exit-width', `${rect.width}px`);
      });
    }
    companions.forEach(element => {
      element.inert = open;
      if (open) element.setAttribute('aria-hidden', 'true');
      else element.removeAttribute('aria-hidden');
    });
    home.dataset.layoutAnimating = 'true';
    card.dataset.animating = 'true';
    home.classList.toggle('is-activity-expanded', open);
    flushSync(() => { setExpanded(open); setReady(open && reduced); });
    if (!reduced) {
      card.dataset.animating = 'true';
      const targets = elements.map(element => element.getBoundingClientRect());
      animations.current = elements.map((element, index) => {
        const after = targets[index], old = before[index];
        const from = { translate: `${old.x - after.x}px ${old.y - after.y}px`, scale: `${old.width / after.width} ${old.height / after.height}` };
        const to = { translate: '0px 0px', scale: '1 1' };
        return element.animate([from, to], { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)' });
      });
      animations.current.push(...companionCards.map((element, index) => element.animate(
        open
          ? [companionStart[index], { opacity: 0, transform: 'translateY(-10px) scale(.98)' }]
          : [{ opacity: 0, transform: 'translateY(10px) scale(.98)' }, { opacity: 1, transform: 'none' }],
        { duration: open ? 220 : 320, delay: (open ? 0 : 240) + index * 45, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' }
      )));
      const current = animations.current;
      Promise.allSettled(current.map(animation => animation.finished)).then(() => {
        if (animations.current === current) {
          companions.forEach(clearCompanionExit);
          current.forEach(animation => animation.cancel());
          flushSync(() => setReady(open));
          delete card.dataset.animating;
          delete home.dataset.layoutAnimating;
        }
      });
    } else { delete card.dataset.animating; delete home.dataset.layoutAnimating; }
    (open ? closeRef : toggleRef).current?.focus({ preventScroll: true });
  }
  const actions = <div className="activity-range" role="group" aria-label="贡献时间范围">
    {data.years.map(({ year }) => { const value = String(year), label = value; return <button key={value} type="button" aria-pressed={period === value} onClick={() => { setPeriod(value); setSelectedDate(null); }}>{label}</button>; })}
  </div>;
  if (!expanded) return <button ref={toggleRef} id="activity-toggle" className="activity-launcher" type="button" aria-expanded="false" aria-controls="activity-panel" onClick={() => toggle(true)}>
    <span className="activity-launcher-icon" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></span>
    <h2 id="activity-title">Github Activity<br />Heatmap</h2>
    <span className="activity-launcher-total">今年共 <strong>{annualTotal.toLocaleString('en-US')}</strong> 次贡献</span>
    <span className="activity-launcher-hint">展开活动日历 <span aria-hidden="true">↗</span></span>
  </button>;
  return <div id="activity-panel" className="activity-panel" onKeyDown={event => {
    if (event.key === 'Escape' && !event.target.closest('[role="grid"]')) { event.stopPropagation(); toggle(false); }
  }}>
    <header className="activity-header">
      <div><span className="activity-eyebrow">A LITTLE EVERY DAY</span><h2 id="activity-title">Github Activity Heatmap<span aria-hidden="true">.</span></h2></div>
      <button ref={closeRef} className="activity-collapse" type="button" aria-label="收起活动日历" aria-expanded="true" aria-controls="activity-panel" onClick={() => toggle(false)}>收起 <span aria-hidden="true">↙</span></button>
    </header>
    <div className="activity-component">
      {ready ? <ActivityHeatmap days={days} label={`2cux 的 GitHub 贡献：${period}`} period={period} thresholds={thresholds} className="activity-arc" selectedDate={selectedDate} onSelectDate={setSelectedDate} actions={actions} /> : <HeatmapPlaceholder days={days} period={period} actions={actions} />}
    </div>
    <div className="activity-bottom"><a className="activity-note" href="https://github.com/2cux" target="_blank" rel="noopener noreferrer">@2cux ↗</a><span className="activity-sync">{calendar.stale ? `最近同步 ${new Date(calendar.fetchedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · 已保存记录` : `最近同步 ${new Date(calendar.fetchedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · 每天自动同步`}</span></div>
  </div>;
}

export function mountActivity() {
  const card = document.querySelector('.activity-card');
  const root = createRoot(document.querySelector('#activity-root'));
  const controller = new AbortController();
  let disposed = false, pending = false, lastDay = null, timer, previousData;
  const today = () => new Date().toLocaleDateString('en-CA');
  function schedule(delay) {
    clearTimeout(timer);
    const next = new Date(); next.setHours(24, 5, 0, 0);
    timer = setTimeout(() => { if (document.hidden) schedule(); else load(); }, delay ?? Math.max(1000, +next - Date.now()));
  }
  async function loadYear(year) {
    for (const url of [`/api/github/activity?year=${year}`, `/data/github-activity-${year}.json`]) {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error('Activity unavailable');
        const data = await response.json();
        const length = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
        if (data.year !== year || !Array.isArray(data.days) || data.days.length !== length || data.days.some(day => !/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !day.date.startsWith(String(year)) || !Number.isInteger(day.count) || day.count < 0)) throw new Error('Invalid calendar');
        data.days.sort((a, b) => a.date.localeCompare(b.date));
        const previous = previousData?.years.find(item => item.year === year);
        if (previous && Date.parse(previous.fetchedAt) > Date.parse(data.fetchedAt)) return { ...previous, stale: true };
        return { ...data, stale: data.stale || url.startsWith('/data/') };
      } catch { if (disposed) throw new Error('Disposed'); }
    }
    throw new Error('Year unavailable');
  }
  async function load() {
    if (pending || disposed) return;
    pending = true; let failed = false;
    try {
      const year = new Date().getFullYear();
      const years = await Promise.all([year, year - 1, year - 2].map(loadYear));
      if (!disposed) { previousData = { years }; lastDay = today(); root.render(<GitHubActivity data={previousData} />); card.setAttribute('aria-busy', 'false'); }
    } catch {
      if (disposed) return;
      failed = true;
      card.setAttribute('aria-busy', 'false');
      if (previousData) return;
      root.render(<p className="activity-loading" role="status">暂时无法读取贡献记录。<a href="https://github.com/2cux">查看 GitHub ↗</a></p>);
    } finally { pending = false; if (!disposed) schedule(failed ? 60_000 : undefined); }
  }
  function onVisible() { if (!document.hidden && lastDay !== today()) load(); }
  document.addEventListener('visibilitychange', onVisible);
  load();
  return () => { disposed = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); controller.abort(); root.unmount(); };
}
