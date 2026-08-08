import { Header } from "./components/Header";
import { CameraPreview } from "./components/CameraPreview";
import { SessionControls } from "./components/SessionControls";
import { TranslationOutput } from "./components/TranslationOutput";
import { StatusBar } from "./components/StatusBar";
import { useTranslationPipeline } from "./hooks/useTranslationPipeline";

export default function App() {
  const {
    sessionState,
    currentSentence,
    transcriptHistory,
    status,
    isSpeaking,
    autoPlay,
    activeStream,
    startSession,
    stopSession,
    setAutoPlay,
  } = useTranslationPipeline();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[720px] mx-auto px-4 pb-12">
        <Header />

        <main className="space-y-5">
          {/* Camera preview */}
          <CameraPreview
            stream={activeStream}
            isLoading={sessionState === "starting"}
          />

          {/* Session controls */}
          <SessionControls
            sessionState={sessionState}
            autoPlay={autoPlay}
            onStart={startSession}
            onStop={stopSession}
            onToggleAutoPlay={() => setAutoPlay(!autoPlay)}
          />

          {/* Status bar — accessible live region */}
          <StatusBar status={status} />

          {/* Translation output */}
          <TranslationOutput
            currentSentence={currentSentence}
            transcriptHistory={transcriptHistory}
            isSpeaking={isSpeaking}
          />
        </main>
      </div>
    </div>
  );
}