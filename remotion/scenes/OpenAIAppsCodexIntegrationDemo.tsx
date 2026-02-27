import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig
} from 'remotion';
import type {CSSProperties, ReactNode} from 'react';

export type OpenAIAppsCodexIntegrationDemoProps = {
  appName: string;
  futureApp: string;
  reducedMotion?: boolean;
};

const TOKENS = {
  bgPrimary: '#0A0E13',
  bgSecondary: '#101722',
  surface: 'rgba(18, 27, 37, 0.78)',
  surfaceStrong: 'rgba(20, 31, 44, 0.92)',
  textPrimary: '#EFF5F8',
  textSecondary: '#9FB2BF',
  line: 'rgba(90, 120, 143, 0.34)',
  accentPrimary: '#10A37F',
  accentSecondary: '#7FE8CF',
  accentWarm: '#F2CC8F',
  success: '#58D6A3'
} as const;

const SCENE_DURATIONS = {
  intro: 120,
  architecture: 130,
  codexFlow: 130,
  proof: 95,
  roadmap: 95
} as const;

const TOTAL_FRAMES =
  SCENE_DURATIONS.intro +
  SCENE_DURATIONS.architecture +
  SCENE_DURATIONS.codexFlow +
  SCENE_DURATIONS.proof +
  SCENE_DURATIONS.roadmap;

const FONT_STACK =
  '"Avenir Next", "SF Pro Display", "Segoe UI", "Helvetica Neue", sans-serif';

const revealStyle = (
  frame: number,
  fps: number,
  delay: number,
  reducedMotion: boolean
): CSSProperties => {
  const localFrame = Math.max(0, frame - delay);

  const progress = spring({
    frame: localFrame,
    fps,
    durationInFrames: reducedMotion ? 8 : 24,
    config: {damping: reducedMotion ? 200 : 140, stiffness: 220}
  });

  const y = reducedMotion ? 0 : interpolate(progress, [0, 1], [18, 0]);

  return {
    opacity: progress,
    transform: `translateY(${y}px)`
  };
};

