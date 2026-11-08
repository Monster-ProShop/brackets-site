// Public links contain a competition UUID only; invitation-only links also
// contain a random bearer token. Never put user identity or payments in QR.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN=/^[a-f0-9]{48}$/;
export function competitionInviteUrl(competitionId,origin,token=null){
  if(!UUID.test(String(competitionId)))throw Error('Invalid competition ID.');
  if(token!==null&&!TOKEN.test(token))throw Error('Invalid invitation token.');
  const root=new URL(origin);
  if(!['https:','http:'].includes(root.protocol))throw Error('Invalid app origin.');
  root.pathname='/';root.search='';root.hash='';
  root.searchParams.set('join',competitionId);
  if(token)root.searchParams.set('token',token);
  return root.toString();
}
export function parseCompetitionInviteDetails(raw,expectedOrigin){
  if(typeof raw!=='string'||raw.trim().length>2000)throw Error('The QR code does not contain a valid competition invitation.');
  const url=new URL(raw.trim()),origin=new URL(expectedOrigin);
  const keys=[...url.searchParams.keys()];
  if(url.origin!==origin.origin||!['/','/index.html'].includes(url.pathname)||
     url.searchParams.getAll('join').length!==1||
     keys.some(key=>!['join','token'].includes(key))||
     url.searchParams.getAll('token').length>1||url.hash||
     !UUID.test(url.searchParams.get('join')||'')||
     (url.searchParams.has('token')&&!TOKEN.test(url.searchParams.get('token'))))
    throw Error('This is not a valid ProDrillOS competition QR code for this app.');
  return {id:url.searchParams.get('join'),token:url.searchParams.get('token')||null};
}
export function parseCompetitionInvite(raw,expectedOrigin){
  return parseCompetitionInviteDetails(raw,expectedOrigin).id;
}
