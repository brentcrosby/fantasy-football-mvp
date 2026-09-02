import { useState, type FormEvent } from "react";
import type { AuthCredentials } from "@fantasy-football/shared";

export type AuthMode = "login" | "register";

interface AuthScreenProps {
  loading: boolean;
  error: string | null;
  onSubmit: (mode: AuthMode, credentials: AuthCredentials) => Promise<void>;
}

export function AuthScreen({ loading, error, onSubmit }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(mode, { email, password });
  }

  return (
    <main className="auth-shell">
      <section className="auth-brand" aria-labelledby="auth-title">
        <div className="app-brand">
          <span className="brand-mark" aria-hidden="true">FF</span>
          <span>
            <strong>Lineup Assistant</strong>
            <small>Fantasy decision support</small>
          </span>
        </div>
        <div>
          <p className="eyebrow">Weekly Command Center</p>
          <h1 id="auth-title">Your roster.<br />Your call.</h1>
          <p className="subtitle">Build teams, review weekly risks, and generate an explainable starting lineup.</p>
        </div>
        <dl className="auth-scoreboard" aria-label="Application capabilities">
          <div><dt>Weeks</dt><dd>18</dd></div>
          <div><dt>Formats</dt><dd>3</dd></div>
          <div><dt>Engine</dt><dd>Rules</dd></div>
        </dl>
      </section>

      <section className="auth-panel" aria-labelledby="auth-form-heading">
        <div className="auth-mode" role="group" aria-label="Authentication mode">
          <button type="button" className={mode === "login" ? "is-active" : ""} onClick={() => setMode("login")}>Sign In</button>
          <button type="button" className={mode === "register" ? "is-active" : ""} onClick={() => setMode("register")}>Create Account</button>
        </div>

        <div className="auth-heading">
          <p className="eyebrow">Manager Access</p>
          <h2 id="auth-form-heading">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field" htmlFor="auth-email">
            <span>Email</span>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              maxLength={320}
              value={email}
              disabled={loading}
              required
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="field" htmlFor="auth-password">
            <span>Password</span>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={10}
              maxLength={128}
              value={password}
              disabled={loading}
              required
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error && <p className="error" role="alert">{error}</p>}

          <button className="generate-button auth-submit" type="submit" disabled={loading}>
            {loading ? "Working..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </section>
    </main>
  );
}
