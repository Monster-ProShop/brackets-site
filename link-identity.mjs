// Brackets: deterministic Player ID > membership > unique identity matching.
// Never treat two empty emails as the same account or guess the first bowler.
const id=value=>String(value??'').trim().toLowerCase();
const name=value=>id(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
export function matchRosterProfile(profiles,bowler){
  if(!Array.isArray(profiles)||!bowler)return {profile:null,reason:'missing'};
  const select=(matches,reason)=>matches.length===1?{profile:matches[0],reason}:matches.length>1?{profile:null,reason:'ambiguous'}:null;
  const bowlerId=id(bowler.id);
  if(bowlerId){const found=select(profiles.filter(p=>id(p.id)===bowlerId),'id');if(found)return found;}
  const membership=id(bowler.membershipNumber||bowler.membership_number);
  if(membership){const found=select(profiles.filter(p=>id(p.membership_number)===membership),'player-id');if(found)return found;}
  const bowlerEmail=id(bowler.email),bowlerName=name(bowler.name);
  const emailMatches=bowlerEmail?profiles.filter(p=>id(p.email||p.roster_email)===bowlerEmail):[];
  const nameMatches=bowlerName?profiles.filter(p=>name(p.name)===bowlerName):[];
  if(emailMatches.length>1)return {profile:null,reason:'ambiguous'};
  if(nameMatches.length>1){
    if(emailMatches.length===1&&nameMatches.some(p=>p.id===emailMatches[0].id))return {profile:emailMatches[0],reason:'email-and-name'};
    return {profile:null,reason:'ambiguous'};
  }
  if(emailMatches.length===1&&nameMatches.length===1&&emailMatches[0].id!==nameMatches[0].id)
    return {profile:null,reason:'conflict'};
  if(emailMatches.length===1)return {profile:emailMatches[0],reason:'email'};
  if(nameMatches.length===1)return {profile:nameMatches[0],reason:'name'};
  return {profile:null,reason:'missing'};
}
