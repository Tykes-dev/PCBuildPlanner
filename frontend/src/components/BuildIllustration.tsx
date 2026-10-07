export function BuildIllustration() {
  return <div className="build-visual">
    <div className="visual-heading"><span className="eyebrow">THE PARTS. THE BIGGER PICTURE.</span><span className="visual-mark" aria-hidden="true">↗</span></div>
    <svg className="tower-drawing" viewBox="0 0 460 380" role="img" aria-label="PC tower showing processor, memory, graphics card, storage, and power supply">
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M119 49 299 29 348 62 348 318 168 345 119 311Z" className="tower-fill"/>
        <path d="M119 49 168 83 348 62M168 83V345M299 29V285L119 311"/>
        <path d="M184 98 330 81V294L184 318Z" className="board-fill"/>
        <path d="M205 116 251 110V160L205 166Z" className="chip-fill"/><path d="M213 124 243 120V152L213 156Z"/>
        <path d="M264 110V175M274 109V174M284 108V173" strokeWidth="5"/>
        <path d="M195 191 318 177V213L195 230Z" className="gpu-fill"/>
        <ellipse cx="226" cy="205" rx="13" ry="12"/><ellipse cx="285" cy="197" rx="13" ry="12"/>
        <path d="M206 245 270 235V248L206 258Z"/><path d="M183 280 330 257V294L183 318Z"/><path d="M193 290 242 282M193 299 242 291"/>
        <ellipse cx="143" cy="130" rx="12" ry="24"/><ellipse cx="143" cy="192" rx="12" ry="24"/><ellipse cx="143" cy="254" rx="12" ry="24"/>
        <path d="M129 320V333M325 323V337" strokeWidth="4"/>
        <path d="M226 139 370 117H416M277 150 372 152H416M291 199 371 218H416M238 244 371 267H416M223 291 77 304H43" className="leader-line"/>
      </g>
      <g className="diagram-label" fill="currentColor"><text x="374" y="108">CPU</text><text x="374" y="145">RAM</text><text x="374" y="210">GPU</text><text x="374" y="259">SSD</text><text x="43" y="296">PSU</text></g>
      <g className="diagram-dot"><circle cx="226" cy="139" r="4"/><circle cx="277" cy="150" r="4"/><circle cx="291" cy="199" r="4"/><circle cx="238" cy="244" r="4"/><circle cx="223" cy="291" r="4"/></g>
    </svg>
    <div className="visual-footer"><span>Seven parts.<br/><strong>One considered build.</strong></span><span className="visual-index" aria-hidden="true">07</span></div>
  </div>;
}
