// Bahlman motion templates (Remotion). Each one is an overlay on footage — transparent background unless it says otherwise —
// driven entirely by props, so the storyboard can fill it with the reel's names, words and the client's brand kit.
import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from 'remotion';
import { Base, brandOf, inOut, ramp, safe, useFonts, ease } from './shared';

const letters = (s: string) => [...s];

/* ── Lower third: name + role ───────────────────────────────────────────── */
export type LowerThirdProps = Base & { name: string; role?: string; align?: 'left' | 'center' };
export const LowerThird: React.FC<LowerThirdProps> = ({ name = 'Jerry Norton', role = '', brand, format = '16:9', align = 'left' }) => {
  const b = brandOf(brand); useFonts([b.display, b.body]);
  const f = useCurrentFrame(); const { fps, durationInFrames, width } = useVideoConfig();
  const { enter, exit } = inOut(f, durationInFrames, fps, 0.9, 0.5);
  const s = safe(format); const v = format === '9:16';
  const nameSize = v ? 76 : 64, roleSize = v ? 34 : 28;
  const center = align === 'center' || v;
  const ruleW = ramp(f, 0.15 * fps, 0.85 * fps) * (v ? 360 : 300);
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: center ? 'center' : 'flex-start', padding: `0 ${s.x}px ${s.bottom + (v ? 120 : 30)}px` }}>
      <div style={{ opacity: 1 - exit, transform: `translateY(${exit * 24}px)`, textAlign: center ? 'center' : 'left', display: 'flex', flexDirection: 'column', alignItems: center ? 'center' : 'flex-start' }}>
        <div style={{ position: 'relative', padding: v ? '26px 40px 30px' : '20px 34px 24px', background: `linear-gradient(90deg, ${b.dark}e6, ${b.dark}b3)`, borderLeft: center ? 'none' : `4px solid ${b.primary}`, borderRadius: 6,
          clipPath: `inset(0 ${(1 - ramp(f, 0, 0.6 * fps)) * 100}% 0 0)`, boxShadow: '0 20px 60px rgba(0,0,0,.35)' }}>
          <div style={{ overflow: 'hidden', fontFamily: b.display, fontWeight: 700, fontSize: nameSize, letterSpacing: 2, color: b.ink, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
            {letters(name).map((c, i) => (
              <span key={i} style={{ display: 'inline-block', transform: `translateY(${(1 - ramp(f, 0.2 * fps + i * 1.1, 0.75 * fps + i * 1.1)) * 110}%)` }}>{c === ' ' ? ' ' : c}</span>
            ))}
          </div>
          <div style={{ height: 3, width: ruleW, background: b.primary, margin: v ? '14px auto 12px' : '12px 0 10px' }} />
          {role ? <div style={{ fontFamily: b.body, fontWeight: 600, fontSize: roleSize, letterSpacing: 6, textTransform: 'uppercase', color: b.primary, opacity: ramp(f, 0.55 * fps, 1.05 * fps), transform: `translateX(${(1 - ramp(f, 0.55 * fps, 1.1 * fps)) * -16}px)`, whiteSpace: 'nowrap' }}>{role}</div> : null}
        </div>
      </div>
      {width ? null : null}
    </AbsoluteFill>
  );
};

