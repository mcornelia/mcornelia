import {canonicalPhrase,canonicalNewPhrase,NEW_PHRASE_GUIDANCE,credentialCandidates} from '../../play/olives-fetch-race/access.mjs';
const hex=b=>Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
async function derive(phrase,salt) {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(phrase),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new Uint8Array(salt.match(/../g).map(x=>parseInt(x,16))),iterations:100000},key,256));
}
export class AccessAuth {
  constructor(sql,env) {
    this.sql=sql;this.env=env;this.cache=new Map();
    sql.exec('CREATE TABLE IF NOT EXISTS player_access (player INTEGER PRIMARY KEY, salt TEXT NOT NULL, verifier TEXT NOT NULL, change_id TEXT NOT NULL)');
    sql.exec('CREATE TABLE IF NOT EXISTS access_attempts (bucket TEXT PRIMARY KEY, started INTEGER NOT NULL, attempts INTEGER NOT NULL)');
  }
  row(player){return this.sql.exec('SELECT * FROM player_access WHERE player=?',player).toArray()[0];}
  async matches(player,candidates,hashes) {
    const row=this.row(player);
    if(!row)return hashes.includes([this.env.FETCH_MIKE_KEY_HASH,this.env.FETCH_AIMEE_KEY_HASH][player]);
    for(const candidate of candidates) {
      const phrase=canonicalPhrase(candidate);
      if(phrase && await derive(phrase,row.salt)===row.verifier)return true;
    }
    return false;
  }
  async authenticate(token,ip) {
    const candidates=credentialCandidates(token),hashes=await Promise.all(candidates.map(digest));
    const cacheKey=hashes.join(':');
    if(cacheKey && this.cache.has(cacheKey))return {player:this.cache.get(cacheKey)};
    // Valid unchanged legacy keys are cheap and never locked out by unrelated guesses.
    const legacy=[0,1].filter(p=>!this.row(p)&&hashes.includes([this.env.FETCH_MIKE_KEY_HASH,this.env.FETCH_AIMEE_KEY_HASH][p]));
    const now=Date.now(),buckets=['global','ip:'+ip];
    this.sql.exec('DELETE FROM access_attempts WHERE started < ?',now-15*60*1000);
    if(!legacy.length && buckets.some((b,i)=> (this.sql.exec('SELECT attempts FROM access_attempts WHERE bucket=?',b).toArray()[0]?.attempts??0)>=(i?20:100)))
      return {status:429,error:'Too many sign-in attempts. Wait fifteen minutes, then try again.'};
    const matches=[];
    for(const p of [0,1])if(await this.matches(p,candidates,hashes))matches.push(p);
    if(matches.length!==1) {
      for(const b of buckets)this.sql.exec('INSERT INTO access_attempts VALUES (?,?,1) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1',b,now);
      return {status:401,error:'That key or phrase was not recognized. Your entry is still here; check it and try again.'};
    }
    if(this.cache.size>=8)this.cache.clear();
    this.cache.set(cacheKey,matches[0]);
    return {player:matches[0]};
  }
  async change(player,body) {
    const phrase=canonicalNewPhrase(body?.phrase),confirmation=canonicalNewPhrase(body?.confirmation);
    if(!phrase || confirmation!==phrase || !/^[a-f0-9-]{36}$/.test(body?.id||''))
      return {status:400,error:NEW_PHRASE_GUIDANCE+' Enter the same phrase in both fields.'};
    const candidates=credentialCandidates(phrase),hashes=await Promise.all(candidates.map(digest));
    if(await this.matches(1-player,candidates,hashes))return {status:409,error:'Choose a different phrase from the other player.'};
    const prior=this.row(player);
    if(prior?.change_id===body.id) {
      if(await this.matches(player,candidates,hashes))return {changed:true,player};
      return {status:409,error:'This change was already completed. Open access settings again for another change.'};
    }
    if(await this.matches(player,candidates,hashes))return {status:409,error:'Choose a new phrase different from your current key or phrase.'};
    const salt=hex(crypto.getRandomValues(new Uint8Array(16))),verifier=await derive(phrase,salt);
    this.sql.exec('INSERT INTO player_access VALUES (?,?,?,?) ON CONFLICT(player) DO UPDATE SET salt=excluded.salt,verifier=excluded.verifier,change_id=excluded.change_id',player,salt,verifier,body.id);
    this.cache.clear();
    return {changed:true,player};
  }
}