const Backdrop = ({globalFrame}: {globalFrame: number}) => {
  const driftX = interpolate(globalFrame, [0, TOTAL_FRAMES], [-30, 35], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const driftY = interpolate(globalFrame, [0, TOTAL_FRAMES], [20, -18], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 20% 0%, ${TOKENS.bgSecondary} 0%, ${TOKENS.bgPrimary} 58%)`
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: -260,
          transform: `translate(${driftX}px, ${driftY}px)`,
          background:
            'radial-gradient(circle at 15% 20%, rgba(16,163,127,0.14), transparent 34%), radial-gradient(circle at 76% 12%, rgba(127,232,207,0.08), transparent 30%), radial-gradient(circle at 68% 78%, rgba(242,204,143,0.08), transparent 28%)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.18,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '64px 64px'
        }}
      />
    </AbsoluteFill>
  );
};

const Shell = ({children}: {children: ReactNode}) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: '74px 88px 84px',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {children}
    </div>
  );
};

const Panel = ({
  children,
  style
}: {
  children: ReactNode;
  style?: CSSProperties;
}) => {
  return (
    <div
      style={{
        background: TOKENS.surface,
        border: `1px solid ${TOKENS.line}`,
        borderRadius: 28,
        backdropFilter: 'blur(6px)',
        boxShadow: '0 18px 48px rgba(0,0,0,0.34)',
        ...style
      }}
    >
      {children}
    </div>
  );
};

const Label = ({text, tone = 'default'}: {text: string; tone?: 'default' | 'accent'}) => {
  return (
    <span
      style={{
        alignSelf: 'flex-start',
        fontSize: 21,
        letterSpacing: 1.8,
        textTransform: 'uppercase',
        color: tone === 'accent' ? TOKENS.accentSecondary : TOKENS.textSecondary,
        padding: '9px 14px',
        borderRadius: 999,
        border: `1px solid ${tone === 'accent' ? TOKENS.accentPrimary : TOKENS.line}`,
        background: 'rgba(13, 19, 28, 0.72)'
      }}
    >
      {text}
    </span>
  );
};

const IntroScene = ({reducedMotion}: {reducedMotion: boolean}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <Shell>
      <div style={{display: 'flex', flexDirection: 'column', gap: 26}}>
        <div style={revealStyle(frame, fps, 0, reducedMotion)}>
          <Label text="OpenAI Demo" tone="accent" />
        </div>

        <div style={revealStyle(frame, fps, 8, reducedMotion)}>
          <h1
            style={{
              margin: 0,
              color: TOKENS.textPrimary,
              fontSize: 108,
              lineHeight: 1.02,
              letterSpacing: -2.6,
              maxWidth: 1450,
              fontWeight: 650
            }}
          >
            Apps SDK + Codex
            <br />
            One Integration Surface
          </h1>
        </div>

        <div style={revealStyle(frame, fps, 20, reducedMotion)}>
          <p
            style={{
              margin: 0,
              color: TOKENS.textSecondary,
              fontSize: 38,
              lineHeight: 1.28,
              maxWidth: 1320
            }}
          >
            Build once with a host-agnostic MCP backend. Light up inline UI when supported.
            Stay productive with tool-first fallback everywhere.
          </p>
        </div>
      </div>

      <div style={{flex: 1}} />

      <div style={revealStyle(frame, fps, 26, reducedMotion)}>
        <Panel style={{padding: '24px 30px', display: 'inline-flex', alignItems: 'center', gap: 16}}>
          <span style={{fontSize: 26, color: TOKENS.accentWarm}}>Now validated with live app mentions.</span>
        </Panel>
      </div>
    </Shell>
  );
};

const ArchitectureScene = ({reducedMotion}: {reducedMotion: boolean}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <Shell>
      <div style={revealStyle(frame, fps, 0, reducedMotion)}>
        <Label text="Dual-Mode Architecture" />
      </div>

      <div style={{height: 22}} />

      <div style={revealStyle(frame, fps, 8, reducedMotion)}>
        <h2
          style={{
            margin: 0,
            fontSize: 74,
            lineHeight: 1.08,
            color: TOKENS.textPrimary,
            fontWeight: 620,
            letterSpacing: -1.5
          }}
        >
          Shared backend. Host-aware experience.
        </h2>
      </div>

      <div style={{height: 34}} />

      <div
        style={{
          ...revealStyle(frame, fps, 18, reducedMotion),
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24
        }}
      >
        <Panel style={{padding: 30, minHeight: 360, display: 'flex', flexDirection: 'column', gap: 16}}>
          <span style={{fontSize: 22, color: TOKENS.accentSecondary, letterSpacing: 0.2}}>
            ChatGPT Hosts
          </span>
          <h3 style={{margin: 0, fontSize: 42, color: TOKENS.textPrimary, lineHeight: 1.1, fontWeight: 600}}>
            Optional iframe UI
          </h3>
          <p style={{margin: 0, fontSize: 28, lineHeight: 1.28, color: TOKENS.textSecondary}}>
            Use Apps SDK UI metadata and bridge events for rich, inline app surfaces.
          </p>
        </Panel>

        <Panel style={{padding: 30, minHeight: 360, display: 'flex', flexDirection: 'column', gap: 16}}>
          <span style={{fontSize: 22, color: TOKENS.accentSecondary, letterSpacing: 0.2}}>Codex Hosts</span>
          <h3 style={{margin: 0, fontSize: 42, color: TOKENS.textPrimary, lineHeight: 1.1, fontWeight: 600}}>
            Tools-first inline flow
          </h3>
          <p style={{margin: 0, fontSize: 28, lineHeight: 1.28, color: TOKENS.textSecondary}}>
            Trigger connectors through mentions and MCP tools with clear text output fallback.
          </p>
        </Panel>
      </div>

      <div style={{height: 24}} />

      <div style={revealStyle(frame, fps, 28, reducedMotion)}>
        <Panel style={{padding: '24px 30px', background: TOKENS.surfaceStrong}}>
          <span style={{fontSize: 27, color: TOKENS.textPrimary}}>
            Core rule: keep business logic inside data tools so every host remains fully functional.
          </span>
        </Panel>
      </div>
    </Shell>
  );
};

const Chip = ({text}: {text: string}) => (
  <span
    style={{
      fontSize: 24,
      color: TOKENS.textPrimary,
      padding: '10px 16px',
      borderRadius: 999,
      border: `1px solid ${TOKENS.line}`,
      background: 'rgba(6, 12, 18, 0.72)'
    }}
  >
    {text}
  </span>
);

const CodexFlowScene = ({appName, reducedMotion}: {appName: string; reducedMotion: boolean}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const blink = Math.floor(frame / 20) % 2 === 0 ? 1 : 0.35;

  return (
    <Shell>
      <div style={revealStyle(frame, fps, 0, reducedMotion)}>
        <Label text="Codex Mention Flow" tone="accent" />
      </div>

      <div style={{height: 20}} />

      <div style={revealStyle(frame, fps, 8, reducedMotion)}>
        <h2
          style={{
            margin: 0,
            fontSize: 72,
            lineHeight: 1.08,
            color: TOKENS.textPrimary,
            fontWeight: 620,
            letterSpacing: -1.4
          }}
        >
          Mention app. Execute tools. Return outcome.
        </h2>
      </div>

      <div style={{height: 34}} />

      <div style={{...revealStyle(frame, fps, 18, reducedMotion), display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 24}}>
        <Panel style={{padding: 30, minHeight: 390, display: 'flex', flexDirection: 'column', gap: 16}}>
          <span style={{fontSize: 21, color: TOKENS.textSecondary}}>Runtime input</span>
          <code style={{fontSize: 30, color: TOKENS.textPrimary}}>$${appName.toLowerCase()} list available actions</code>
          <code style={{fontSize: 30, color: TOKENS.textPrimary}}>mention: app://connector_...</code>
          <div style={{height: 2, background: TOKENS.line, marginTop: 8, marginBottom: 4}} />
          <span style={{fontSize: 21, color: TOKENS.textSecondary}}>Observed tool activity</span>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 12}}>
            <Chip text="whoami" />
            <Chip text="list_mcp_resources" />
            <Chip text="read_mcp_resource" />
          </div>
        </Panel>

        <Panel style={{padding: 30, minHeight: 390, display: 'flex', flexDirection: 'column', gap: 18}}>
          <span style={{fontSize: 21, color: TOKENS.textSecondary}}>Behavior guarantee</span>
          <h3 style={{margin: 0, fontSize: 40, lineHeight: 1.12, color: TOKENS.textPrimary, fontWeight: 590}}>
            Works without iframe bridge.
          </h3>
          <p style={{margin: 0, fontSize: 27, color: TOKENS.textSecondary, lineHeight: 1.28}}>
            Codex can still complete the task using plain tool calls and response synthesis.
          </p>
          <p style={{margin: 0, fontSize: 24, color: TOKENS.accentSecondary, opacity: blink}}>
            turn/completed received
          </p>
        </Panel>
      </div>
    </Shell>
  );
};

const Metric = ({label, value}: {label: string; value: string}) => (
  <Panel style={{padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 170}}>
    <span style={{fontSize: 22, color: TOKENS.textSecondary}}>{label}</span>
    <span style={{fontSize: 46, color: TOKENS.textPrimary, fontWeight: 640, letterSpacing: -1}}>{value}</span>
  </Panel>
);

const ProofScene = ({reducedMotion}: {reducedMotion: boolean}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const pulse = interpolate(frame, [0, SCENE_DURATIONS.proof], [0.8, 1], {
    easing: Easing.inOut(Easing.quad),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  return (
    <Shell>
      <div style={revealStyle(frame, fps, 0, reducedMotion)}>
        <Label text="Spike Result" tone="accent" />
      </div>
      <div style={{height: 18}} />
      <div style={revealStyle(frame, fps, 8, reducedMotion)}>
        <h2 style={{margin: 0, fontSize: 70, color: TOKENS.textPrimary, lineHeight: 1.1, letterSpacing: -1.2}}>
          Live smoke test passed.
        </h2>
      </div>
      <div style={{height: 30}} />

      <div style={{...revealStyle(frame, fps, 14, reducedMotion), display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20}}>
        <Metric label="ok" value="true" />
        <Metric label="summary.sawToolCall" value="true" />
        <Metric label="summary.sawTurnCompleted" value="true" />
        <Metric label="mcpServers" value="figma + codex" />
      </div>

      <div style={{height: 20}} />

      <div style={revealStyle(frame, fps, 20, reducedMotion)}>
        <Panel style={{padding: '24px 30px', transform: `scale(${pulse})`}}>
          <span style={{fontSize: 28, color: TOKENS.success}}>Production path: tool-first now, UI enhancement when host supports bridge.</span>
        </Panel>
      </div>
    </Shell>
  );
};

const RoadmapScene = ({appName, futureApp, reducedMotion}: OpenAIAppsCodexIntegrationDemoProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <Shell>
      <div style={revealStyle(frame, fps, 0, reducedMotion)}>
        <Label text="Practical Rollout" />
      </div>

      <div style={{height: 20}} />

      <div style={revealStyle(frame, fps, 8, reducedMotion)}>
        <h2
          style={{
            margin: 0,
            fontSize: 68,
            lineHeight: 1.08,
            color: TOKENS.textPrimary,
            letterSpacing: -1.4,
            fontWeight: 620
          }}
        >
          {appName} today. {futureApp} next.
          <br />
          Any chat-to-BT app after that.
        </h2>
      </div>

      <div style={{height: 32}} />

      <div style={{...revealStyle(frame, fps, 16, reducedMotion), display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18}}>
        <Panel style={{padding: 24, minHeight: 220}}>
          <p style={{margin: 0, fontSize: 32, lineHeight: 1.22, color: TOKENS.textPrimary}}>Design actions in {appName}</p>
        </Panel>
        <Panel style={{padding: 24, minHeight: 220}}>
          <p style={{margin: 0, fontSize: 32, lineHeight: 1.22, color: TOKENS.textPrimary}}>Slide generation in {futureApp}</p>
        </Panel>
        <Panel style={{padding: 24, minHeight: 220}}>
          <p style={{margin: 0, fontSize: 32, lineHeight: 1.22, color: TOKENS.textPrimary}}>Workflow-specific enterprise tools</p>
        </Panel>
      </div>

      <div style={{flex: 1}} />

      <div style={revealStyle(frame, fps, 26, reducedMotion)}>
        <p style={{margin: 0, fontSize: 30, color: TOKENS.textSecondary}}>
          One MCP foundation. Host-aware delivery. OpenAI-native developer ergonomics.
        </p>
      </div>
    </Shell>
  );
};

export const OpenAIAppsCodexIntegrationDemo = ({
  appName,
  futureApp,
  reducedMotion = false
}: OpenAIAppsCodexIntegrationDemoProps) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        fontFamily: FONT_STACK,
        color: TOKENS.textPrimary,
        backgroundColor: TOKENS.bgPrimary
      }}
    >
      <Backdrop globalFrame={frame} />

      <Sequence from={0} durationInFrames={SCENE_DURATIONS.intro} premountFor={30}>
        <IntroScene reducedMotion={reducedMotion} />
      </Sequence>

      <Sequence
        from={SCENE_DURATIONS.intro}
        durationInFrames={SCENE_DURATIONS.architecture}
        premountFor={30}
      >
        <ArchitectureScene reducedMotion={reducedMotion} />
      </Sequence>

      <Sequence
        from={SCENE_DURATIONS.intro + SCENE_DURATIONS.architecture}
        durationInFrames={SCENE_DURATIONS.codexFlow}
        premountFor={30}
      >
        <CodexFlowScene appName={appName} reducedMotion={reducedMotion} />
      </Sequence>

      <Sequence
        from={SCENE_DURATIONS.intro + SCENE_DURATIONS.architecture + SCENE_DURATIONS.codexFlow}
        durationInFrames={SCENE_DURATIONS.proof}
        premountFor={30}
      >
        <ProofScene reducedMotion={reducedMotion} />
      </Sequence>

      <Sequence
        from={
          SCENE_DURATIONS.intro +
          SCENE_DURATIONS.architecture +
          SCENE_DURATIONS.codexFlow +
          SCENE_DURATIONS.proof
        }
        durationInFrames={SCENE_DURATIONS.roadmap}
        premountFor={30}
      >
        <RoadmapScene appName={appName} futureApp={futureApp} reducedMotion={reducedMotion} />
      </Sequence>
    </AbsoluteFill>
  );
};
