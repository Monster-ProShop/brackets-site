(function(root){
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  // Merge edits against the exact state the editor loaded. Never guess when
  // two people changed the same value or when the session/draw changed.
  function merge(base,local,remote){
    if(!base||base._sessionId!==remote._sessionId)throw new Error('A new session was started. Your pending edits have been kept on this computer.');
    if(!same(base.brackets,remote.brackets)&&!same(local,base))throw new Error('The bracket draw changed on another device. Your pending edits have been kept on this computer.');
    function field(b,l,r,path){
      if(same(l,b))return structuredClone(r);
      if(same(r,b)||same(l,r))return structuredClone(l);
      if(path==='bowlers'&&[b,l,r].every(Array.isArray)){
        const ids=new Set([...r,...l].map(x=>x.id));
        return [...ids].map(id=>field(b.find(x=>x.id===id),l.find(x=>x.id===id),r.find(x=>x.id===id),'bowler '+id)).filter(x=>x!==undefined);
      }
      if([b,l,r].every(x=>x&&typeof x==='object'&&!Array.isArray(x))){
        const out={};for(const key of new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)])){
          if(key==='_serverUpdatedAt')continue;
          const value=field(b[key],l[key],r[key],path?path+'.'+key:key);
          if(value!==undefined)out[key]=value;
        }return out;
      }
      throw new Error('Another device changed '+path+'. Your pending edits have been kept on this computer; review the conflicting value before saving.');
    }
    const result=field(base,local,remote,'');result._serverUpdatedAt=remote._serverUpdatedAt;return result;
  }
  if(typeof module!=='undefined')module.exports={merge};else root.MonsterSaveMerge={merge};
})(globalThis);