/* ── Title card: kicker / title / subtitle over footage ─────────────────── */
export type TitleCardProps = Base & { kicker?: string; title: string; subtitle?: string; scrim?: boolean };
export const TitleCard: React.FC<TitleCardProps> = ({ kicker = '', title = 'Owners Club', subtitle = '', brand, format = '16:9', scrim = true }) => {
  const b = brandOf(brand); useFonts([b.display, b.body]);
  const f = useCurrentFrame(); const { fps, durationInFrames } = useVideoConfig();
  const { exit } = inOut(f, durationInFrames, fps, 0.8, 0.5);
  const v = format === '9:16'; const words = title.split(' ');
  const size = Math.min(v ? 150 : 170, (v ? 1900 : 3000) / Math.max(6, title.length));
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      {scrim ? <AbsoluteFill style={{ background: `radial-gradient(70% 60% at 50% 50%, ${b.dark}b0, ${b.dark}33 70%, transparent)`, opacity: ramp(f, 0, 0.5 * fps) * (1 - exit) }} /> : null}
      <div style={{ opacity: 1 - exit, transform: `scale(${1 + exit * 0.04})`, padding: '0 80px' }}>
        {kicker ? <div style={{ fontFamily: b.body, fontWeight: 600, fontSize: v ? 34 : 30, letterSpacing: ramp(f, 0, 1.2 * fps, 30, 12), color: b.primary, textTransform: 'uppercase', opacity: ramp(f, 0.05 * fps, 0.6 * fps), marginBottom: 22 }}>{kicker}</div> : null}
        <div style={{ fontFamily: b.display, fontWeight: 700, fontSize: size, lineHeight: 1.04, color: b.ink, letterSpacing: 1, textShadow: '0 10px 40px rgba(0,0,0,.45)' }}>
          {words.map((w, wi) => (
            <span key={wi} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', margin: '0 .14em', paddingBottom: '.06em' }}>
              {letters(w).map((c, i) => { const k = wi * 4 + i; return <span key={i} style={{ display: 'inline-block', transform: `translateY(${(1 - ramp(f, 0.2 * fps + k * 1.2, 0.95 * fps + k * 1.2)) * 115}%)` }}>{c}</span>; })}
            </span>
          ))}
        </div>
        <div style={{ height: 4, width: ramp(f, 0.7 * fps, 1.5 * fps) * (v ? 420 : 560), background: b.primary, margin: '26px auto 22px' }} />
        {subtitle ? <div style={{ fontFamily: b.body, fontWeight: 500, fontSize: v ? 40 : 38, color: b.ink, opacity: ramp(f, 1.0 * fps, 1.6 * fps) * 0.9, transform: `translateY(${(1 - ramp(f, 1.0 * fps, 1.7 * fps)) * 18}px)` }}>{subtitle}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

/* ── Captions: social-style, a few words at a time, the spoken word lit ── */
export type CaptionsProps = Base & { text: string; words?: { w: string; t: number }[]; perLine?: number; position?: 'low' | 'middle' };
export const Captions: React.FC<CaptionsProps> = ({ text = 'This is the moment everything changed', words, perLine, brand, format = '16:9', position }) => {
  const b = brandOf(brand); useFonts([b.body, 'Anton']);
  const f = useCurrentFrame(); const { fps, durationInFrames } = useVideoConfig();
  const v = format === '9:16'; const n = perLine || (v ? 3 : 5);
  // timing: real word times when the transcript gave them, otherwise spread evenly
  const list = words && words.length ? words : text.split(/\s+/).filter(Boolean).map((w, i, a) => ({ w, t: (i / a.length) * (durationInFrames / fps) * 0.94 }));
  const now = f / fps; let cur = 0; list.forEach((x, i) => { if (x.t <= now) cur = i; });
  const start = Math.floor(cur / n) * n; const line = list.slice(start, start + n);
  const lineT = list[start] ? list[start].t : 0; const pop = ramp(now, lineT, lineT + 0.18);
  const pos = position || (v ? 'middle' : 'low');
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: pos === 'middle' ? 'center' : 'flex-end', paddingBottom: pos === 'middle' ? 0 : safe(format).bottom + 20, paddingTop: pos === 'middle' ? (v ? 520 : 0) : 0 }}>
      <div style={{ maxWidth: v ? 900 : 1500, textAlign: 'center', transform: `scale(${0.92 + pop * 0.08})`, opacity: ramp(f, 0, 4) * (1 - ramp(f, durationInFrames - 6, durationInFrames)) }}>
        {line.map((x, i) => {
          const on = start + i === cur;
          return <span key={start + i} style={{ display: 'inline-block', margin: '0 .16em', fontFamily: 'Anton', fontSize: v ? 104 : 86, lineHeight: 1.12, textTransform: 'uppercase', letterSpacing: 1,
            color: on ? b.primary : b.ink, transform: `translateY(${on ? -4 : 0}px) scale(${on ? 1.06 : 1})`, WebkitTextStroke: `3px ${b.dark}`, paintOrder: 'stroke fill',
            textShadow: '0 6px 24px rgba(0,0,0,.55)', opacity: x.t <= now + 0.02 ? 1 : 0.35 }}>{x.w}</span>;
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ── Stat callout: a number that counts up + what it means ─────────────── */
export type StatProps = Base & { value: number; prefix?: string; suffix?: string; label: string };
export const Stat: React.FC<StatProps> = ({ value = 2500, prefix = '', suffix = '+', label = 'investors in the room', brand, format = '16:9' }) => {
  const b = brandOf(brand); useFonts([b.display, b.body]);
  const f = useCurrentFrame(); const { fps, durationInFrames } = useVideoConfig();
  const { exit } = inOut(f, durationInFrames, fps, 0.8, 0.5); const v = format === '9:16';
  const n = Math.round(value * ramp(f, 0.1 * fps, 1.4 * fps));
  return (
    <AbsoluteFill style={{ alignItems: v ? 'center' : 'flex-start', justifyContent: 'center', padding: `0 ${safe(format).x + 40}px`, textAlign: v ? 'center' : 'left' }}>
      <div style={{ opacity: 1 - exit, transform: `translateY(${exit * -20}px)` }}>
        <div style={{ fontFamily: b.display, fontWeight: 700, fontSize: v ? 220 : 240, lineHeight: 1, color: b.primary, fontVariantNumeric: 'tabular-nums', textShadow: '0 12px 50px rgba(0,0,0,.5)', transform: `scale(${0.9 + 0.1 * ramp(f, 0, 0.6 * fps)})`, transformOrigin: v ? '50% 50%' : '0 50%' }}>
          {prefix}{n.toLocaleString('en-US')}{suffix}
        </div>
        <div style={{ height: 3, width: ramp(f, 0.5 * fps, 1.2 * fps) * 380, background: b.ink, opacity: 0.8, margin: v ? '18px auto' : '18px 0' }} />
        <div style={{ fontFamily: b.body, fontWeight: 600, fontSize: v ? 46 : 44, letterSpacing: 4, textTransform: 'uppercase', color: b.ink, opacity: ramp(f, 0.7 * fps, 1.3 * fps), textShadow: '0 4px 20px rgba(0,0,0,.6)' }}>{label}</div>
      </div>
    </AbsoluteFill>
  );
};

/* ── End card: wordmark/logo, line, call to action. Opaque by default. ─── */
export type EndCardProps = Base & { line?: string; cta?: string; date?: string; opaque?: boolean };
export const EndCard: React.FC<EndCardProps> = ({ line = 'See you at the next one', cta = '', date = '', opaque = true, brand, format = '16:9' }) => {
  const b = brandOf(brand); useFonts([b.display, b.body]);
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const v = format === '9:16';
  const bg = ramp(f, 0, 0.5 * fps);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      {opaque ? <AbsoluteFill style={{ background: `radial-gradient(80% 70% at 50% 45%, ${b.dark}, #000)`, opacity: bg }} /> : null}
      <div style={{ transform: `translateY(${(1 - ramp(f, 0.2 * fps, 1.1 * fps)) * 30}px)`, opacity: ramp(f, 0.2 * fps, 0.9 * fps) }}>
        {b.logo ? <Img src={b.logo} style={{ height: v ? 160 : 140, objectFit: 'contain', marginBottom: 30 }} />
          : <div style={{ fontFamily: b.display, fontWeight: 700, fontSize: v ? 96 : 104, letterSpacing: ramp(f, 0.2 * fps, 1.6 * fps, 30, 10), color: b.ink }}>{b.wordmark}</div>}
        <div style={{ height: 3, width: ramp(f, 0.6 * fps, 1.4 * fps) * 300, background: b.primary, margin: '26px auto' }} />
        <div style={{ fontFamily: b.body, fontWeight: 500, fontSize: v ? 44 : 40, color: b.ink, opacity: ramp(f, 0.9 * fps, 1.5 * fps) * 0.9 }}>{line}</div>
        {cta || b.handle ? <div style={{ marginTop: 26, fontFamily: b.body, fontWeight: 700, fontSize: v ? 34 : 30, letterSpacing: 6, textTransform: 'uppercase', color: b.primary, opacity: ramp(f, 1.2 * fps, 1.8 * fps) }}>{cta || b.handle}</div> : null}
        {date ? <div style={{ marginTop: 14, fontFamily: b.body, fontSize: 24, letterSpacing: 4, color: b.ink, opacity: ramp(f, 1.4 * fps, 2 * fps) * 0.6 }}>{date}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

export const _ease = ease;
