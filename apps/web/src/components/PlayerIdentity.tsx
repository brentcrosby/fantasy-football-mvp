import { useState } from "react";
import type { Player } from "@fantasy-football/shared";

export function PlayerIdentity({ player }: { player: Player }) {
  const [failed, setFailed] = useState(false);
  const team =
    (
      { JAC: "jax", WSH: "wsh", WAS: "wsh", LA: "lar" } as Record<
        string,
        string
      >
    )[player.nflTeam] ?? player.nflTeam.toLowerCase();
  return (
    <div className="athlete">
      <span className="athlete-logo" aria-hidden="true">
        {!failed && /^[a-z]{2,3}$/.test(team) ? (
          <img
            src={`https://a.espncdn.com/i/teamlogos/nfl/500/${team}.png`}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <span>{player.nflTeam}</span>
        )}
      </span>
      <span className="athlete-name">
        <strong>{player.name}</strong>
        <small>
          {player.nflTeam}{" "}
          <span
            className={`position-text position-${player.position.toLowerCase()}`}
          >
            {player.position}
          </span>
        </small>
      </span>
    </div>
  );
}

export function Availability({
  player,
  week,
}: {
  player: Player;
  week: number;
}) {
  if (player.byeWeek === week)
    return <span className="availability bye">Bye</span>;
  if (player.injuryStatus === "HEALTHY")
    return <span className="availability healthy">Available</span>;
  return (
    <span className={`availability ${player.injuryStatus.toLowerCase()}`}>
      {player.injuryStatus.toLowerCase().replaceAll("_", " ")}
    </span>
  );
}
