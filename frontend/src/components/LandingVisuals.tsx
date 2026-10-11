import { pesos } from '../types';

// Presentational only. These are drawn slices of the real screens, so a visitor
// who cannot reach the planner yet still sees what the product does. The
// figures are sample values and the page says so.

const SPLIT: [string, number][] = [
  ['Graphics card', 18000], ['Processor', 9500], ['Motherboard', 6000], ['Memory', 5000],
  ['Storage', 4500], ['Power supply', 4000], ['Case', 3000]
];
const SPLIT_TOTAL = SPLIT.reduce((sum, [, amount]) => sum + amount, 0);

export function BudgetVisual() {
  return <div className="shot">
    <div className="shot-head">
      <span className="eyebrow">BUDGET SPLIT</span>
      <strong className="cell-num">{pesos(SPLIT_TOTAL)}</strong>
    </div>
    <div className="split-rows">
      {SPLIT.map(([label, amount]) => <div key={label}>
        <span className="split-label">{label}</span>
        <span className="split-track" aria-hidden="true"><span style={{ width: (amount / SPLIT[0][1]) * 100 + '%' }}/></span>
        <span className="split-amount cell-num">{pesos(amount)}</span>
      </div>)}
    </div>
    <p className="shot-foot">Gaming, seven categories. Lock any one of them and the rest divide what is left.</p>
  </div>;
}

export function CheckVisual() {
  return <div className="shot">
    <div className="shot-head">
      <span className="eyebrow">COMPATIBILITY</span>
      <span className="tag warning">Needs attention</span>
    </div>
    <ul className="check-rows">
      <li className="ok"><span className="check-part">Ryzen 5 5600</span><span className="check-spec">AM4</span></li>
      <li className="ok"><span className="check-part">B450M Pro-VDH</span><span className="check-spec">AM4 · DDR4</span></li>
      <li className="bad">
        <span className="check-part">Vengeance 32GB</span><span className="check-spec">DDR5</span>
        <p className="check-why">This board takes DDR4; the memory is DDR5.</p>
      </li>
    </ul>
    <div className="power-rows">
      <p><span>Estimated draw</span><strong className="cell-num">295W</strong></p>
      <p><span>With 30% headroom</span><strong className="cell-num">384W</strong></p>
      <p><span>Supply rating</span><strong className="cell-num">450W</strong></p>
    </div>
  </div>;
}

export function TrackVisual() {
  return <div className="shot">
    <div className="shot-head">
      <span className="eyebrow">YOUR BUILD</span>
      <span className="tag pass">Approved</span>
    </div>
    <p className="track-name">Streaming upgrade</p>
    <p className="track-sub">7 of 7 categories · <span className="cell-num">{pesos(58400)}</span> of <span className="cell-num">{pesos(60000)}</span></p>
    <ol className="track-steps">
      <li className="done"><span/>Saved to your account</li>
      <li className="done"><span/>Sent to the shop</li>
      <li className="done"><span/>Approved, parts confirmed</li>
      <li><span/>Ready to collect</li>
    </ol>
    <p className="shot-foot">A request keeps its own copy of the parts and prices, so editing the build later never rewrites it.</p>
  </div>;
}