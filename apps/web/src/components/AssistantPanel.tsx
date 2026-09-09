import { useState, type FormEvent } from "react";
import { ArrowUp, LoaderCircle } from "lucide-react";

import type { AssistantReply, AssistantRequest } from "@fantasy-football/shared";

interface AssistantMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  sources?: string[];
}

interface AssistantPanelProps {
  hasSavedTeam: boolean;
  teamDirty: boolean;
  teamName: string;
  loading: boolean;
  error: string | null;
  onAsk: (request: AssistantRequest) => Promise<AssistantReply>;
  onOpenTeam: () => void;
}

const QUICK_QUESTIONS = [
  "Who are my highest-confidence starters this week?",
  "What is the biggest risk in my current lineup?",
  "How does my matchup look this week?",
  "Are there any trades worth considering?"
];

export function AssistantPanel({
  hasSavedTeam,
  teamDirty,
  teamName,
  loading,
  error,
  onAsk,
  onOpenTeam
}: AssistantPanelProps) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [nextId, setNextId] = useState(1);
  const canAsk = hasSavedTeam && !teamDirty && !loading;

  async function submit(message = draft) {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || !canAsk) return;

    setMessages((current) => [...current, { id: nextId, role: "user", text: trimmedMessage }]);
    setNextId((current) => current + 1);
    setDraft("");

    try {
      // Previous assistant answers can be long. The API only needs the manager's
      // earlier questions because it rebuilds current roster and league context.
      const history = messages
        .filter((message) => message.role === "user")
        .slice(-6)
        .map(({ role, text }) => ({ role, text }));
      const reply = await onAsk({ message: trimmedMessage, history });
      setMessages((current) => [...current, { id: nextId + 1, role: "assistant", text: reply.answer, sources: reply.sources }]);
      setNextId((current) => current + 2);
    } catch {
      // The parent surfaces the request error in the persistent panel state.
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  return (
    <section className="panel assistant-panel" aria-labelledby="assistant-heading">
      <div className="section-header assistant-header">
        <div>
          <p className="eyebrow">Your fantasy assistant</p>
          <h2 id="assistant-heading">Let's talk about your team</h2>
        </div>
        <span className="status-pill">AI</span>
      </div>

      {!hasSavedTeam && <AssistantGate message="Save a team before asking for personalized guidance." onOpenTeam={onOpenTeam} />}
      {hasSavedTeam && teamDirty && <AssistantGate message="Save your roster and settings before asking about the current team." onOpenTeam={onOpenTeam} />}

      {hasSavedTeam && !teamDirty && (
        <>
          <p className="assistant-context">
            What are you considering for {teamName || "your team"} this week?
          </p>

          {messages.length > 0 && (
            <div className="assistant-messages" aria-live="polite" aria-label="Assistant conversation">
              {messages.map((message) => (
                <article className={`assistant-message assistant-message-${message.role}`} key={message.id}>
                  <strong>{message.role === "user" ? "You" : "Assistant"}</strong>
                  <p>{message.text}</p>
                  {message.sources && <small>{message.sources.join(" / ")}</small>}
                </article>
              ))}
            </div>
          )}

          {messages.length === 0 && (
            <div className="assistant-questions" aria-label="Suggested assistant questions">
              {QUICK_QUESTIONS.map((question) => (
                <button className="assistant-question" type="button" key={question} disabled={!canAsk} onClick={() => void submit(question)}>
                  {question}
                </button>
              ))}
            </div>
          )}

          <form className="assistant-form" onSubmit={handleSubmit}>
            <label className="field" htmlFor="assistant-question">
              <span>Question</span>
              <textarea
                id="assistant-question"
                value={draft}
                maxLength={1_200}
                rows={3}
                placeholder="Ask about your lineup, matchup, waiver options, or a trade idea"
                disabled={!canAsk}
                onChange={(event) => setDraft(event.target.value)}
              />
            </label>
            <button className="generate-button" type="submit" title={loading ? "Thinking..." : "Send question"} aria-label={loading ? "Thinking..." : "Send question"} disabled={!canAsk || !draft.trim()}>
              {loading ? <LoaderCircle size={18} className="spinning"/> : <ArrowUp size={18}/>}
            </button>
          </form>
        </>
      )}

      {error && <p className="error assistant-error" role="alert">{error}</p>}
      <p className="assistant-disclosure">Guidance explains the app’s current data. It does not submit lineup changes, claims, or trades.</p>
    </section>
  );
}

function AssistantGate({ message, onOpenTeam }: { message: string; onOpenTeam: () => void }) {
  return (
    <div className="assistant-gate">
      <p>{message}</p>
      <button className="utility-button" type="button" onClick={onOpenTeam}>Open Settings</button>
    </div>
  );
}
