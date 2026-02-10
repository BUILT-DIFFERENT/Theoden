import { useState } from "react";

import { uploadFeedback } from "@/app/services/cli/feedback";

export function TranscribePage() {
  const [transcript, setTranscript] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitTranscript = async () => {
    const trimmed = transcript.trim();
    if (!trimmed.length) {
      setError("Transcript content is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await uploadFeedback({
        classification: "transcript",
        includeLogs: false,
        reason: trimmed,
        threadId: null,
      });
      setMessage(
        `Transcript submitted. Associated thread: ${response.threadId || "n/a"}`,
      );
      setTranscript("");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit transcript.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="surface-panel p-5">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-400">
          Transcribe
        </p>
        <h1 className="mt-2 font-display text-2xl text-ink-50">
          Transcript intake
        </h1>
        <p className="mt-2 text-sm text-ink-300">
          Compatibility route for transcript ingestion and conversion into
          feedback-upload workflow.
        </p>
      </section>
      <section className="surface-panel animate-codex-dialog-enter p-4">
        <label
          className="text-xs uppercase tracking-[0.2em] text-ink-400"
          htmlFor="transcribe-input"
        >
          Transcript
        </label>
        <textarea
          id="transcribe-input"
          className="textarea-base mt-2 h-40"
          placeholder="Paste transcript to attach to a feedback report."
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
        />
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            className="btn-primary"
            onClick={() => {
              void submitTranscript();
            }}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Submit transcript"}
          </button>
          {message ? (
            <p className="text-xs text-emerald-300">{message}</p>
          ) : null}
          {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        </div>
      </section>
    </div>
  );
}
