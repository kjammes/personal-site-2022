import { useId } from 'react';
import { SPEEDS, setSpeed, useSpeed } from './speed';
import { Btn, VizFrame } from './VizFrame';

export default function SpeedControl() {
  const speed = useSpeed();
  const id = useId();
  return (
    <VizFrame label="Animation speed for every visualization on this page" minHeight={0} fullscreen={false}>
      <div style={{ width: '100%' }}>
        <p id={id} className="viz-group-label" style={{ textAlign: 'center', margin: '0 0 0.5rem', color: 'var(--muted)' }}>
          Change the animation speed
        </p>
        <div className="viz-speed" role="group" aria-labelledby={id}>
          {SPEEDS.map((s) => (
            <Btn key={s} aria-pressed={s === speed} onClick={() => setSpeed(s)}>
              {s * 100}%
            </Btn>
          ))}
        </div>
      </div>
    </VizFrame>
  );
}
