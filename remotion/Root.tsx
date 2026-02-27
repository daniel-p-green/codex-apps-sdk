import {Composition, Folder} from 'remotion';
import {
  OpenAIAppsCodexIntegrationDemo,
  type OpenAIAppsCodexIntegrationDemoProps
} from './scenes/OpenAIAppsCodexIntegrationDemo';

const DEFAULT_PROPS: OpenAIAppsCodexIntegrationDemoProps = {
  appName: 'Figma',
  futureApp: 'PowerPoint',
  reducedMotion: false
};

export const RemotionRoot = () => {
  return (
    <Folder name="CodexApps">
      <Composition
        id="OpenAIAppsCodexIntegrationDemo"
        component={OpenAIAppsCodexIntegrationDemo}
        durationInFrames={570}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={DEFAULT_PROPS}
      />
    </Folder>
  );
};
