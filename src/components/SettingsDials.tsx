const DIALS = [66, 180, 294] as const
const TICKS = Array.from({ length: 13 }, (_, index) => -120 + index * 20)

export function SettingsDials() {
  return (
    <div className="settings-dials" aria-hidden="true">
      <div className="settings-dials__backing" />
      <svg viewBox="0 0 360 190" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="356" height="186" rx="8" fill="#1B1D19" stroke="#E8CB5A" strokeWidth="2" />
        <rect x="8" y="8" width="344" height="174" rx="5" fill="none" stroke="#3A3D30" strokeWidth="1.5" />
        <g fill="#B38F25">
          <circle cx="18" cy="18" r="3.5" /><circle cx="342" cy="18" r="3.5" />
          <circle cx="18" cy="172" r="3.5" /><circle cx="342" cy="172" r="3.5" />
        </g>
        {DIALS.map((center, index) => <Dial key={center} center={center} index={index} />)}
        <g>
          <circle className="settings-dials__light settings-dials__light--green" cx="44" cy="160" r="5" />
          <circle className="settings-dials__light settings-dials__light--yellow" cx="62" cy="160" r="5" />
          <circle className="settings-dials__light settings-dials__light--red" cx="80" cy="160" r="5" />
        </g>
        <g fill="#101110" stroke="#E8CB5A" strokeWidth="1.8">
          <rect x="130" y="152" width="30" height="16" rx="8" /><rect x="170" y="152" width="30" height="16" rx="8" />
        </g>
        <circle cx="138" cy="160" r="6" fill="#9A9E8A" />
        <circle cx="192" cy="160" r="6" fill="#E8CB5A" />
        <circle cx="294" cy="160" r="12" fill="#1F221D" stroke="#E8CB5A" strokeWidth="2" />
        <line x1="294" y1="160" x2="294" y2="150" stroke="#E8CB5A" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  )
}

function Dial({ center, index }: { center: number; index: number }) {
  return (
    <g>
      <circle cx={center} cy="84" r="46" fill="#101110" stroke="#E8CB5A" strokeWidth="3" />
      <circle cx={center} cy="84" r="41" fill="none" stroke="#3A3D30" strokeWidth="1.5" />
      <g stroke="#C9C5B0" strokeWidth="1.6" strokeLinecap="round">
        {TICKS.map(angle => <line key={angle} x1={center} y1="46" x2={center} y2={angle % 40 === 0 ? 54 : 50} transform={`rotate(${angle} ${center} 84)`} />)}
      </g>
      <g className={`dial-needle dial-needle--${index + 1}`}>
        <line x1={center} y1="84" x2={center} y2="52" stroke="#EDEBDD" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={center} cy="84" r="5" fill="#E8CB5A" />
      </g>
    </g>
  )
}
