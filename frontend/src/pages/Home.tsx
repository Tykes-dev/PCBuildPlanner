import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/axios';
import { BuildIllustration } from '../components/BuildIllustration';
import { BudgetVisual, CheckVisual, TrackVisual } from '../components/LandingVisuals';
import { ShowcaseBuilds } from '../components/ShowcaseBuilds';
import type { Component } from '../types';

const FAQ: [string, string][] = [
  ['Do I have to know hardware already?', 'No. Say what the PC is for and what you can spend, and the planner picks a starting set of parts you can change afterwards.'],
  ['Does it actually sell me anything?', 'No. This plans builds and sends them to the shop for review. There is no cart and no payment.'],
  ['What if my use case is not listed?', 'Send it to the shop. They put a parts list together by hand and send it back for you to accept or decline.'],
  ['Are the prices real?', 'They are sample values for coursework. The compatibility rules, the budget maths, and the stock checks all work on those values.']
];

const FEATURES: { eyebrow: string; title: string; body: string; to: string; action: string; visual: () => React.ReactElement }[] = [
  {
    eyebrow: 'BUDGET FIRST',
    title: 'Say what you can spend.',
    body: 'One figure in pesos is enough to start. It is divided across all seven parts by what you need the PC for, and you can pin any category to a fixed amount and let the rest share what is left.',
    to: '/recommend', action: 'Find a build', visual: BudgetVisual
  },
  {
    eyebrow: 'CHECKED AS YOU CHOOSE',
    title: 'Nothing that does not fit.',
    body: 'Socket, memory type, case size, and power headroom are checked against what you have already picked. A part that cannot work is switched off before you can choose it, with the reason written out.',
    to: '/components', action: 'Explore the catalog', visual: CheckVisual
  },
  {
    eyebrow: 'FROM DRAFT TO COUNTER',
    title: 'Save it, then send it.',
    body: 'Keep as many drafts as you want, reopen any of them at current prices, and send the one you settle on to the shop. You follow its status from the same page you saved it on.',
    to: '/builds', action: 'See saved builds', visual: TrackVisual
  }
];

export function Home({ guest = false }: { guest?: boolean }) {
  const [parts, setParts] = useState<number | null>(null);

  // The catalog is public, so the headline figure can be the real one rather
  // than a number typed into the page. A failure just leaves it out.
  useEffect(() => {
    let cancelled = false;
    api.get<Component[]>('/components')
      .then(response => { if (!cancelled) setParts(response.data.length); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  return <>
    <section className="hero hero-layout">
      <div className="hero-copy">
        <span className="eyebrow hero-kicker"><span aria-hidden="true"/> BUILT AROUND YOU</span>
        <h1>Good parts.<br/>Better together<span className="signal-text">.</span></h1>
        <p>A PC that fits your needs. A budget that makes sense. Bring every part together, with compatibility checks along the way.</p>
        <div className="flex flex-wrap gap-3 mt-7">
          <Link className="button light" to={guest ? '/auth' : '/recommend'}>{guest ? 'Log in / Register' : 'Find my build'} <span aria-hidden="true">↗</span></Link>
          <Link className="button hero-link" to={guest ? '/components' : '/builder'}>{guest ? 'Browse components' : 'Build it myself'} <span aria-hidden="true">→</span></Link>
        </div>
        <p className="hero-small">Your budget. Your choices. A clearer starting point.</p>
      </div>
      <BuildIllustration/>
    </section>

    <div className="fact-strip">
      <div><strong className="cell-num">{parts ?? '—'}</strong><span>parts in the catalog</span></div>
      <div><strong className="cell-num">7</strong><span>categories in every build</span></div>
      <div><strong className="cell-num">4</strong><span>checks before you pay</span></div>
      <div><strong className="cell-num">₱</strong><span>planned in pesos</span></div>
    </div>

    {/* Alternating sides. A landing page that runs as one centred column reads
        as a document rather than a page selling something. */}
    {FEATURES.map((feature, index) => {
      const Visual = feature.visual;
      return <section className={'feature-row' + (index % 2 ? ' flipped' : '')} key={feature.title}>
        <div className="feature-copy">
          <span className="eyebrow">{feature.eyebrow}</span>
          <h2>{feature.title}</h2>
          <p>{feature.body}</p>
          <Link className="text-link" to={guest ? '/auth' : feature.to}>{guest ? 'Sign in to start' : feature.action} <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="feature-visual"><Visual/></div>
      </section>;
    })}

    <ShowcaseBuilds guest={guest}/>

    <section className="faq-section" aria-labelledby="faq-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">BEFORE YOU START</span>
          <h2 id="faq-heading">Questions people ask.</h2>
        </div>
      </div>
      <dl className="faq-grid">
        {FAQ.map(([question, answer]) => <div key={question}>
          <dt>{question}</dt>
          <dd>{answer}</dd>
        </div>)}
      </dl>
    </section>

    <section className="cta-band">
      <div>
        <span className="eyebrow">READY WHEN YOU ARE</span>
        <h2>Seven parts. One budget.<br/>No guessing<span className="signal-text">.</span></h2>
      </div>
      <div className="cta-actions">
        <Link className="button light" to={guest ? '/auth?mode=register' : '/recommend'}>{guest ? 'Create an account' : 'Find my build'} <span aria-hidden="true">↗</span></Link>
        <Link className="button hero-link" to="/components">Browse the catalog <span aria-hidden="true">→</span></Link>
      </div>
    </section>

    <p className="catalog-note">Tower components only. Catalog prices and performance scores are sample values for demonstration.</p>
  </>;
}