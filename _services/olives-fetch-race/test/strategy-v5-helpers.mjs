import {boardFor,neighbors,legalMoves,applyMove} from '../../../play/olives-fetch-race/engine.mjs';
// Exact solo travel cost, including both sprints, consumed traps and scratch turns.
export function travel(s,p,ignoreTraps=false) {
 const b=boardFor(s),a=s.players[p];if(a.finished)return {cost:0,move:null};
 const graph=Array.from({length:49},(_,n)=>neighbors(s,n));
 const traps=ignoreTraps?[]:(s.traps??[]).filter(t=>t.owner!==p),start=[a.pos,a.ball,a.sprints,0];
 const key=v=>v.join(':'),best=new Map([[key(start),0]]),queue=[{v:start,cost:0,first:null}];
 while(queue.length){queue.sort((a,b)=>b.cost-a.cost);const node=queue.pop(),[pos,ball,sprints,mask]=node.v;if(node.cost!==best.get(key(node.v)))continue;
  if(ball&&pos===b.homes[p])return {cost:node.cost+(a.scratching?1:0),move:node.first};
  const actions=graph[pos].map(to=>({type:'step',to}));
  if(sprints)for(const delta of [-14,14,-2,2]){const mid=pos+delta/2,to=pos+delta;if(graph[pos].includes(mid)&&graph[mid].includes(to)&&Math.abs(pos%7-to%7)+Math.abs(Math.floor(pos/7)-Math.floor(to/7))===2)actions.push({type:'sprint',to});}
  for(const m of actions){const crossed=m.type==='sprint'?[pos+(m.to-pos)/2,m.to]:[m.to],got=ball||crossed.includes(b.balls[p]),to=got&&crossed.includes(b.homes[p])?b.homes[p]:m.to;let nextMask=mask,penalty=0;
   traps.forEach((t,i)=>{if(t.to===to&&!(mask&(1<<i))){nextMask|=1<<i;penalty++;}});
   const v=[to,got,sprints-(m.type==='sprint'?1:0),nextMask],cost=node.cost+1+penalty;
   if(cost<(best.get(key(v))??Infinity)){best.set(key(v),cost);queue.push({v,cost,first:node.first??m});}
  }
 }return {cost:Infinity,move:null};
}
export function choose(s,p,policy='beeline') {
 const first=travel(s,p,policy==='beeline').move;if(policy==='beeline')return first;
 let best=first,score=-Infinity;
 const actions=[...legalMoves(s,p,'step'),...legalMoves(s,p,'sprint'),...(policy==='fences'||policy==='mixed'?legalMoves(s,p,'fence'):[]),...(policy==='fleas'||policy==='mixed'?[...legalMoves(s,p,'flea'),...legalMoves(s,p,'walk-flea')]:[])];
 for(const move of actions){const next=applyMove(s,p,move),value=next.result===p?100:next.result==='tie'?0:travel(next,1-p).cost-travel(next,p).cost;
  // Prefer moving when an obstacle does not buy a real tempo advantage.
  const adjusted=value+(policy==='fleas'&&move.type==='flea'?.002:['step','sprint'].includes(move.type)?.001:0);
  if(adjusted>score){score=adjusted;best=move;}
 }
 return best;
}
export function play(layout,starter,policies){let s={...structuredClone(layout),starter,turn:starter};const actions={step:0,sprint:0,fence:0,flea:0,'walk-flea':0};let skips=0;
 for(let n=0;n<120&&s.result===null;n++){const p=s.turn,m=choose(s,p,policies[p]);if(!m)throw Error('No move');actions[m.type]++;const before=s.ply??s.version;s=applyMove(s,p,m);skips+=(s.ply??s.version)-before-1;}
 if(s.result===null)throw Error('Game failed to finish');return {state:s,actions,skips};}
