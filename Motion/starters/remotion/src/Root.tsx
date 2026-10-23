import React from 'react';
import { Composition } from 'remotion';
import { CATALOG } from './catalog';
import { SIZE } from './shared';

// One composition per template. Size, length and fps come from the props the storyboard sends (format, seconds, fps).
export const Root: React.FC = () => (
  <>
    {CATALOG.map((t) => (
      <Composition key={t.id} id={t.id} component={t.component} fps={30} width={1920} height={1080} durationInFrames={Math.round(t.seconds * 30)}
        defaultProps={Object.fromEntries(t.params.map((p) => [p.id, p.default]))}
        calculateMetadata={({ props }: any) => {
          const fps = props.fps || 30; const s = SIZE[(props.format as '16:9' | '9:16') || '16:9'];
          return { fps, width: s.width, height: s.height, durationInFrames: Math.max(15, Math.round((props.seconds || t.seconds) * fps)) };
        }} />
    ))}
  </>
);
