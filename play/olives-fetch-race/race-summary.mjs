import {NAMES} from './engine.mjs?v=7';
export function raceSummary(state) {
  const turns=state.ply ?? state.version;
  const starter=state.starter ?? 0;
  const counts=state.turnCounts ? [...state.turnCounts] : [0,0];
  if(!state.turnCounts){counts[starter]=Math.ceil(turns/2);counts[1-starter]=Math.floor(turns/2);}
  if(state.result===null)return {turns,counts};
  const tied=state.result==='tie';
  const winner=tied?null:state.result;
  return {
    turns,counts,
    title:tied?'A perfectly matched pair.':`${NAMES[winner]} wins the race!`,
    explanation:tied
      ? `Both balls are home. ${NAMES[1-starter]} made it home on the final chance to tie, so you finished with equal turns.`
      : winner===starter
        ? `${NAMES[winner]} brought the ball home first. ${NAMES[1-winner]} had one final turn to tie but could not reach home.`
        : `${NAMES[winner]} brought the ball home before ${NAMES[1-winner]}. Both players had the same number of turns.`,
  };
}

export function playerObjective(player, complete, steps) {
  if(player.finished) return "Home with the ball";
  if(!complete) return player.ball ? "Bring it home" : "Fetch your ball";
  return `${player.ball ? "Return" : "Fetch"} unfinished · ${steps} ${steps === 1 ? "step" : "steps"} left`;
}
