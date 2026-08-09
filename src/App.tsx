import Header from './components/Header';
import CameraPreview from './components/CameraPreview';
import SessionControls from './components/SessionControls';
import TranslationOutput from './components/TranslationOutput';
import StatusBar from './components/StatusBar';
import { useTranslationPipeline } from './hooks/useTranslationPipeline';

export default function App() {
  const { state, stream, toggleSession, toggleTts, processLandmarkPayload } =
    useTranslationPipeline();

  const isRunning = state.status === 'running';
  const isBusy = state.status === 'initializing';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Skip link */}
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      {/* Header */}
      <Header />

      {/* Main content */}
      <main
        id="main-content"
        className="flex-1 flex flex-col items-center gap-5 px-4 py-6 max-w-3xl mx-auto w-full"
      >
        {/* Status bar */}
        <StatusBar
          status={state.status}
          error={state.error}
          latency={state.latency}
          handsDetected={state.handsDetected}
          sttConnected={state.sttConnected}
        />

        {/* Camera preview */}
        <CameraPreview
          stream={stream}
          hands={[]}
          isActive={isRunning}
          fps={state.fps}
          onLandmarksDetected={processLandmarkPayload}
        />

        {/* Session controls */}
        <SessionControls
          isRunning={isRunning}
          ttsEnabled={state.ttsEnabled}
          onToggleSession={toggleSession}
          onToggleTts={toggleTts}
          disabled={isBusy}
        />

        {/* Translation output */}
        <TranslationOutput
          currentSentence={state.currentSentence}
          transcript={state.transcript}
          confidence={
            state.transcript.length > 0
              ? state.transcript[state.transcript.length - 1].confidence
              : 0
          }
          isSpeaking={false}
        />

        {/* Footer */}
        <footer className="text-[10px] text-foreground/20 text-center mt-auto pt-4">
          SignPulseAI — Real-time ASL to English Translation
        </footer>
      </main>
    </div>
  );
}