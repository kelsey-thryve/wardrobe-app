"use client";
import Designer from "../Designer";
import { BRANDS } from "../../lib/brands";

const boston = BRANDS.boston;

// The Boston Wardrobes mark (the panel-and-rail lines, redrawn from their brochures) with the
// wordmark set in Lato Light.
function BostonLogo() {
  const v = (x, y1, y2) => <line key={`v${x}${y1}`} x1={x} y1={y1} x2={x} y2={y2} />;
  const h = (y, x1, x2) => <line key={`h${y}${x1}`} x1={x1} y1={y} x2={x2} y2={y} />;
  return (
    <a className="boston-logo" href="https://bostonwardrobes.co.nz" aria-label="Boston Wardrobes">
      <svg viewBox="0 0 150 286" aria-hidden="true">
        <g stroke="currentColor" strokeWidth="7" strokeLinecap="butt">
          {[4, 30, 56].map((x) => v(x, 0, 200))}
          {[224, 251, 278].map((y) => h(y, 0, 60))}
          {[4, 31, 58].map((y) => h(y, 84, 146))}
          {[88, 115, 142].map((x) => v(x, 84, 286))}
        </g>
      </svg>
      <span>Boston<br />Wardrobes</span>
    </a>
  );
}

function BostonFooter() {
  return (
    <footer className="boston-footer">
      <div className="strap">{boston.strapline}</div>
      <div className="foot">
        <span>{boston.contact}</span>
        <a href="https://bostonwardrobes.co.nz">{boston.site}</a>
      </div>
    </footer>
  );
}

export default function BostonPage() {
  return <Designer brand="boston" Logo={BostonLogo} Footer={BostonFooter} />;
}
