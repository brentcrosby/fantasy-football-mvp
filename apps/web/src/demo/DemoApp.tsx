import { useMemo, useState } from "react";
import { ArrowRight, RotateCcw, Shield, Swords, Trophy, Users } from "lucide-react";
import { LeaguePanel } from "../components/LeaguePanel";
import { TeamLineup } from "../components/TeamLineup";
import { MatchupView } from "../components/TeamBriefing";
import { buildSampleLeague, demoSettings, demoTimestamp } from "./sampleLeague";
import "./demo.css";

export default function DemoApp() {
  const [view, setView] = useState("My Team");
  const [injured, setInjured] = useState(false);
  const { overview, report } = useMemo(() => buildSampleLeague(injured), [injured]);
  function navigate(next: string) {
    setView(next);
    window.scrollTo({ top: 0 });
  }
  function reset() {
    setInjured(false);
  }
  return (
    <div className="fantasy-app demo-app">
      <a className="skip-link" href="#demo-content">
        Skip to content
      </a>
      <aside className="workspace-sidebar">
        <a className="product-wordmark" href="/demo">
          <span className="wordmark-icon">
            <Shield size={21} />
          </span>
          <span>
            LINEUP<small>FANTASY ASSISTANT</small>
          </span>
        </a>
        <div className="sidebar-league">
          <span className="nav-caption">SAMPLE LEAGUE</span>
          <strong>Sunday Sample League</strong>
          <small>2026 season</small>
        </div>
        <nav className="primary-nav" aria-label="Main navigation">
          {[
            { label: "My Team", icon: Users },
            { label: "Matchup", icon: Swords },
            { label: "League", icon: Trophy }
          ].map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={view === label ? "active" : ""}
              aria-current={view === label ? "page" : undefined}
              onClick={() => navigate(label)}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <a className="text-action" href="/">
            Sign in <ArrowRight size={16} />
          </a>
        </div>
      </aside>
      <main id="demo-content" className="demo-content">
        <div className="demo-banner">
          <span>Sample league · Fictional players and scores</span>
          <a href="/">
            Use your own team <ArrowRight size={15} />
          </a>
        </div>
        <div className="demo-heading">
          <div>
            <p className="eyebrow">WEEK 4 / PPR</p>
            <h1>{view === "My Team" ? "Fourth & Goal" : view}</h1>
          </div>
          <button
            className="icon-button"
            aria-label="Reset sample scenario"
            title="Reset sample scenario"
            onClick={reset}
          >
            <RotateCcw size={18} />
          </button>
        </div>
        {view === "My Team" && (
          <>
            <div className="demo-scenario">
              <label>
                <input
                  type="checkbox"
                  checked={injured}
                  onChange={(e) => setInjured(e.target.checked)}
                />
                Alex Carter ruled out
              </label>
              <strong>{overview.teams[0]!.projectedPoints.toFixed(1)} projected pts</strong>
            </div>
            <TeamLineup
              report={report}
              week={4}
              slots={demoSettings.lineupSlots}
              loading={false}
              error={null}
              onRefresh={reset}
              onPlayers={() => navigate("League")}
            />
          </>
        )}
        {view === "Matchup" && (
          <MatchupView
            overview={overview}
            loading={false}
            error={null}
            connected
            dirty={false}
            onRefresh={reset}
            onConnect={() => navigate("League")}
          />
        )}
        {view === "League" && (
          <LeaguePanel
            overview={overview}
            loading={false}
            error={null}
            hasSavedTeam
            connectedToSleeper
            teamDirty={false}
            scoringFormat={demoSettings.scoringFormat}
            scoringRules={demoSettings.scoringRules!}
            lineupSlots={demoSettings.lineupSlots}
            projectionUpdatedAt={demoTimestamp}
            onRefresh={reset}
            onOpenTeam={() => navigate("My Team")}
          />
        )}
      </main>
    </div>
  );
}
