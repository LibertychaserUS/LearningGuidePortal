// A stand-in courseware deck for the whiteboard playground: four pages of a
// physics lesson. Real courseware comes from the course team and is built
// into the site; the board only needs "page n" underneath it.

import styles from "./whiteboard.module.css";

export const COURSEWARE_PAGES = 4;

function Foot({ page }: { page: number }) {
  return <div className={styles.slideFoot}><span>LG 物理 · 第 3 讲 · 力与运动</span><span>{page + 1} / {COURSEWARE_PAGES}</span></div>;
}

export function Courseware({ page }: { page: number }) {
  if (page === 0) {
    return (
      <div className={styles.slide}>
        <p className={styles.slideKicker}>Lecture 3 · Force and motion</p>
        <h3 className={styles.coverTitle}>牛顿第二定律</h3>
        <div className={styles.formula}>F = m a</div>
        <p style={{ color: "#475467" }}>物体的加速度与所受合力成正比，与质量成反比，方向与合力方向相同。</p>
        <Foot page={page} />
      </div>
    );
  }
  if (page === 1) {
    return (
      <div className={styles.slide}>
        <p className={styles.slideKicker}>概念</p>
        <h3>力、质量和加速度</h3>
        <div className={styles.columns}>
          <ul className={styles.bullets}>
            <li>合力 F 越大，加速度 a 越大</li>
            <li>质量 m 越大，同样的力产生的加速度越小</li>
            <li>加速度的方向始终与合力方向一致</li>
            <li>单位：1 N = 1 kg·m/s²</li>
          </ul>
          <div>
            <div className={styles.formulaBox}>a = F / m</div>
            <p style={{ color: "#667085", fontSize: "1.6cqw" }}>思考：同一辆小车，装满货物后用同样的力推，加速度怎样变化？</p>
          </div>
        </div>
        <Foot page={page} />
      </div>
    );
  }
  if (page === 2) {
    return (
      <div className={styles.slide}>
        <p className={styles.slideKicker}>例题</p>
        <h3>求木块的加速度</h3>
        <div className={styles.columns}>
          <div>
            <p>质量 <i>m</i> = 2 kg 的木块放在光滑水平面上，受到水平向右的拉力 <i>F</i> = 6 N。</p>
            <p>求木块的加速度 <i>a</i>。</p>
            <div className={styles.answerBox}>在这里写出解题过程</div>
          </div>
          <svg className={styles.figure} viewBox="0 0 400 240" aria-hidden="true">
            <line x1="20" y1="190" x2="380" y2="190" stroke="#98a2b3" strokeWidth="3" />
            {Array.from({ length: 12 }, (_, index) => <line key={index} x1={30 + index * 30} y1="190" x2={18 + index * 30} y2="205" stroke="#d0d5dd" strokeWidth="2" />)}
            <rect x="110" y="110" width="110" height="80" rx="6" fill="#eff4ff" stroke="#1d6bff" strokeWidth="3" />
            <text x="165" y="158" textAnchor="middle" fontSize="22" fontWeight="700" fill="#1849a9">2 kg</text>
            <line x1="220" y1="150" x2="330" y2="150" stroke="#f04438" strokeWidth="4" />
            <path d="M330 140 L350 150 L330 160 Z" fill="#f04438" />
            <text x="285" y="135" textAnchor="middle" fontSize="20" fontWeight="700" fill="#f04438">F = 6 N</text>
          </svg>
        </div>
        <Foot page={page} />
      </div>
    );
  }
  return (
    <div className={styles.slide}>
      <p className={styles.slideKicker}>课堂练习</p>
      <h3>画出受力示意图</h3>
      <div className={styles.columns}>
        <div>
          <p>木块静止在粗糙斜面上。</p>
          <p>请在右图的木块上画出：重力 <i>G</i>、支持力 <i>N</i>、摩擦力 <i>f</i>。</p>
          <p style={{ color: "#667085", fontSize: "1.6cqw" }}>提示：支持力垂直于斜面，摩擦力沿斜面向上。</p>
        </div>
        <svg className={styles.figure} viewBox="0 0 400 260" aria-hidden="true">
          <path d="M30 230 L370 230 L370 70 Z" fill="#f9fafb" stroke="#98a2b3" strokeWidth="3" />
          <g transform="rotate(-25.2 232 136)">
            <rect x="190" y="80" width="84" height="56" rx="5" fill="#eff4ff" stroke="#1d6bff" strokeWidth="3" />
          </g>
          <text x="330" y="222" fontSize="18" fill="#667085">θ</text>
        </svg>
      </div>
      <Foot page={page} />
    </div>
  );
}
