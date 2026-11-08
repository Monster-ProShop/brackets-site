import { createAuthClient } from 'https://esm.sh/@neondatabase/auth@0.5.0-beta?bundle';
import { matchRosterProfile } from './link-identity.mjs';
import { competitionInviteUrl,parseCompetitionInviteDetails } from './competition-qr.mjs';

(function () {
  const cfg = window.MONSTER_NEON || {};
  const alphabetical=window.BowlingApp.alphabetical;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const dollars = cents => '$' + (Number(cents || 0) / 100).toFixed(2);
  const sections = ['portalAuth','portalDashboard','portalViewer','managerApp'];
  const show = id => sections.forEach(name => $(name).classList.toggle('hidden', name !== id));
  const localize = () => window.BowlingApp?.translateUI();
  const notice = message => { $('portalNotice').textContent = message;localize(); };
  const expiredNoticeVisible = () => /session expired|session has expired|sesi[oó]n expir[oó]/i.test($('portalNotice').textContent);
  const fail = error => notice(error?.message || String(error));
  const authKey = 'prodrillos-auth-session';
  const savedAuth = () => { try { return JSON.parse(sessionStorage.getItem(authKey) || 'null'); } catch { return null; } };
  let client, user, sessionToken = savedAuth()?.token || null, role = 'user', admin = false, superAdmin = false, current = null, competitions = [], accessUsers = [], permanentRoster = [], rosterCompetition = null, pendingRosterPreview = null, pendingHandicapPreview = null, equipmentPerformance = null, saveJob = null, saving = false, verificationEmail = '', reauth = false, sessionExpired = false, needsSessionReset = false, lastEmail = '';
  const updateAuthButton = () => {
    $('portalLogin').textContent = user && !sessionExpired ? 'Log out' : 'Log in';
    $('portalLogin').classList.remove('hidden');
    localize();
  };
  const newClient = () => ({auth:createAuthClient(cfg.authUrl)});
  async function resetExpiredSession() {
    if (!needsSessionReset) return;
    try { await client?.auth.signOut(); } catch {}
    // Recreating the client also drops any expired session cached by the SDK.
    client = newClient();
    user = null;
    role = 'user';admin = false;superAdmin = false;
    sessionToken = null;sessionStorage.removeItem(authKey);
    sessionExpired = false;
    needsSessionReset = false;
    updateAuthButton();
  }

  async function activeToken(attempts = 5) {
    if (sessionToken) return sessionToken;
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const response = await fetch(cfg.authUrl + '/token', {credentials: 'include', cache: 'no-store', headers: sessionToken ? {authorization: 'Bearer ' + sessionToken} : {}});
        const data = await response.json();
        if (response.ok && data?.token) return data.token;
      } catch (error) {
        lastError = error;
      }
      const result = await client.auth.token();
      if (!result.error && result.data?.token) return result.data.token;
      lastError = result.error || lastError;
      const restored = await client.auth.getSession();
      if (restored.error) lastError = restored.error;
      if (restored.data?.user) user = restored.data.user;
      if (attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)));
    }
    if (sessionToken) return sessionToken;
    throw lastError || new Error('Session expired. Sign in again.');
  }

  async function api(path, method = 'GET', body) {
    let token = null;
    if (user) {
      try {
        token = await activeToken();
      } catch (error) {
        lastEmail = user.email || lastEmail;
        sessionExpired = true;
        needsSessionReset = true;
        updateAuthButton();
        notice('Your session expired. Log in again to continue; the information on this screen is preserved.');
        throw error;
      }
    }
    const result = await fetch(cfg.apiUrl + path, {
      method,
      headers: {'content-type':'application/json',...(token ? {authorization:'Bearer '+token} : {})},
      ...(body === undefined ? {} : {body:JSON.stringify(body)})
    });
    const data = await result.json();
    if (!result.ok) {
      if (result.status === 401 && user) {
        lastEmail = user.email || lastEmail;
        sessionExpired = true;
        needsSessionReset = true;
        updateAuthButton();
        notice('Your session expired. Log in again to continue; the information on this screen is preserved.');
      }
      const error=new Error(data.error || 'Request failed');error.status=result.status;throw error;
    }
    if(user){sessionExpired=false;updateAuthButton();if(expiredNoticeVisible())notice('');}
    return data;
  }
  const placeSearchTimers={};
  function locationPayload(prefix='competition') {
    return {bowlingCenter:$(prefix+'Center').value.trim(),country:$(prefix+'Country').value,region:$(prefix+'Region').value,city:$(prefix+'City').value,formattedAddress:$(prefix+'Address').value,googlePlaceId:$(prefix+'PlaceId').value,latitude:$(prefix+'Latitude').value,longitude:$(prefix+'Longitude').value};
  }
  function fillLocation(prefix,place={}) {
    $(prefix+'Center').value=place.name||place.addressLine1||$(prefix+'Center').value;
    $(prefix+'Country').value=place.country||'';$(prefix+'Region').value=place.region||'';$(prefix+'City').value=place.city||'';
    $(prefix+'Address').value=place.formattedAddress||'';$(prefix+'PlaceId').value=place.placeId||'';
    $(prefix+'Latitude').value=place.latitude??'';$(prefix+'Longitude').value=place.longitude??'';
    $(prefix+'LocationStatus').textContent=place.formattedAddress||[place.city,place.region,place.country].filter(Boolean).join(' · ');
    $(prefix+'LocationSuggestions').innerHTML='';
  }
  async function searchPlaces(prefix,query) {
    const suggestions=$(prefix+'LocationSuggestions');$(prefix+'LocationStatus').textContent='Searching locations…';localize();
    try {
      const rows=await api('/places/autocomplete?q='+encodeURIComponent(query));
      suggestions._places=rows;
      suggestions.innerHTML=rows.length?rows.map((place,index)=>'<button type="button" class="place-suggestion" data-place-index="'+index+'"><strong>'+esc(place.name||place.addressLine1||query)+'</strong><small>'+esc(place.formattedAddress||'')+'</small></button>').join(''):'<p class="hint">No matching bowling centers found.</p>';
      $(prefix+'LocationStatus').textContent=rows.length?'Select the correct bowling center below.':'Try the bowling center name with its city.';localize();
    } catch(error){suggestions.innerHTML='';$(prefix+'LocationStatus').textContent=error.message;localize();}
  }
  function setupPlaceSearch(prefix) {
    const input=$(prefix+'Center'),suggestions=$(prefix+'LocationSuggestions');if(!input||input.dataset.placesReady)return;
    input.addEventListener('input',()=>{clearTimeout(placeSearchTimers[prefix]);$(prefix+'PlaceId').value='';const query=input.value.trim();if(query.length<3){suggestions.innerHTML='';$(prefix+'LocationStatus').textContent='Enter at least three characters to search for a bowling center.';localize();return;}placeSearchTimers[prefix]=setTimeout(()=>void searchPlaces(prefix,query),400);});
    suggestions.addEventListener('click',event=>{const button=event.target.closest('[data-place-index]');if(button)fillLocation(prefix,suggestions._places?.[Number(button.dataset.placeIndex)]||{});});
    input.dataset.placesReady='true';
  }
  function setupGeoapifyPlaces(){setupPlaceSearch('competition');setupPlaceSearch('editCompetition');}

  function renderCompetitionOptions(rows, selected) {
    const select = $('loginCompetition');
    if(!select)return;
    select.innerHTML = '<option value="">Choose a league or tournament</option>' +
      rows.map(c => '<option value="' + esc(c.id) + '">' + esc(c.name) + ' (' + esc(c.kind) + ')</option>').join('');
    if (selected) select.value = selected;
    localize();
  }
  async function listCompetitions() {
    return await api('/competitions');
  }
  function renderCareerSummary(data={}) {
    const metrics=[['Total games',data.totalGames||0],['Total pinfall',data.totalPinfall||0],['Average',Number(data.average||0).toFixed(2)],...(data.gameAverages||[]).map(item=>['Game '+item.game+' average',Number(item.average||0).toFixed(2)])];
    $('careerSummaryMetrics').innerHTML=metrics.map(([label,value])=>'<div class="summary-metric"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>').join('');
    const rows=data.competitions||[];
    const gameNumbers=[...new Set(rows.flatMap(row=>(row.gameAverages||[]).map(item=>item.game)))].sort((a,b)=>a-b);
    const gameAverage=(row,game)=>row.gameAverages?.find(item=>item.game===game)?.average;
    $('careerCompetitionBreakdown').innerHTML=rows.length?'<h3>By competition</h3><div class="table-wrap"><table><thead><tr><th>Competition</th><th>Games</th><th>Pinfall</th><th>Average</th>'+gameNumbers.map(game=>'<th>G'+game+' average</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr><td>'+esc(row.name)+'</td><td>'+esc(row.games)+'</td><td>'+esc(row.pinfall)+'</td><td>'+Number(row.average||0).toFixed(2)+'</td>'+gameNumbers.map(game=>'<td>'+(gameAverage(row,game)==null?'—':Number(gameAverage(row,game)).toFixed(2))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':'<p class="hint">Link your account to a bowler profile to begin building your summary.</p>';
    localize();
  }
  function showDashboardTab(tab='competitions') {
    // Bowler-only data entry and equipment statistics each have a dedicated tab.
    const summary=!admin&&tab==='summary',equipment=!admin&&role==='user'&&tab==='equipment',
      equipmentStats=!admin&&role==='user'&&tab==='equipment-stats';
    $('dashboardCompetitions').classList.toggle('hidden',summary||equipment||equipmentStats);
    $('careerSummaryCard').classList.toggle('hidden',!summary);
    $('equipmentCard').classList.toggle('hidden',!equipment);
    $('equipmentStatsCard').classList.toggle('hidden',!equipmentStats);
    document.querySelectorAll('[data-dashboard-tab]').forEach(button=>button.classList.toggle('active',button.dataset.dashboardTab===tab));
  }
  async function returnToDashboard() {
    // Stay in the current editor if a save failed. Previously we showed the
    // dashboard anyway, then every Manage button failed on flushSaves().
    if(current?.can_manage&&(saving||saveJob)){
      try{await flushSaves();}
      catch(error){
        notice('Cannot leave '+(current.name||'this competition')+
          ': Neon did not confirm your pending changes. Resolve the save error here or reload the competition; your recovery draft is preserved. Details: '+(error.message||error));
        $('portalNotice').scrollIntoView({block:'start'});
        return;
      }
    }
    await refreshDashboard();
  }
  async function refreshDashboard() {
    // Hide privileged panels from any prior signed-in account.
    qrStopScanning();
    for(const id of ['linkedAccountsManager','rosterManager','editCompetitionForm','competitionQrShare'])$(id).classList.add('hidden');
    const rows = await listCompetitions();
    competitions=rows;
    renderCompetitionOptions(rows.filter(c => c.status === 'open'), $('loginCompetition')?.value);
    $('dashboardHeading').textContent = admin
  ? 'Manage leagues and tournaments'
  : window.BowlingApp?.language() === 'es'
    ? 'Mis Competencias'
    : 'My Competitions';
    $('createCompetition').classList.toggle('hidden', !admin);
    $('bowlerLeagues').classList.toggle('hidden',admin);
    $('addCompetitionShortcut').classList.toggle('hidden', admin);

$('addCompetitionShortcut').textContent =
  window.BowlingApp?.language() === 'es'
    ? '+ Buscar liga o torneo'
    : '+ Find a League or Tournament';
    $('userDashboardTabs').classList.toggle('hidden',admin);
    $('usersAccess').classList.toggle('hidden',!superAdmin);
    $('accountEmail').textContent = user.email;
    const [sessions,leaderResults,career]=await Promise.all([Promise.all(rows.map(c=>api('/sessions?competition_id='+encodeURIComponent(c.id)))),Promise.allSettled(rows.map(c=>api('/monthly-bracket-leader?competition_id='+encodeURIComponent(c.id)))),admin?Promise.resolve(null):api('/career-summary')]),leaders=leaderResults.map(result=>result.status==='fulfilled'?result.value:null);
    if(career)renderCareerSummary(career);
    showDashboardTab('competitions');
    $('competitionCards').innerHTML = rows.map((c,i) => {
      const canManage=!!(admin&&c.can_manage);
      const monthly=leaders[i],leader=monthly?.leader,monthLabel=monthly?.month?new Intl.DateTimeFormat(window.BowlingApp?.language()==='es'?'es-MX':'en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(monthly.month+'-01T00:00:00Z')):'';
      return '<article class="card competition-card" data-competition-search="'+esc([c.name,c.manager_name,c.manager_email,c.country,c.region,c.city,c.bowling_center].filter(Boolean).join(' ').toLowerCase())+'"><h3>' + esc(c.name||'Unnamed competition') + '</h3><p>' + esc(c.kind) +
      ' · ' + esc(c.status) + (canManage?' · '+esc(c.visibility||'public'):'') + '</p>'+(leader?'<section class="monthly-leader"><span>Bowler of the Month</span><strong>'+esc(leader.name)+'</strong><b>'+esc(Number(leader.winPercentage).toFixed(1))+'% bracket win rate</b><small>'+esc(monthLabel)+' · '+esc(leader.bracketsWon)+' of '+esc(leader.bracketsPlayed)+' brackets won</small></section>':'')+'<button data-open="' + esc(c.id) + '">' +
      (canManage ? 'Manage current session' : 'View current session') + '</button>'+(canManage?'<button type="button" class="secondary" data-linked-accounts="'+esc(c.id)+'">Manage Bowler Linked Accounts</button>'+(c.visibility==='private'?'':'<button type="button" class="secondary" data-share-qr="'+esc(c.id)+'">Share Competition QR</button>')+'<button type="button" class="secondary" data-roster="'+esc(c.id)+'">Permanent roster</button><button type="button" class="secondary" data-edit-competition="'+esc(c.id)+'">Edit details</button>':'<button type="button" class="danger" data-remove-league="'+esc(c.id)+'">Remove from my dashboard</button>')+((superAdmin||(canManage&&c.owner_user_id===user.id))?'<button type="button" class="danger" data-delete-competition="'+esc(c.id)+'" data-competition-name="'+esc(c.name||'Unnamed competition')+'">Delete league/tournament</button>':'')+'<div class="session-list"><strong>Saved sessions · '+new Date().getFullYear()+'</strong>'+(cfg.archiveRenameEnabled===false&&canManage?'<small class="session-readonly-note">Session names are read-only in this test preview.</small>':'')+
      (sessions[i].length?sessions[i].map(x=>'<div class="session-row"><span class="session-label">'+esc(x.label)+'<br><small>'+esc(String(x.session_date).slice(0,10))+'</small></span>'+(canManage?'<button type="button" class="secondary" data-rename-session="'+esc(x.id)+'" data-rename-competition="'+esc(c.id)+'" data-rename-label="'+esc(x.label)+'"'+(cfg.archiveRenameEnabled===false?' disabled title="Session renaming is disabled in this read-only preview"':'')+'>'+'Edit name'+'</button>':'')+'<button class="secondary" data-session="'+esc(x.id)+'">View</button></div>').join(''):'<p class="hint">No saved sessions yet.</p>')+
      '<button type="button" class="secondary" data-previous="'+esc(c.id)+'">View previous years</button><div data-previous-list="'+esc(c.id)+'"></div></div></article>'
    }).join('') || (admin
  ? '<p>No competitions are available yet.</p>'
  : window.BowlingApp?.language() === 'es'
    ? '<section class="card"><h3>Aún no tienes competencias</h3><p>Busca una liga o torneo en el directorio y agrégalo a tu cuenta.</p></section>'
    : '<section class="card"><h3>No competitions linked yet</h3><p>Find a league or tournament in the directory and add it to your account.</p></section>'
);
    if(superAdmin)await loadUsers();
    show('portalDashboard');
    if(!admin&&role==='user')void loadEquipment().catch(error=>{$('equipmentHistory').textContent='Equipment history is temporarily unavailable: '+error.message;});
    if(!admin){
      await searchDirectory();
      const join=new URL(window.location.href).searchParams.get('join');
      if(join){
        try{const invitation=parseCompetitionInviteDetails(window.location.href,window.location.origin);await qrPresentInvitation(invitation.id,invitation.token);}
        catch(error){qrStatus(error.message);}
      }
    }
    localize();
  }
  const nightlyCounts=(values={})=>[['handicapBrackets','Handicap brackets'],['scratchBrackets','Scratch brackets'],['highGameEntries','High Game'],['virtualDoublesEntries','Virtual Doubles entries']]
    .map(([key,label])=>key==='highGameEntries'
      ?'<label>'+esc(label)+' — Participate?<select name="'+key+'"><option value="0"'+(Number(values[key])===1?'':' selected')+'>No</option><option value="1"'+(Number(values[key])===1?' selected':'')+'>Yes</option></select></label>'
      :key==='virtualDoublesEntries'
        ?'<label>Virtual Doubles — assigned partners<input type="number" min="0" name="'+key+'" value="'+esc(values[key]??0)+'" readonly><small>Counted automatically from distinct registered teams. Review the total after partners are assigned.</small></label>'
        :'<label>'+esc(label)+'<input type="number" min="0" step="1" name="'+key+'" value="'+esc(values[key]??0)+'"></label>').join('');
  const nightlyAmounts=form=>Object.fromEntries(['handicapBrackets','scratchBrackets','highGameEntries','virtualDoublesEntries']
    .map(key=>[key,Number(form.elements.namedItem(key)?.value)]));
  const nightlyReviewQuotes=new Map();
  const nightlyManagerQuotes=new WeakMap();
  const nightlyCurrency=(cents,currency)=>{const country=String(current?.country||'').trim().toLowerCase();const chosen=currency==='USD'||currency==='MXN'?currency:['us','usa','united states','united states of america','estados unidos'].includes(country)?'USD':'MXN';return (chosen==='USD'?'US':'MX')+String.fromCharCode(36)+(Number(cents)/100).toFixed(2);};
  function showNightlyReview(form,quote,assisted=false){
    const target=form.querySelector('[data-nightly-review]');
    if(!target)return;
    target.innerHTML='<h4>Review your registration — not submitted yet</h4><div class="table-wrap"><table><thead><tr><th>Event</th><th>Quantity</th><th>Unit price</th><th>Maximum subtotal</th></tr></thead><tbody>'
      +quote.lines.map(line=>'<tr><td>'+esc(line.label)+'</td><td>'+esc(line.quantity)+'</td><td>'+nightlyCurrency(line.unitCents,quote.currency)+'</td><td>'+nightlyCurrency(line.subtotalCents,quote.currency)+'</td></tr>').join('')
      +'</tbody><tfoot><tr><th>Maximum potential commitment</th><th>'+esc(quote.totalEntries)+' entries</th><th></th><th>'+nightlyCurrency(quote.totalCents,quote.currency)+'</th></tr></tfoot></table></div>'
      +'<p class="hint">This is the maximum potential amount if all requested entries are assigned. Actual bracket charges depend on complete brackets. No payment is taken here. High Game is Yes/No (one entry per bowler); 90% of its purse pays the high handicap score in each of the three games, rounded down to $50; tied game winners share the budget for that game. Virtual Doubles charges only verified distinct teams, with each award split between partners.</p>'
      +(assisted?'<p class="hint"><strong>Manager-assisted registration:</strong> Verify the selected bowler authorizes these entries and this maximum commitment before saving on their behalf.</p>':'')
      +'<label class="nightly-confirm"><input type="checkbox" data-nightly-agree> '+(assisted?'I confirm the selected bowler authorized these entries and the maximum commitment shown above.':'I have reviewed the quantities and maximum potential commitment shown above.')+'</label>'
      +'<div class="actions"><button type="button" data-nightly-confirm disabled>'+(assisted?'Confirm & save assisted registration':'Confirm & submit registration')+'</button><button type="button" class="secondary" data-nightly-edit>Edit quantities</button></div>';
    localize();
  }
  const nightlyDate=value=>new Date(value).toLocaleString(window.BowlingApp?.language()==='es'?'es-MX':'en-US',{dateStyle:'medium',timeStyle:'short'});
  async function loadNightlyManager(){
    if(!admin)return;
    const id=current?.can_manage?current.id:null;
    if(!id){$('nightlyManagerEvents').innerHTML='<p class="hint">Open a league or tournament as its manager first.</p>';return;}
    const [data,roster]=await Promise.all([api('/nightly/events?competition_id='+encodeURIComponent(id)),api('/roster?competition_id='+encodeURIComponent(id))]);
    if(current?.id!==id)return; // Ignore results from a competition that was just switched.
    if(data.readOnly===true){
      $('nightlyNewSessionPanel').classList.add('hidden');
      $('nightlyManagerEvents').innerHTML='<p class="notice">Read-only production-copy rehearsal: registrations, handicap approvals and session changes are disabled. You can inspect archived sessions, results and balances without altering live records.</p>';
      localize();return;
    }
    const activeRoster=roster.filter(p=>p.active);
    const sessionEvents=data.events.filter(e=>e.state_session_id===data.currentSessionId);
    const needsNewSession=!sessionEvents.length||sessionEvents.every(e=>['cancelled','closed','generated'].includes(e.status));
    $('nightlyNewSessionPanel').classList.toggle('hidden',!needsNewSession);
    if(needsNewSession && !$('nightlyNewSessionDate').value)
      $('nightlyNewSessionDate').value=new Date().toLocaleDateString('en-CA');
    $('nightlyManagerEvents').innerHTML=sessionEvents.length?sessionEvents.map(e=>{
      const editable=!e.handicapsLocked && !e.first_score_at && e.status!=='cancelled';
      const forms=e.entries.map(entry=>{
        const actualDoubles=e.actualDoublesCounts?.[entry.profile_id]??entry.virtual_doubles_entries;
        const mismatch=actualDoubles!==Number(entry.virtual_doubles_entries);
        const identity='<strong>'+esc(entry.name)+'</strong><span>HDCP '+entry.handicap_brackets+' · Scratch '+entry.scratch_brackets+' · High '+entry.high_game_entries+' · Doubles '+entry.virtual_doubles_entries+' confirmed / '+actualDoubles+' assigned'+(mismatch?' — RECONFIRM REQUIRED':'')+'<br><small>'+(entry.confirmed_at?'Registration confirmed':entry.submitted_by===user?.id?'Manager-entered registration':'Not confirmed by bowler')+' · '+(entry.confirmed_total_cents==null?'—':nightlyCurrency(entry.confirmed_total_cents))+' maximum</small></span>';
        return editable
          ?'<form class="form-grid" data-nightly-approve="'+esc(e.id)+'" data-profile-id="'+esc(entry.profile_id)+'">'+identity+'<label>Handicap<input type="number" name="handicap" min="0" max="300" step="1" value="'+esc(entry.approved_handicap??entry.handicap_snapshot)+'"></label><button type="submit">'+(entry.handicap_status==='approved'?'Update handicap':'Approve handicap')+'</button></form>'
          :'<div class="form-grid">'+identity+'<span>Handicap '+esc(entry.approved_handicap??entry.handicap_snapshot)+' · '+(e.status==='cancelled'?'Cancelled':'Locked')+'</span></div>';
      }).join('');
      const options=activeRoster.map(p=>{
        const previous=e.entries.find(entry=>entry.profile_id===p.id);
        const values={handicapBrackets:previous?.handicap_brackets??0,
          scratchBrackets:previous?.scratch_brackets??0,
          highGameEntries:previous?.high_game_entries??0,
          virtualDoublesEntries:e.actualDoublesCounts?.[p.id]??0};
        return '<option value="'+esc(p.id)+'" data-registered-counts="'+esc(JSON.stringify(values))+'">'+esc(p.name)+' · '+esc(p.membership_number||'No Player ID')+'</option>';
      }).join('');
      const cancelled=e.status==='cancelled',finished=e.status!=='open';
      const pricingPending=e.status==='open'&&!e.pricesConfirmed;
      const priceReview=data.priceReview;
      const priceItems=[['handicapBrackets','Handicap brackets'],['scratchBrackets','Scratch brackets'],
        ['highGameEntries','High Game'],['virtualDoublesEntries','Virtual Doubles']];
      const priceApproval=pricingPending
        ?'<div class="notice"><strong>⚠ Before opening signup: configure and save the session buy-in costs.</strong><p>The price review below uses prices saved in Neon, not unsaved fields. Digital and assisted signup remain disabled until you approve them.</p>'
          +'<button type="button" class="secondary" data-nightly-configure>1. Set or review buy-ins in Registration & configuration</button>'
          +(priceReview?'<h4>2. Review saved prices for this session</h4><div class="table-wrap"><table><thead><tr><th>Entry type</th><th>Saved buy-in</th></tr></thead><tbody>'
            +priceItems.map(([key,name])=>'<tr><td>'+esc(name)+'</td><td>'+nightlyCurrency(priceReview[key],data.currency)+'</td></tr>').join('')
            +'</tbody></table></div><label><input type="checkbox" data-nightly-prices-agree> I have reviewed and approved all four saved buy-in prices for this session.</label>'
            +'<div class="actions"><button type="button" data-nightly-activate="'+esc(e.id)+'" data-prices="'+esc(JSON.stringify(priceReview))+'" disabled>Open Registration with These Prices</button></div>'
            :'<p>Save valid buy-ins for all four categories before registration can be opened.</p>')
          +'</div>':'';

      const quality=e.eligibility||{},eligible=quality.fulfilled||{};
      const readiness=finished?'<p><strong>Event minimums:</strong> Handicap brackets '+(eligible.handicapBrackets?'Qualified':'Cancelled')+
        ' · Scratch brackets '+(eligible.scratchBrackets?'Qualified':'Cancelled')+
        ' · High Game '+(eligible.highGame?'Qualified':'Cancelled')+
        ' · Virtual Doubles '+(eligible.virtualDoubles?'Qualified':'Cancelled')+'</p>':
        '<p class="hint">Minimums: 8 distinct bowlers in a bracket or High Game, or 8 verified Virtual Doubles teams.</p>';
      const missing=e.scoreReadiness?.missing||[];
      const firstScoreStatus=!e.handicapsLocked&&e.scoreReadiness
        ?!e.eligibility?.ready
          ?'<p class="notice">Scoring is not available: no event has met its minimum of eight bowlers or eight verified Doubles teams. Review the registrations before generating events.</p>'
          :missing.length
            ?'<p class="notice"><strong>Before saving the first score:</strong> Prepare and save '+
            esc(missing.map(item=>item.label).join(', '))+
            '. Generate the bracket draws, generate High Game standings, and verify and sync approved Doubles teams as applicable. Scores remain blocked until all qualifying events are ready.</p>'
          :'<p class="hint">Pre-scoring check: all qualifying events are prepared in Neon.</p>'
        :'';
      return '<div class="pair-card"><h3>'+esc(e.label)+'</h3><p>'+(cancelled?'Cancelled — insufficient participation':e.registrationOpen?'Registration open until bracket generation':pricingPending?'Registration pending — confirm costs first':'Registration closed')+' · '+(e.handicapsLocked?'Handicaps locked':'Handicaps editable')+'</p>'+priceApproval
        +(cancelled?'<p class="notice">This night was cancelled because no event met its minimum. Registrations are retained; no draws or charges will be created.</p>':'')+readiness+firstScoreStatus
        +((e.status==='open'||e.status==='closed')&&!e.handicapsLocked?'<button type="button" class="secondary" data-nightly-apply="'+esc(e.id)+'">Review & sync all entries and Doubles</button><p class="hint">One review confirms each manager-assisted bowler\'s actual Doubles partnerships, revised maximum commitment and handicap, then synchronizes the High Game and bracket roster in Neon. No payment is collected.</p>':'')
        +(e.needsHighReconciliation&&e.handicapsLocked?'<p class="notice">The scoring roster has '+esc(e.highReconciliationCount)+' High Game registration mismatches. Confirmed entries are preserved. Use the safe reconciliation below to update only High Game participation and payouts, without changing official scores.</p><button type="button" class="secondary" data-nightly-reconcile-high="'+esc(e.id)+'">Restore verified High Game entries</button>':'')
        +'<h4>Bowler registrations</h4>'+(forms||'<p class="hint">No registrations yet.</p>')
        +(e.registrationOpen?'<h4>Admin-assisted signup</h4><p class="hint">Available for both digital and manual nights while registration is open. Register a bowler from the permanent roster, even without a bowler account.</p>'
          +(options?'<form data-nightly-manual="'+esc(e.id)+'"><div class="form-grid"><label>Register bowler<select name="profileId" required><option value="" selected disabled>Select bowler</option>'+options+'</select></label>'+nightlyCounts()+'</div><button type="submit">Review assisted registration & total</button><section data-nightly-review aria-live="polite"></section></form>':'<p class="hint">Add active bowlers to the permanent roster before assisting with signup.</p>'):'')
        +'</div>';
    }).join(''):'<p class="hint">No sessions available yet. Start and save a fresh scoreless session in the manager to activate digital sign-up automatically.</p>';
    localize();
  }
  async function loadNightlyBowler(){
    if(admin||role!=='user')return;
    const id=current?.id;
    if(!id){$('nightlyBowlerEvents').innerHTML='<p class="hint">Open one of your leagues or tournaments first.</p>';return;}
    const data=await api('/nightly/events?competition_id='+encodeURIComponent(id));
    if(current?.id!==id)return;
    if(data.readOnly===true){
      nightlyReviewQuotes.clear();
      $('nightlyBowlerEvents').innerHTML='<p class="hint">Registration is disabled in this read-only production-copy rehearsal. Historical sessions and published results remain available.</p>';
      localize();return;
    }
    const eligible=data.events.filter(e=>e.state_session_id===data.currentSessionId);
    nightlyReviewQuotes.clear();
    $('nightlyBowlerEvents').innerHTML=eligible.length?eligible.map(e=>{
      const mine=e.entries?.[0],values=mine?{handicapBrackets:mine.handicap_brackets,scratchBrackets:mine.scratch_brackets,highGameEntries:mine.high_game_entries,virtualDoublesEntries:mine.virtual_doubles_entries}:{};
      return '<div class="pair-card"><h3>'+esc(e.label)+'</h3><p>'+(e.status==='cancelled'?'Cancelled — insufficient participation':e.registrationOpen?'Registration open until bracket generation':e.status==='open'?'Registration pending — manager must confirm session costs':'Registration closed')+'</p>'
        +(e.status==='cancelled'?'<p class="notice">This night was cancelled because no category reached the minimum of eight. Your registration record is kept; there is no competition charge.</p>':'')
        +(mine?'<p>My signup: HDCP '+mine.handicap_brackets+' · Scratch '+mine.scratch_brackets+' · High '+mine.high_game_entries+' · Doubles '+mine.virtual_doubles_entries+' · Handicap '+esc(mine.approved_handicap??mine.handicap_snapshot)+' ('+esc(mine.handicap_status)+')</p>':'')
        +(e.registrationOpen?'<form data-nightly-self="'+esc(e.id)+'"><div class="form-grid">'+nightlyCounts(values)+'</div><button type="submit">Review registration & total</button><section data-nightly-review aria-live="polite"></section></form>':e.status==='open'?'<p class="hint">Registration is pending cost confirmation by the league manager. No entries can be submitted yet.</p>':'<p class="hint">Signup is closed. Your saved entry remains visible above.</p>')+'</div>';
    }).join(''):'<p class="hint">No active session sign-up is available for this competition yet.</p>';
    localize();
  }
  function profileForName(name){return permanentRoster.find(p=>p.active&&p.name.localeCompare(name,undefined,{sensitivity:'base'})===0)||null;}
  async function loadPermanentRoster(competitionId){permanentRoster=alphabetical(await api('/roster?competition_id='+encodeURIComponent(competitionId)));$('leagueRosterNames').innerHTML=permanentRoster.filter(p=>p.active).map(p=>'<option value="'+esc(p.name)+'"></option>').join('');return permanentRoster;}
  function renderScoredEquipment(){
    const select=$('equipmentScoredSession'),key=select.value,available=equipmentPerformance?.availableSessions||[];
    const session=available.find(x=>x.sourceKind+':'+x.sourceSessionId===key);
    const input=$('equipmentScoredGames');
    if(!session){input.innerHTML='<p class="hint">No scored session selected.</p>';return;}
    const saved=(equipmentPerformance?.linkedSessions||[]).find(x=>x.sourceKind===session.sourceKind&&x.sourceSessionId===session.sourceSessionId);
    if(saved)$('equipmentScoredLane').value=String(saved.laneStart);
    input.innerHTML='<h4>Game scores (from official saved results)</h4><div class="form-grid">'+session.scores.map(game=>'<label>Game '+esc(game.gameNumber)+' · '+esc(game.score)+' pins<input data-scored-ball="g'+esc(game.gameNumber)+'" maxlength="120" placeholder="Bowling ball brand and model" value="'+esc(saved?.balls?.['g'+game.gameNumber]||'')+'"></label>').join('')+'</div>';
  }
  function renderEquipmentSummary(summary){
    const target=$('equipmentStats'),total=Number(summary?.games||0);
    if(!total){target.innerHTML='<p class="hint">No score-linked equipment games yet. Save official games and link their balls above to calculate statistics.</p>';return;}
    const table=(title,rows,empty)=>'<h4>'+esc(title)+'</h4>'+(rows.length
      ?'<div class="table-wrap"><table><thead><tr><th>'+esc(title)+'</th><th>Games</th><th>Scratch average</th><th>High game</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(x.label)+'</td><td>'+esc(x.games)+'</td><td>'+esc(x.average)+'</td><td>'+esc(x.highGame)+'</td></tr>').join('')+'</tbody></table></div>'
      :'<p class="hint">'+esc(empty)+'</p>');
    target.innerHTML='<h3>Actual bowling performance · '+total+' scored games linked</h3>'
      +table('Bowling ball',summary.balls||[],'Enter the bowling ball used for each scored game.')
      +table('Lane pair',summary.lanePairs||[],'No lane pairs yet.')
      +table('Game number',summary.gameNumbers||[],'No scored games yet.')
      +table('Bowling ball by game',summary.ballByGame||[],'Record ball selections for scored games to compare by game number.')
      +table('Bowling ball by lane pair',summary.ballByLane||[],'Record ball selections for scored games to compare by lane pair.')
      +'<p class="hint">All averages are scratch scores from verified saved league or tournament games, not manually entered scores. Small samples may not represent typical performance.</p>';
  }
  function renderPerformanceSessions(){
    const select=$('equipmentScoredSession'),oldValue=select.value,sessions=equipmentPerformance?.availableSessions||[];
    select.innerHTML=sessions.map(x=>'<option value="'+esc(x.sourceKind+':'+x.sourceSessionId)+'">'+esc(x.competitionName+' · '+x.label+' · '+x.date+' ('+x.scores.length+' scored games)')+'</option>').join('');
    if(sessions.some(x=>x.sourceKind+':'+x.sourceSessionId===oldValue))select.value=oldValue;
    if(!$('equipmentScoredLane').options.length)$('equipmentScoredLane').innerHTML=Array.from({length:100},(_,i)=>'<option value="'+(i*2+1)+'">'+(i*2+1)+'-'+(i*2+2)+'</option>').join('');
    $('equipmentScoredForm').querySelector('button[type=submit]').disabled=!sessions.length;
    if(!sessions.length)$('equipmentScoredGames').innerHTML='<p class="hint">No official scored sessions are linked to your verified bowler profile yet. After the manager saves a scored session and links your account to your bowler profile, it will appear here.</p>';
    else renderScoredEquipment();
    renderEquipmentSummary(equipmentPerformance?.summary);
  }
  async function loadEquipment(){
    if(admin||role!=='user')return;
    const select=$('equipmentCompetition'),selected=select.value;
    select.innerHTML=competitions.filter(c=>c.status==='open').map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('');
    if(competitions.some(c=>c.id===selected))select.value=selected;
    if(!$('equipmentDate').value)$('equipmentDate').value=new Date().toLocaleDateString('en-CA');
    if(!$('equipmentLane').options.length)$('equipmentLane').innerHTML=Array.from({length:100},(_,index)=>{const first=index*2+1;return '<option value="'+first+'">'+first+'-'+(first+1)+'</option>';}).join('');
    $('equipmentForm').querySelector('button[type=submit]').disabled=!select.options.length;
    const [rows,performance]=await Promise.all([api('/equipment/my'),api('/equipment/performance')]);
    equipmentPerformance=performance;
    renderPerformanceSessions();
    $('equipmentHistory').innerHTML='<h3>Recent lane &amp; ball records</h3>'+(rows.length
      ?'<div class="table-wrap"><table><thead><tr><th>Date</th><th>Competition</th><th>Lanes</th><th>Game 1</th><th>Game 2</th><th>Game 3</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(String(x.session_date).slice(0,10))+'</td><td>'+esc(x.competition_name)+'</td><td>'+esc(x.lane_start)+'-'+esc(Number(x.lane_start)+1)+'</td><td>'+esc(x.ball_game1)+'</td><td>'+esc(x.ball_game2)+'</td><td>'+esc(x.ball_game3)+'</td></tr>').join('')+'</tbody></table></div>'
      :'<p class="hint">No equipment sessions recorded yet.</p>');
  }
  async function previewHandicapFile(file){
    if(!file||!rosterCompetition)return;
    if(!window.XLSX)throw new Error('Excel tools are still loading');
    const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'}),values=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{defval:''});
    const rows=values.map(row=>({
      playerId:String(row['Player ID']??row['Membership / Player ID']??row['Membership Number']??row.PlayerID??'').trim(),
      name:String(row.Bowler??row.Name??row['Bowler Name']??[row['Bowler First Name'],row['Bowler Last Name']].filter(Boolean).join(' ')).trim(),
      handicap:row.Handicap??row.HCP??row.HDCP??''
    }));
    pendingHandicapPreview=await api('/roster/handicap-preview','POST',{competitionId:rosterCompetition.id,rows});
    const preview=pendingHandicapPreview.preview;
    $('handicapPreview').innerHTML='<p class="hint">'+preview.filter(x=>x.status==='changed').length+' changes · '+preview.filter(x=>x.status==='unchanged').length+' unchanged · '+preview.filter(x=>!['changed','unchanged'].includes(x.status)).length+' unmatched/invalid</p>'
      +'<div class="table-wrap"><table><thead><tr><th>Apply</th><th>Bowler</th><th>Player ID</th><th>Current</th><th>Latest</th><th>Status</th></tr></thead><tbody>'
      +preview.map((x,i)=>'<tr><td>'+(x.status==='changed'?'<input type="checkbox" data-hcp-index="'+i+'" checked aria-label="Apply '+esc(x.name)+' handicap">':'—')+'</td><td>'+esc(x.name)+'</td><td>'+esc(x.playerId)+'</td><td>'+esc(x.oldHandicap??'—')+'</td><td>'+esc(x.newHandicap??'—')+'</td><td>'+esc(x.status)+'</td></tr>').join('')
      +'</tbody></table></div>'+(preview.some(x=>x.status==='changed')?'<p class="hint">Updates apply when a new session begins. Already saved scores and archived sessions keep their previous handicap.</p><button type="button" id="applyHandicapChanges">Apply selected handicaps</button>':'');
    $('handicapUpload').dataset.fileName=file.name;
  }
  async function addPermanentBowlerFromForm(form,competitionId){
    if(!admin||!competitions.some(c=>c.id===competitionId&&c.can_manage))
      throw new Error('Manager access required to add a permanent roster bowler.');
    const submit=form.querySelector('button[type="submit"]');
    const statusElement=form.id==='quickAddBowlerForm'?
      $('quickAddBowlerStatus'):$('nightlyQuickAddBowlerStatus');
    const data={
      competitionId,
      firstName:form.elements.namedItem('firstName').value.trim(),
      lastName:form.elements.namedItem('lastName').value.trim(),
      handicap:Number(form.elements.namedItem('handicap').value),
      email:form.elements.namedItem('email').value.trim()
    };
    submit.disabled=true;statusElement.textContent='Saving the new permanent roster bowler…';
    try{
      const result=await api('/roster/add','POST',data);
      if(!result?.created||!result.profile?.id||!result.profile?.membership_number)
        throw new Error('Neon did not verify the new permanent roster profile.');
      form.reset();
      if(rosterCompetition?.id===competitionId&&!$('rosterManager').classList.contains('hidden'))
        await openRosterManager(competitionId);
      else await loadPermanentRoster(competitionId);
      if(current?.id===competitionId&&!$('managerApp').classList.contains('hidden'))
        await loadNightlyManager();
      const message='Added '+result.profile.name+' · Player ID '+result.profile.membership_number+
        '. Now use Session Sign-Up to confirm this bowler\'s entries and buy-ins; no session charge was created.';
      statusElement.textContent=message;notice(message);
      return result;
    }catch(error){
      statusElement.textContent=error.message||'Bowler was not added.';
      throw error;
    }finally{submit.disabled=false;}
  }
  async function openRosterManager(competitionId){rosterCompetition=competitions.find(c=>c.id===competitionId);if(!(admin&&rosterCompetition?.can_manage))throw new Error('Manager access required.');await loadPermanentRoster(competitionId);const imports=await api('/roster/imports?competition_id='+encodeURIComponent(competitionId));$('rosterManagerTitle').textContent='Permanent roster — '+rosterCompetition.name;$('permanentRosterTable').innerHTML='<div class="table-wrap"><table><thead><tr><th>Player ID</th><th>Name</th><th>Email</th><th>Handicap</th><th>Status</th><th>Account link</th><th>Actions</th></tr></thead><tbody>'+permanentRoster.map(p=>'<tr><td>'+esc(p.membership_number||p.id)+'</td><td>'+esc(p.name)+'</td><td>'+esc(p.email||'')+'</td><td>'+esc(p.handicap)+'</td><td>'+(p.active?'Active':'Inactive')+'</td><td>'+(p.claimed_user_id?'Linked <button class="secondary" data-reset-profile="'+esc(p.id)+'">Reset</button>':'Not linked')+'</td><td>'+(p.active&&!p.claimed_user_id?'<button type="button" class="secondary" data-retire-unused-profile="'+esc(p.id)+'" data-profile-name="'+esc(p.name)+'">Retire if unused</button>':'—')+'</td></tr>').join('')+'</tbody></table></div>'+(imports.length?'<h3>Import history</h3><ul>'+imports.map(x=>'<li>'+esc(x.file_name||'Roster import')+' · '+esc(String(x.created_at).slice(0,10))+(x.undone_at?' · Undone':'')+'</li>').join('')+'</ul>':'<p class="hint">No roster imports yet.</p>');$('rosterManager').classList.remove('hidden');$('rosterManager').scrollIntoView({behavior:'smooth'});localize();}
  async function openLinkedAccounts(competitionId){
    rosterCompetition=competitions.find(c=>c.id===competitionId);
    if(!(admin&&rosterCompetition?.can_manage))throw new Error('Manager access required.');
    const data=await api('/roster/links?competition_id='+encodeURIComponent(competitionId));
    $('linkedAccountsTitle').textContent='Manage Bowler Linked Accounts — '+rosterCompetition.name;
    $('linkedAccountEmails').innerHTML=data.registeredEmails.map(email=>'<option value="'+esc(email)+'"></option>').join('');
    $('linkedAccountsTable').innerHTML='<div class="table-wrap"><table><thead><tr><th>Bowler</th><th>Player ID</th><th>Roster email</th><th>Linked login email</th><th>Actions</th></tr></thead><tbody>'+alphabetical(data.profiles).map(p=>'<tr><td><strong>'+esc(p.name)+'</strong>'+(p.active?'':'<br><small>Inactive</small>')+'</td><td>'+esc(p.membership_number||'—')+'</td><td>'+esc(p.roster_email||'—')+'</td><td><input type="email" list="linkedAccountEmails" value="'+esc(p.linked_email||'')+'" data-link-email="'+esc(p.id)+'" placeholder="Registered email"></td><td><button type="button" data-save-link="'+esc(p.id)+'">Save link</button> <button type="button" class="danger" data-unlink="'+esc(p.id)+'" '+(p.linked_email?'':'disabled')+'>Unlink</button></td></tr>').join('')+'</tbody></table></div>';
    $('linkedAccountsManager').classList.remove('hidden');$('linkedAccountsManager').scrollIntoView({behavior:'smooth'});localize();
  }
  // QR codes carry a public link, not a login token or account permission.
  // Use on-device detection whenever possible and jsQR as the Safari/iOS
  // fallback. Camera/gallery images are processed locally, never uploaded.
  const qrScripts=new Map();
  function qrLoadScript(url,ready){
    if(ready())return Promise.resolve();
    if(!qrScripts.has(url))qrScripts.set(url,new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=url;script.async=true;
      script.onload=()=>ready()?resolve():reject(Error('QR library could not start.'));
      script.onerror=()=>reject(Error('QR library could not load. Check the internet connection.'));
      document.head.appendChild(script);
    }).catch(error=>{qrScripts.delete(url);throw error;}));
    return qrScripts.get(url);
  }
  const qrEncoder=()=>qrLoadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',()=>typeof window.QRCode==='function');
  const qrDecoder=()=>qrLoadScript('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',()=>typeof window.jsQR==='function');
  let qrShareInviteUrl='',qrShareName='',qrPendingCompetitionId=null,qrPendingToken=null,qrCameraStream=null,qrScanActive=false;
  const qrStatus=message=>{$('qrScanStatus').textContent=message;localize();};
  function qrStopScanning(){
    qrScanActive=false;
    if(qrCameraStream){qrCameraStream.getTracks().forEach(track=>track.stop());qrCameraStream=null;}
    const video=$('qrCameraVideo');if(video){video.pause();video.srcObject=null;}
    $('qrCameraPanel').classList.add('hidden');$('qrStopCamera').classList.add('hidden');
  }
  async function qrReadCanvas(canvas){
    if(typeof window.BarcodeDetector==='function'){
      try{
        const detector=new window.BarcodeDetector({formats:['qr_code']});
        const found=await detector.detect(canvas);
        if(found?.[0]?.rawValue)return found[0].rawValue;
      }catch{}
    }
    await qrDecoder();
    const context=canvas.getContext('2d',{willReadFrequently:true});
    const pixels=context.getImageData(0,0,canvas.width,canvas.height);
    return window.jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'attemptBoth'})?.data||null;
  }
  function qrFrameCanvas(image,width,height,max=1000){
    const scale=Math.min(1,max/Math.max(width,height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(width*scale));
    canvas.height=Math.max(1,Math.round(height*scale));
    canvas.getContext('2d',{willReadFrequently:true}).drawImage(image,0,0,canvas.width,canvas.height);
    return canvas;
  }
  async function qrPresentInvitation(id,token=null){
    if(!user||admin||role!=='user')throw Error('Sign in with a bowler account to add a competition.');
    qrStopScanning();
    const item=await api('/invite/preview?competition_id='+encodeURIComponent(id)+(token?'&token='+encodeURIComponent(token):''));
    qrPendingToken=token;
    qrPendingCompetitionId=item.id;
    const existing=competitions.some(c=>c.id===item.id);
    $('qrInvitationDetails').innerHTML='<p><strong>'+esc(item.name)+'</strong> · '+esc(item.kind)+'</p><p class="hint">'+esc([item.bowling_center,item.city,item.region,item.country].filter(Boolean).join(' · '))+'</p>'+
      (existing?'<p>This competition is already on your dashboard.</p>':'<p>Confirm to add this competition to your dashboard. Your bowler profile and tournament entries are managed separately.</p>');
    $('qrConfirmJoin').disabled=existing;
    $('qrInvitationPreview').classList.remove('hidden');
    $('bowlerLeagues').scrollIntoView({behavior:'smooth',block:'start'});
    qrStatus(existing?'Already added.':'Competition found. Review and confirm below.');
  }
  async function qrAcceptRaw(raw){
    const {id,token}=parseCompetitionInviteDetails(raw,window.location.origin);
    await qrPresentInvitation(id,token);
  }
  function qrClearInvitation(){
    qrPendingCompetitionId=null;qrPendingToken=null;$('qrInvitationPreview').classList.add('hidden');
    $('qrInvitationDetails').textContent='';
  }
  function qrClearLinkFromAddress(){
    const url=new URL(window.location.href);
    url.searchParams.delete('join');url.searchParams.delete('token');
    window.history.replaceState(null,'',url.pathname+url.search+url.hash);
  }
  async function qrStartScanning(){
    if(admin||role!=='user')throw Error('Only bowler accounts can scan competition invitations.');
    if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera is unavailable. Upload a QR image or open the invitation link instead.');
    qrStopScanning();
    qrStatus('Your browser will ask for camera access. Hold the competition QR inside the frame.');
    try{
      qrCameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      const video=$('qrCameraVideo');
      video.srcObject=qrCameraStream;
      $('qrCameraPanel').classList.remove('hidden');$('qrStopCamera').classList.remove('hidden');
      await video.play();
      qrScanActive=true;
      let last=0,busy=false;
      const scan=async tick=>{
        if(!qrScanActive)return;
        if(!busy&&tick-last>250&&video.readyState>=2){
          last=tick;busy=true;
          try{
            const canvas=qrFrameCanvas(video,video.videoWidth,video.videoHeight,720);
            const code=await qrReadCanvas(canvas);
            if(code){qrStopScanning();await qrAcceptRaw(code);return;}
          }catch(error){qrStopScanning();qrStatus(error.message);return;}
          finally{busy=false;}
        }
        if(qrScanActive)requestAnimationFrame(scan);
      };
      requestAnimationFrame(scan);
    }catch(error){
      qrStopScanning();
      if(error?.name==='NotAllowedError')throw Error('Camera permission was denied. Allow camera access in browser settings, or upload a QR image.');
      throw error;
    }
  }
  async function qrReadUpload(file){
    if(!file)return;
    if(!file.type.startsWith('image/')||file.size>12*1024*1024)throw Error('Select a QR image smaller than 12 MB.');
    qrStopScanning();
    const objectUrl=URL.createObjectURL(file),image=new Image();
    try{
      image.src=objectUrl;await image.decode();
      const canvas=qrFrameCanvas(image,image.naturalWidth,image.naturalHeight,1500);
      const decoded=await qrReadCanvas(canvas);
      if(!decoded)throw Error('No QR code was found in this image. Try a clearer picture.');
      await qrAcceptRaw(decoded);
    }finally{URL.revokeObjectURL(objectUrl);}
  }
  async function qrShowShare(competitionId){
    const competition=competitions.find(c=>c.id===competitionId);
    if(!admin||!competition?.can_manage)throw Error('Only a competition manager can share its QR code.');
    if(competition.visibility==='private')throw Error('Private competitions cannot issue invitations. Change visibility to invitation-only.');
    let token=null;
    if(competition.visibility==='invitation-only'){
      if(!confirm('Generate a NEW invitation QR? Previously shared invitation-only links will stop working.'))return;
      const issued=await api('/competitions/invite','POST',{competitionId});
      token=issued.token;
    }
    qrShareInviteUrl=competitionInviteUrl(competition.id,window.location.origin,token);
    qrShareName=competition.name;
    $('qrShareCompetitionName').textContent=competition.name;
    $('qrShareUrl').value=qrShareInviteUrl;
    $('competitionQrShare').classList.remove('hidden');
    $('qrShareStatus').textContent='Preparing QR image…';
    $('qrCodeCanvasWrap').textContent='';
    $('competitionQrShare').scrollIntoView({behavior:'smooth',block:'start'});
    try{
      await qrEncoder();
      new window.QRCode($('qrCodeCanvasWrap'),{
        text:qrShareInviteUrl,width:260,height:260,
        colorDark:'#082b62',colorLight:'#ffffff',
        correctLevel:window.QRCode.CorrectLevel.M
      });
      $('qrShareStatus').textContent='QR ready. Download the image, share it, or send the invitation link.';
    }catch(error){$('qrShareStatus').textContent='QR image unavailable: '+error.message+'. You can still share the invitation link.';}
  }
  function qrShareImageData(){
    const canvas=$('qrCodeCanvasWrap').querySelector('canvas');
    const image=$('qrCodeCanvasWrap').querySelector('img');
    const source=canvas?.width?canvas:image?.complete&&image.naturalWidth?image:null;
    if(!source)throw Error('QR image is not ready yet. Try sharing the link.');
    // Printed and downloaded QR codes need a white quiet zone for reliable
    // scanning. The on-screen panel has padding; exports must include it too.
    const size=260,padding=24,output=document.createElement('canvas');
    output.width=output.height=size+padding*2;
    const context=output.getContext('2d');
    context.fillStyle='#ffffff';context.fillRect(0,0,output.width,output.height);
    context.drawImage(source,padding,padding,size,size);
    return output.toDataURL('image/png');
  }
  function qrInviteText(){
    return 'Join '+qrShareName+' on Brackets by ProDrillOS: '+qrShareInviteUrl;
  }
  function qrDownloadImage(){
    const a=document.createElement('a');a.href=qrShareImageData();
    a.download='ProDrillOS-'+qrShareName.replace(/[^a-z0-9-]+/gi,'-').slice(0,50)+'-QR.png';
    document.body.appendChild(a);a.click();a.remove();
  }
  async function qrNativeShare(){
    if(!qrShareInviteUrl)throw Error('Select a competition to share first.');
    if(!navigator.share){await navigator.clipboard.writeText(qrShareInviteUrl);$('qrShareStatus').textContent='Invitation link copied. Paste it into WhatsApp or email.';return;}
    const data={title:qrShareName,text:qrInviteText(),url:qrShareInviteUrl};
    try{
      const response=await fetch(qrShareImageData());
      const blob=await response.blob();
      const files=[new File([blob],'ProDrillOS-competition-QR.png',{type:'image/png'})];
      if(navigator.canShare?.({files}))data.files=files;
    }catch{}
    await navigator.share(data);
  }

  async function searchDirectory(){
    const q=$('leagueDirectorySearch').value.trim(),results=$('leagueDirectoryResults');
    // The leagues already on this account are shown immediately below.
    // Do not duplicate them in an empty directory or search results.
    if(!q){results.innerHTML='';return;}
    const rows=await api('/directory?q='+encodeURIComponent(q));
    if($('leagueDirectorySearch').value.trim()!==q||admin)return;
    const mine=new Set(competitions.map(c=>c.id));
    const available=rows.filter(c=>!mine.has(c.id));
    results.innerHTML=available.map(c=>'<article class="card"><strong>'+esc(c.name)+'</strong><p>'+[c.bowling_center,c.city,c.region,c.country].filter(Boolean).map(esc).join(' · ')+'</p><button type="button" data-add-league="'+esc(c.id)+'">Add to my dashboard</button></article>').join('')||'<p class="hint">No other matching leagues.</p>';
    localize();
  }
  async function loadUsers() {
    if(!superAdmin)return;
    accessUsers=await api('/users');
    $('userEmailOptions').innerHTML=accessUsers.map(account=>'<option value="'+esc(account.email)+'"></option>').join('');
    $('userEmailSearch').value='';$('userSearchResults').innerHTML='';
    $('userAccessRows').innerHTML=accessUsers.length?'<p class="hint">Search for and select a registered user.</p>':'<p>No users found.</p>';
    localize();
  }
  function renderAccessUser(account) {
    if(!account){$('userAccessRows').innerHTML='<p class="hint">Search for and select a registered user.</p>';localize();return;}
    const isOwner=account.role==='superadmin',assigned=new Set(account.competition_ids||[]);
    const options=isOwner?'<option>Admin</option>':'<option value="user"'+(account.role==='user'?' selected':'')+'>User</option><option value="manager"'+(account.role==='manager'?' selected':'')+'>Manager</option>';
    const leagues=isOwner?'<span class="hint">All competitions</span>':competitions.map(c=>'<label><input type="checkbox" data-assignment="'+esc(c.id)+'" '+(assigned.has(c.id)?'checked':'')+(account.role==='manager'?'':' disabled')+'> '+esc(c.name)+'</label>').join('');
    $('userAccessRows').innerHTML='<div class="access-user card" data-user="'+esc(account.id)+'"><strong class="access-email">'+esc(account.email)+'</strong><label>Account type<select data-user-role '+(isOwner?'disabled':'')+'>'+options+'</select></label><div><strong>Managed competitions</strong><div class="league-checks">'+leagues+'</div></div>'+(isOwner?'':'<button type="button" data-save-access>Save access</button>')+'</div>';
    localize();
  }
  function searchAccessUsers() {
    const query=$('userEmailSearch').value.trim().toLowerCase(),exact=accessUsers.find(account=>account.email===query);
    if(exact){$('userSearchResults').innerHTML='';renderAccessUser(exact);return;}
    const matches=query?accessUsers.filter(account=>account.email.includes(query)).slice(0,12):[];
    $('userSearchResults').innerHTML=matches.map(account=>'<button type="button" class="secondary" data-pick-user="'+esc(account.id)+'">'+esc(account.email)+'</button>').join('');
    renderAccessUser(null);
  }
  async function identify(signedInUser, selected) {
    user = signedInUser || null;
    if (user && !user.emailVerified) {
      verificationEmail = user.email;
      $('verifyForm').classList.remove('hidden');
      await client.auth.signOut();
      user = null;
      notice('Verify your email before signing in.');
    }
    if(user){
      const account=await api('/me');
      if(!account?.id||account.id!==user.id||
        String(account.email||'').toLowerCase()!==String(user.email||'').toLowerCase()){
        sessionToken=null;sessionStorage.removeItem(authKey);
        try{await client?.auth.signOut();}catch{}
        throw new Error('Account session mismatch. Sign in again to verify your access.');
      }
      role=account.role||'user';
    }else role='user';
    superAdmin=role==='superadmin';admin=superAdmin||role==='manager';
    sessionExpired = false;
    if (user?.email) lastEmail = user.email;
    updateAuthButton();
    if (!user) {
      qrStopScanning();qrClearInvitation();
      const rows = await listCompetitions();
      renderCompetitionOptions(rows.filter(c => c.status === 'open'), selected);
      show('portalAuth');
      return;
    }
    notice('');
    if (reauth && current) {
      reauth = false;
      if (admin&&current?.can_manage) {
        show('managerApp');
        notice('Signed in again. Your competition information was preserved.');
        if (saveJob && !saving) void drainSaves();
      } else await openCompetition(current.id);
      return;
    }
    if (selected && !admin) await openCompetition(selected);
    else await refreshDashboard();
  }
  // Legacy conversion is never automatic. Review is available only to the
  // competition manager; the backend controls whether submission is enabled.
  let legacyPreview=null;
  const legacyMoneyFields=[
    ['hdcpBuyin','Handicap bracket buy-in'],['hdcpFirstAmount','Handicap first-place prize'],
    ['hdcpSecondAmount','Handicap second-place prize'],
    ['scratchBuyin','Scratch bracket buy-in'],['scratchFirstAmount','Scratch first-place prize'],
    ['scratchSecondAmount','Scratch second-place prize'],
    ['highBuyin','High Game entry'],['pairsBuyin','Doubles entry per bowler']
  ];
  const legacyText=(en,es)=>$('language')?.value==='es'?es:en;
  function drawLegacyPlaceInputs(form,defaults=[]){
    const count=Number(form.elements.namedItem('pairsPaidPlaces')?.value);
    const container=$('legacyPayoutPlaces');
    if(!container)return;
    if(!Number.isSafeInteger(count)||count<1||count>20){
      container.replaceChildren();
      return;
    }
    const current=[...form.querySelectorAll('[data-legacy-place]')].map(el=>el.value);
    container.innerHTML=Array.from({length:count},(_,i)=>
      '<label>'+esc(legacyText('Doubles place ','Lugar de Dobles ')+(i+1))+
      ' (%)<input type="number" required min="0.01" max="100" step="0.01" data-legacy-place="'+i+
      '" placeholder="'+esc(legacyText('Enter percentage','Ingrese porcentaje'))+
      '" value="'+esc(current[i]??defaults[i]??'')+'"></label>'
    ).join('');
  }
  async function refreshLegacyReview(){
    const id=current?.id;
    if(!id||!admin||!current.can_manage||$('legacyReviewCard').classList.contains('hidden'))
      return;
    legacyPreview=null;
    const box=$('legacyReviewContent');
    box.textContent=legacyText('Checking saved scores, prizes and the permanent ledger…',
      'Verificando puntuaciones, premios y registros financieros guardados…');
    const [preview,savedState]=await Promise.all([
      api('/legacy/preflight?id='+encodeURIComponent(id)),
      api('/state?id='+encodeURIComponent(id))
    ]);
    if(current?.id!==id||$('legacyReviewCard').classList.contains('hidden'))return;
    // Never prepare payout terms from an out-of-date or unrelated snapshot.
    if(!savedState?._legacyReadOnly||
      savedState._serverUpdatedAt!==preview.serverRevision)
      throw Error('The legacy configuration changed during review. Refresh archive readiness.');
    legacyPreview={competitionId:id,preview};
    const blank=preview.modernizationCandidateVerified===true;
    const firstSession=preview.firstSessionInitialization===true;
    const stats=preview.stats||{},ready=(preview.archiveCandidateVerified===true||blank)&&
      Array.isArray(preview.blockers)&&preview.blockers.length===0;
    const metric=(label,value)=>'<div class="summary-metric"><span>'+esc(label)+
      '</span><strong>'+esc(value??0)+'</strong></div>';
    const summary='<div class="summary-grid">'+[
      [legacyText('Bowlers','Jugadores'),stats.bowlers],
      [legacyText('Participants','Participantes'),stats.participants],
      [legacyText('Incomplete participants','Participantes incompletos'),stats.incompleteParticipants],
      [legacyText('Published awards','Premios publicados'),stats.savedAwards],
      [legacyText('Saved personal ledgers','Registros financieros guardados'),stats.savedPersonalRecords],
      [legacyText('Existing archives','Archivos históricos existentes'),stats.priorArchives]
    ].map(([label,value])=>metric(label,value)).join('')+'</div>';
    const issues=ready
      ?'<p><strong>'+esc(firstSession?legacyText(
          'This competition has never started a session. Initial configuration can be reviewed without inventing an archive.',
          'Esta competencia no ha iniciado ninguna sesión. Puede configurar la primera sin inventar archivos históricos.')
        :blank?legacyText(
          'Empty current session verified. Existing archives and personal balances will not be duplicated.',
          'Sesión actual vacía verificada. No se duplicarán los archivos ni los saldos.')
        :legacyText('Archive snapshot verified. No writes performed.',
          'Archivo verificado. No se modificaron datos.'))+'</strong></p>'
      :'<p><strong>'+esc(legacyText('Conversion blocked. Preserve the current session until these problems are resolved:',
        'Conversión bloqueada. Conserve la sesión actual hasta corregir estos problemas:'))+
        '</strong></p><ul>'+(preview.blockers||[]).map(code=>'<li>'+esc(code)+'</li>').join('')+'</ul>';
    box.innerHTML=summary+issues;
    if(!ready)return;
    const savedConfig=savedState.config||{};
    const draftKey='prodrillos-rehearsal-payout:'+user.id+':'+id+':'+preview.snapshotDigest;
    let draft=null;
    try{
      const candidate=JSON.parse(localStorage.getItem(draftKey)||'null');
      if(candidate?.snapshotDigest===preview.snapshotDigest&&
        candidate?.serverRevision===preview.serverRevision&&
        candidate?.values&&typeof candidate.values==='object')draft=candidate;
    }catch{}
    // Carry forward only old numeric entry/prize values where there is an
    // exact same-named field. Never infer new percentage-based payout rules.
    const savedMoney=Object.fromEntries(legacyMoneyFields.map(([key])=>{
      const value=Number(savedConfig[key]);
      return [key,savedConfig[key]!=null&&Number.isFinite(value)&&value>=0?String(value):''];
    }));
    const today=new Date().toLocaleDateString('en-CA');
    const inputs=legacyMoneyFields.map(([key,label])=>
      '<label>'+esc(label)+' ($)<input type="number" required min="0" max="1000000" step="0.01" data-legacy-money="'+key+
      '" value="'+esc(draft?.values?.[key]??savedMoney[key])+'"></label>').join('');
    const options='<option value=""'+(!draft?.pairsPaidPlaces?' selected':'')+'>'+
      esc(legacyText('Choose number of paid places','Elija cantidad de lugares premiados'))+'</option>'+
      Array.from({length:20},(_,i)=>
      '<option value="'+(i+1)+'"'+(String(draft?.pairsPaidPlaces||'')===String(i+1)?' selected':'')+'>'+(i+1)+'</option>').join('');
    const savedRows=[
      ...legacyMoneyFields.map(([key,label])=>[label,savedConfig[key]]),
      ['Legacy High Game fixed award',savedConfig.highPayoutAmount],
      ['Legacy Doubles game award',savedConfig.pairsGamePayoutAmount],
      ['Legacy Doubles series award',savedConfig.pairsSeriesPayoutAmount]
    ].filter(([label,value])=>value!=null);
    const savedTable='<section class="legacy-saved-terms"><h3>'+
      esc(legacyText('Existing saved legacy configuration — read only',
        'Configuración histórica guardada — solo lectura'))+'</h3>'+
      '<p class="hint">'+esc(legacyText(
        'These are the actual stored settings. They are NOT automatically translated into the new payout formulas.',
        'Estos son los valores guardados. NO se convierten automáticamente a las nuevas fórmulas de premios.'))+'</p>'+
      '<div class="legacy-saved-grid">'+savedRows.map(([label,value])=>
      '<div class="legacy-saved-row"><span>'+esc(label)+'</span><strong>$'+
      esc(value)+'</strong></div>').join('')+'</div>'+
      '<details><summary>'+esc(legacyText('View all original payout fields','Ver todos los campos de premios originales'))+
      '</summary><pre>'+esc(JSON.stringify(savedConfig,null,2))+'</pre></details></section>';
    const enabled=preview.conversionEnabled===true;
    const warning=enabled&&blank&&preview.productionEmptyModernizationOnly
      ?legacyText('Verified EMPTY-session modernization is enabled for this production release. Review all new payout terms and acknowledge preservation of your existing archives. Completed legacy sessions cannot be converted here.',
        'La actualización de la sesión VACÍA verificada está habilitada para esta versión de producción. Revise los nuevos premios y confirme que se conservarán los archivos históricos. Las sesiones anteriores completadas no pueden convertirse aquí.')
      :enabled?legacyText('Conversion is enabled on this isolated test backend. Verify every payout and archive acknowledgement before submitting.',
        'La conversión está habilitada en este servidor de pruebas aislado. Verifique los premios y las confirmaciones antes de continuar.')
      :legacyText('Review only. Conversion is DISABLED until rehearsal and release approval. You cannot reset this session here.',
        'Solo revisión. La conversión está DESHABILITADA hasta aprobar las pruebas. Aquí no se puede reiniciar esta sesión.');
    box.insertAdjacentHTML('beforeend',
      savedTable+'<p class="hint">'+esc(warning)+'</p>'+
      '<form id="legacyConversionForm" class="legacy-review-form"><h3>'+
      esc(firstSession?legacyText('First session — review modern payouts',
        'Primera sesión — revisar premios nuevos'):blank?legacyText('Current empty session — review modern payouts',
        'Sesión actual vacía — revisar premios nuevos'):legacyText(
        'Next session settings — review each amount',
        'Configuración de la próxima sesión — revise cada monto'))+'</h3>'+
      '<p class="hint">'+esc(legacyText(
        'Editable proposal only. Exact saved entry/prize amounts were carried forward for review; choose the new Doubles percentage rules yourself. Nothing here updates Neon while conversion is disabled.',
        'Solo propuesta editable. Los costos y premios guardados se copiaron para revisión; elija los nuevos porcentajes de Dobles. Nada actualiza Neon mientras la conversión esté deshabilitada.'))+'</p>'+
      (blank&&!firstSession?'':'<div class="form-grid"><label>'+esc(legacyText('New session name','Nombre de la nueva sesión'))+
      '<input type="text" name="newSessionLabel" required maxlength="120" value="'+
      esc(legacyText('Next session','Próxima sesión'))+'"></label><label>'+
      esc(legacyText('New session date','Fecha de la nueva sesión'))+
      '<input type="date" name="newSessionDate" required value="'+esc(today)+'"></label></div>')+
      '<div class="form-grid legacy-money-grid">'+inputs+'</div>'+
      '<div class="form-grid"><label>'+esc(legacyText('Paid Doubles series places','Lugares premiados en Dobles'))+
      '<select name="pairsPaidPlaces" required>'+options+'</select></label></div>'+
      '<div class="form-grid legacy-money-grid" id="legacyPayoutPlaces"></div>'+
      '<div class="legacy-draft-actions"><button type="button" id="legacySaveDraft" class="secondary">'+
      esc(legacyText('Save draft on this browser only','Guardar propuesta solo en este navegador'))+
      '</button><p class="hint" id="legacyDraftStatus" role="status">'+
      esc(draft?legacyText('Your locally saved draft was restored. Nothing has been changed in Neon.',
        'Se recuperó su propuesta local. Nada cambió en Neon.'):legacyText(
        'You may edit these fields now. Drafts are not sent to Neon.',
        'Puede editar estos campos ahora. Las propuestas no se envían a Neon.'))+
      '</p></div><div class="legacy-approvals"><label><input type="checkbox" name="acknowledgeOriginalPayouts" required> '+
      esc(firstSession?legacyText(
        'I verified that this competition has no previous session, awards or personal balances to archive.',
        'Verifiqué que esta competencia no tiene sesiones, premios ni saldos anteriores para archivar.')
        :blank?legacyText(
          'I verified this session is empty and historical payouts are already preserved in previous archives.',
          'Verifiqué que esta sesión está vacía y los pagos históricos ya están guardados en archivos anteriores.')
        :legacyText('I verified the original fixed-dollar awards and personal balances will be archived without recalculation.',
          'Verifiqué que los premios originales y saldos se archivarán sin recalcularlos.'))+'</label>'+
      '<label><input type="checkbox" name="'+(blank?'acknowledgeEmptyModernization':'acknowledgeArchiveAndReset')+'" required> '+
      esc(firstSession?legacyText(
        'I approve creating the first empty competition session with the reviewed payout settings, without deleting any existing records.',
        'Apruebo crear la primera sesión vacía con los premios revisados, sin borrar registros existentes.')
        :blank?legacyText(
        'I approve updating only this unused session payout configuration, without a new archive or clearing existing records.',
        'Apruebo actualizar solo los premios de esta sesión sin uso, sin crear otro archivo ni borrar registros.')
        :legacyText('I approve archiving the complete old session BEFORE creating an empty new one with different payout rules.',
          'Apruebo archivar la sesión anterior ANTES de crear una nueva sin puntajes y con otras reglas de premios.'))+'</label></div>'+
      '<p class="hint">'+esc(legacyText('The new session will need a separate manager confirmation of buy-ins before registrations open.',
        'La nueva sesión necesitará una confirmación independiente de los costos antes de abrir inscripciones.'))+'</p>'+
      '<button type="submit"'+(enabled?'':' disabled')+'>'+
      esc(firstSession?legacyText('Create verified first session','Crear primera sesión verificada')
        :blank?legacyText('Modernize verified empty session','Actualizar sesión vacía verificada')
        :legacyText('Archive verified session and create next session',
          'Archivar sesión verificada y crear la siguiente'))+'</button></form>');
    const form=$('legacyConversionForm');
    drawLegacyPlaceInputs(form,draft?.percentages||[]);
    form.elements.namedItem('pairsPaidPlaces').addEventListener('change',()=>drawLegacyPlaceInputs(form));
    $('legacySaveDraft').addEventListener('click',()=>{
      const values=Object.fromEntries([...form.querySelectorAll('[data-legacy-money]')]
        .map(input=>[input.dataset.legacyMoney,input.value]));
      const saved={snapshotDigest:preview.snapshotDigest,serverRevision:preview.serverRevision,
        values,pairsPaidPlaces:form.elements.namedItem('pairsPaidPlaces').value,
        percentages:[...form.querySelectorAll('[data-legacy-place]')].map(input=>input.value),
        newSessionLabel:form.elements.namedItem('newSessionLabel')?.value||'',
        newSessionDate:form.elements.namedItem('newSessionDate')?.value||''};
      try{
        localStorage.setItem(draftKey,JSON.stringify(saved));
        $('legacyDraftStatus').textContent=legacyText(
          'Draft saved on this browser only. No changes were sent to Neon.',
          'Propuesta guardada solo en este navegador. No se enviaron cambios a Neon.');
      }catch{
        $('legacyDraftStatus').textContent=legacyText(
          'This browser could not save the local draft. No changes were sent to Neon.',
          'Este navegador no pudo guardar la propuesta local. No se enviaron cambios a Neon.');
      }
      localize();
    });
    if(draft){
      if(form.elements.namedItem('newSessionLabel'))form.elements.namedItem('newSessionLabel').value=draft.newSessionLabel||'';
      if(form.elements.namedItem('newSessionDate'))form.elements.namedItem('newSessionDate').value=draft.newSessionDate||'';
    }
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      try{
        if(!enabled||!ready||legacyPreview?.competitionId!==id||legacyPreview.preview!==preview)
          throw new Error('Refresh the historical review before continuing.');
        if(!form.reportValidity())return;
        const percentages=[...form.querySelectorAll('[data-legacy-place]')].map(input=>Number(input.value));
        const sum=percentages.reduce((n,x)=>n+x,0);
        if(percentages.length!==Number(form.elements.namedItem('pairsPaidPlaces').value)||
          percentages.some(x=>!Number.isFinite(x)||x<=0||x>100)||sum>100.0000001)
          throw new Error('Doubles paid places must total at most 100% with a positive percentage per place.');
        const config=Object.fromEntries([...form.querySelectorAll('[data-legacy-money]')].map(input=>
          [input.dataset.legacyMoney,Number(input.value)]));
        config.pairsPaidPlaces=percentages.length;config.pairsPlacePercentages=percentages;
        const approval={
          confirmed:true,
          acknowledgeOriginalPayouts:form.elements.namedItem('acknowledgeOriginalPayouts').checked,
          ...(blank?{acknowledgeEmptyModernization:form.elements.namedItem('acknowledgeEmptyModernization').checked}
            :{acknowledgeArchiveAndReset:form.elements.namedItem('acknowledgeArchiveAndReset').checked}),
          snapshotDigest:preview.snapshotDigest,serverRevision:preview.serverRevision,
          modernConfig:config,
          ...(blank&&!firstSession?{}:{
            newSessionLabel:form.elements.namedItem('newSessionLabel').value.trim(),
            newSessionDate:form.elements.namedItem('newSessionDate').value
          })
        };
        if(!approval.acknowledgeOriginalPayouts||
           !(blank?approval.acknowledgeEmptyModernization:approval.acknowledgeArchiveAndReset))
          throw new Error('Both financial-history and session-change acknowledgements are required.');
        if(!window.confirm(firstSession?legacyText(
          'FINAL CONFIRMATION: Initialize the FIRST competition session? No historical event or paid balance exists, and no archive will be created.',
          'CONFIRMACIÓN FINAL: ¿Crear la PRIMERA sesión de la competencia? No existen eventos o pagos históricos ni se creará un archivo.')
          :blank?legacyText(
          'FINAL CONFIRMATION: Update this EMPTY session to the reviewed modern payouts? Previous archives, scores and personal balances will not be changed.',
          'CONFIRMACIÓN FINAL: ¿Actualizar esta sesión VACÍA con los nuevos premios? Los archivos, puntajes y saldos anteriores no cambiarán.')
          :legacyText(
          'FINAL CONFIRMATION: Archive the complete historical session, preserve its prizes and create an empty new session? This will close the old active session.',
          'CONFIRMACIÓN FINAL: ¿Archivar la sesión histórica completa, conservar sus premios y crear una sesión nueva vacía? Se cerrará la sesión anterior.')))return;
        const submit=form.querySelector('button[type="submit"]');
        submit.disabled=true;
        try{
          const converted=await api('/legacy/'+(blank?'modernize':'convert')+'?id='+encodeURIComponent(id),'POST',approval);
          if(blank){
            if(!converted?.saved||!converted?.modernizedEmptySession||!converted?.sessionId||
              converted.firstSessionInitialized!==firstSession)
              throw new Error('Empty-session upgrade was not confirmed. Inspect saved data before retrying.');
            const [stored,history]=await Promise.all([
              api('/state?id='+encodeURIComponent(id)),
              api('/sessions?competition_id='+encodeURIComponent(id)+'&all=1')
            ]);
            if(stored?._sessionId!==converted.sessionId||stored?._legacyReadOnly||
              !Array.isArray(history)||history.length!==Number(stats.priorArchives)||
              Object.keys(config).some(key=>Array.isArray(config[key])
                ?!Array.isArray(stored.config?.[key])||
                  stored.config[key].length!==config[key].length||
                  config[key].some((value,i)=>Number(stored.config[key][i])!==Number(value))
                :Number(stored.config?.[key])!==Number(config[key])))
              throw new Error('The modern configuration or original archives were not verified. Do not retry; inspect saved sessions.');
          }else{
            if(!converted?.saved||!converted?.archivedSessionId||!converted?.newSessionId)
              throw new Error('Archive confirmation was incomplete. Inspect session history before retrying.');
            const [stored,history]=await Promise.all([
              api('/state?id='+encodeURIComponent(id)),
              api('/sessions?competition_id='+encodeURIComponent(id)+'&all=1')
            ]);
            if(stored?._sessionId!==converted.newSessionId||
              !Array.isArray(history)||!history.some(item=>item.id===converted.archivedSessionId))
              throw new Error('The archive or new session was not visible after conversion. Do not resubmit; inspect saved sessions.');
          }
          legacyPreview=null;
          await openCompetition(id);
          notice(blank?legacyText(
            'Empty session updated; previous archives preserved. Confirm buy-ins to open signup.',
            'Sesión vacía actualizada; archivos anteriores conservados. Confirme los costos para abrir inscripciones.')
            :legacyText('Original session archived and verified. New session ready for buy-in approval.',
              'Sesión original archivada y verificada. Nueva sesión lista para aprobar los costos.'));
        }finally{submit.disabled=false;}
      }catch(error){fail(error);}
    });
  }
  async function openCompetition(id) {
    qrStopScanning();
    if(rollingOver)throw new Error('Session rollover is still saving and verifying in Neon. Do not switch competitions yet.');
    const rows = await listCompetitions();
    const competition = rows.find(c => c.id === id);
    if (!competition) throw new Error('Competition is not available.');
    if (competition.format==='delarosa'||competition.name.trim().toLocaleLowerCase() === 'de la rosa masters') {
      // Finish any pending auth refresh before navigating so the tournament page
      // can reuse this session without presenting a second sign-in form.
      if(user){
        const handoffToken=await activeToken();
        sessionStorage.setItem('dlr-auth-handoff',JSON.stringify({token:handoffToken,user,createdAt:Date.now()}));
      }
      location.href = '/DeLaRosaMasters/?competition='+encodeURIComponent(competition.id);
      return;
    }
    if(saving||saveJob){
      try{await flushSaves();}
      catch(error){
        throw new Error('Cannot open '+competition.name+' while changes to '+
          (current?.name||'the previous competition')+' remain unsaved in Neon. '+
          'Reopen the previous competition, resolve the pending save, or reload after preserving your draft. Details: '+(error.message||error));
      }
    }
    current = competition;
    // This shortcut is bound to the last archive verified by this editor only.
    // Never carry its ID into a different competition or a new login.
    $('viewLastArchivedSession').classList.add('hidden');
    delete $('viewLastArchivedSession').dataset.session;
    legacyPreview=null;
    $('legacyReviewCard').classList.add('hidden');
    $('legacyReviewContent').textContent='';
    $('currentCompetition').textContent = competition.name;
    $('viewerCompetition').textContent = competition.name;
    $('printSavedSession').classList.add('hidden');
    if (admin&&competition.can_manage) {
      const state = await api('/state?id=' + encodeURIComponent(id));
      if(state?._legacyReadOnly){
        // Never open the modern percentage-based editor for a stored fixed-
        // dollar session. Merging new config defaults would misstate awards.
        // Display the server-published snapshot, with no local draft or writes.
        serverBase=null;
        const saved=await api('/results?id='+encodeURIComponent(id));
        renderViewer(saved.results,null,{});
        $('legacyReviewCard').classList.remove('hidden');
        $('legacyReviewRefresh').onclick=()=>void refreshLegacyReview().catch(fail);
        show('portalViewer');
        void refreshLegacyReview().catch(fail);
        $('nightlyBowlerCard').classList.add('hidden');
        notice('Current legacy session is read-only while its original payout settings are reviewed. Existing archives, scores and payments remain preserved; no modernization or conversion is automatic.');
        return;
      }
      await loadPermanentRoster(id);
      // Existing states did not store a currency. Use the league's location as
      // an initial suggestion only; the manager can choose MXN or USD before
      // registrations and scores are committed. Explicit saved currency wins.
      const country=String(competition.country||'').trim().toLowerCase();
      const countryDefault=['us','usa','united states','united states of america','estados unidos'].includes(country)?'USD':'MXN';
      const initialState=state?{...window.BowlingApp.fresh(),...state}:window.BowlingApp.fresh();
      initialState.config={...initialState.config,currency:state?.config?.currency||countryDefault};
      serverBase=structuredClone(initialState);
      window.BowlingApp.setState(serverBase);
      $('sessionLabel').value='';$('sessionDate').value='';
      let recovered=false;
      try{
        const draft=JSON.parse(localStorage.getItem(draftKey(id))||'null');
        if(draft){
          const restored=window.MonsterSaveMerge.merge(draft.base,draft.p_state,serverBase);
          window.BowlingApp.setState(restored);
          // A recovered draw must be saved BEFORE any recovered scores.
          // Do not retry the same combined request that the pre-score guard rejected.
          if(restored.generated&&!bracketsVerified(restored))
            notice('Recovered an unsaved bracket draw and any local scores. Click Save Brackets first; your score draft is preserved on this device.');
          else queueSave(restored);
          recovered=true;
        }
      }catch(error){notice('Pending edits are stored on this computer. '+error.message);show('managerApp');return;}
      show('managerApp');
      if(!recovered)notice('Editing ' + competition.name + '. Changes save to Neon.');
      if($('session-signup').classList.contains('active'))
        void loadNightlyManager().catch(fail);
      return;
    }
    const result = await api('/results?id=' + encodeURIComponent(id));
    renderViewer(result.results, result.personal,{currency:result.currency});
    show('portalViewer');
    $('nightlyBowlerCard').classList.toggle('hidden',admin||role!=='user');
    if(!admin&&role==='user')void loadNightlyBowler().catch(fail);
  }
  function renderViewer(data, personal, context={}) {
    if (!data?.bowlers) {
      $('viewerContent').innerHTML = '<p>Results have not been published for this competition yet.</p>';
      localize();
      return;
    }
    const people = Object.fromEntries(data.bowlers.map(b => [b.id,b]));
    const savedCurrency=context.currency||data.currency||data.summary?.currency;
    const country=typeof current==='undefined'?'':String(current?.country||'').trim().toLowerCase();
    const currency=savedCurrency==='USD'||savedCurrency==='MXN'?savedCurrency:['us','usa','united states','united states of america','estados unidos'].includes(country)?'USD':'MXN';
    const dollars=cents=>(Number(cents)<0?'−':'')+(currency==='USD'?'US':'MX')+String.fromCharCode(36)+(Math.abs(Number(cents)||0)/100).toFixed(2);
    const canViewSummary=!!(user&&!sessionExpired&&admin&&current?.can_manage);
    const summary=data.summary||{handicapBrackets:data.brackets?.hdcp?.length||0,scratchBrackets:data.brackets?.scratch?.length||0,highGameEntries:data.bowlers.filter(b=>b.high).length,doublesTeams:(data.pairs||[]).length,totalIncome:0,totalPayout:(data.awards||[]).reduce((n,a)=>n+Number(a.amount||0),0),totalProfit:0};
    const summaryCard=canViewSummary?'<div class="card"><h2>Competition Summary</h2><p class="hint">Overview of entries, payouts and profit for this session.</p><div class="summary-grid">'+[['Handicap brackets played',summary.handicapBrackets],['Scratch brackets played',summary.scratchBrackets],['High Game entries',summary.highGameEntries],['Doubles teams played',summary.doublesTeams],['Total income',dollars(summary.totalIncome)],['Total payout',dollars(summary.totalPayout)],['Total profit',dollars(summary.totalProfit)]].map(([label,value],index)=>'<div class="summary-metric '+(index===6?'profit':'')+'"><span>'+esc(label)+'</span><strong class="'+(index===6?(summary.totalProfit<0?'balance-negative':summary.totalProfit>0?'balance-positive':'balance-zero'):'')+'">'+value+'</strong></div>').join('')+'</div></div>':'';
    const selected=people[personal?.id];
    const visibleBowlers=alphabetical(canViewSummary?data.bowlers:selected?[selected]:[]);
    const visibleAwards=canViewSummary?(data.awards||[]):(personal?.winnings||[]);
    const score = (b,g) => b.scores?.['g'+g] == null ? '—' : esc(Number(b.scores['g'+g]) + Number(b.handicap || 0));
    const scoreboard = '<div class="card"><h2>Scores with handicap</h2><div class="table-wrap"><table><thead><tr><th>Bowler</th><th>Game 1</th><th>Game 2</th><th>Game 3</th></tr></thead><tbody>' +
      visibleBowlers.map(b => '<tr><td>' + esc(b.name) + '</td>' + [1,2,3].map(g => '<td>' + score(b,g) + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div></div>';
    const payoutTotals=Object.values(visibleAwards.reduce((totals,award)=>{
      const key=award.name||'Bowler';
      totals[key]??={name:key,amount:0};totals[key].amount+=Number(award.amount||0);return totals;
    },{})).sort((a,b)=>a.name.localeCompare(b.name));
    const awards = '<div class="card"><h2>Payout summary</h2>' + (payoutTotals.length
      ? '<div class="table-wrap"><table><thead><tr><th>Bowler</th><th class="money">Total winnings</th></tr></thead><tbody>'+
        payoutTotals.map(a => '<tr><td>' + esc(a.name) + '</td><td class="money balance-positive">' + dollars(a.amount) + '</td></tr>').join('') + '</tbody></table></div>'
      : '<p>Results are pending.</p>') + '</div>';
    const pairs = '<div class="card"><h2>Doubles teams</h2><ul>' + (data.pairs || []).filter(ids=>canViewSummary||ids.includes(selected?.id)).map(ids =>
      '<li>' + ids.map(id => esc(people[id]?.name || 'Bowler')).join(' &amp; ') + '</li>').join('') + '</ul></div>';
    const bracketCards = bowlerId => ['hdcp','scratch'].map(type => {
      const entries=(data.brackets?.[type]||[]).map((ids,index)=>({ids,index:data.bracketNumbers?.[type]?.[index]??index}))
        .filter(entry=>canViewSummary||!!bowlerId&&entry.ids.includes(bowlerId));
      return '<div class="card"><h2>'+(type==='hdcp'?'Handicap':'Scratch')+' brackets</h2>'+
        (entries.length?entries.map(entry=>'<div class="bracket-scroll">'+
          window.BowlingApp.bracketGraphic(entry.ids,type,data.bowlers,entry.index)+'</div>').join(''):
          '<p class="hint">'+(bowlerId?'This bowler is not entered in any '+(type==='hdcp'?'handicap':'scratch')+' brackets.':'No brackets generated.')+'</p>')+'</div>';
    }).join('');
    const financeCard=value=>{
      if(!value)return '<div id="balanceCard" class="card"><h2>Your balance</h2><p>Select your bowler above and choose Show my balance.</p></div>';
      const personal=value;
      // Unit prices in legacy and current ledger labels are descriptive only.
      // Render one explicit currency amount per charge, not "$50: MX$50".
      const charges = personal.charges?.map(x => {
        const label=String(x.label||'').replace(/\s*[×x]\s*(?:(?:MX|US)\s*)?\$?\s*[\d,]+\.\d{1,2}\s*$/i,'').trim();
        return '<li>'+esc(label)+': '+dollars(x.amount)+'</li>';
      }).join('') || '<li>No charges</li>';
      const winnings = personal.winnings?.map(x => '<li>' + esc(x.description) + ': ' + dollars(x.amount) + '</li>').join('') || '<li>No winnings</li>';
      const settlement=personal.settlement??(personal.won-(personal.paid?0:personal.due));
      const balanceClass = settlement < 0 ? 'balance-negative' : settlement > 0 ? 'balance-positive' : 'balance-zero';
      return '<div id="balanceCard" class="card"><h2>Your balance — ' + esc(personal.name) + '</h2><h3>Entry charges</h3><ul>' + charges + '</ul><p><strong>Total charges: ' + dollars(personal.due) + '</strong> · Paid: '+(personal.paid?'Yes':'No')+' · Outstanding: '+dollars(personal.outstanding??(personal.paid?0:personal.due))+'</p><h3>Winnings</h3><ul>' + winnings + '</ul><p><strong>Total won: ' + dollars(personal.won) + '</strong></p><p class="' + balanceClass + '"><strong>Current balance: ' + dollars(settlement) + '</strong></p></div>';
    };
    // Manager and SuperAdmin accounts use the complete official-results view,
    // never the bowler account-claim, private-balance or push-notification UI.
    // The authenticated backend remains responsible for financial authorization.
    const showBowlerTools=!admin;
    const finances=showBowlerTools?financeCard(personal):'';
    const progress=(data.matchups||[]).map(round=>round.filter(x=>canViewSummary||x.id===selected?.id)).map((round,i)=>'<div class="card"><h2>Game '+(i+1)+' matchups</h2>'+
      (round.length?'<ul class="matchup-list">'+alphabetical(round).map(x=>'<li><strong>'+esc(x.name)+' ('+x.opponents.length+')</strong>: '+alphabetical(x.opponents).map(esc).join(', ')+'</li>').join('')+'</ul>':'<p class="hint">Matchups will appear when the previous game is decided.</p>')+
      ((data.standings?.[i]||[]).filter(x=>canViewSummary||x.name===selected?.name).length?'<h3>Standings after game '+(i+1)+'</h3><ol>'+data.standings[i].filter(x=>canViewSummary||x.name===selected?.name).map(x=>'<li>'+esc(x.name)+' — '+esc(x.score)+'</li>').join('')+'</ol>':'')+'</div>').join('');
    const notify='<div class="card no-print"><h2>Your bowler and notifications</h2><p>Choose your bowler once for this league. Confirming links this account until a Manager resets it. Notifications are optional.</p><div class="form-grid"><label>Bowler<select id="notifyBowler"'+(personal?' disabled':'')+'>'+alphabetical(data.bowlers).map(b=>'<option value="'+esc(b.id)+'"'+(b.id===(personal?.id||context.selectedId)?' selected':'')+'>'+esc(b.name)+'</option>').join('')+'</select></label><label>Event date<input id="notifyDate" type="date" value="'+esc(context.date||new Date().toLocaleDateString('en-CA'))+'"></label></div><div class="actions"><button id="showBalance" type="button">Show my balance</button><button id="enableNotifications" class="secondary" type="button">Enable notifications</button></div><p id="notifyStatus" class="hint"></p></div>';
    $('viewerContent').innerHTML = (canViewSummary?'<nav class="tabs viewer-tabs no-print"><button type="button" data-viewer-tab="results" class="active">Results</button><button type="button" data-viewer-tab="summary">Summary</button></nav><section class="viewer-tab-panel" data-viewer-panel="summary">'+summaryCard+'</section>':'')+'<section class="viewer-tab-panel active" data-viewer-panel="results">' + (showBowlerTools?notify+finances:'') + ((selected||canViewSummary)?progress + scoreboard + '<div id="userBrackets">'+bracketCards(personal?.id)+'</div>' + pairs + awards:'') + '</section>';
    document.querySelectorAll('[data-viewer-tab]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-viewer-tab]').forEach(x=>x.classList.toggle('active',x===button));document.querySelectorAll('[data-viewer-panel]').forEach(x=>x.classList.toggle('active',x.dataset.viewerPanel===button.dataset.viewerTab));}));
    $('notifyBowler')?.addEventListener('change',()=>{if(!canViewSummary)renderViewer(data,null,{...context,selectedId:$('notifyBowler').value,date:$('notifyDate').value});});
    $('showBalance')?.addEventListener('click',async()=>{
      try {
        const selectedBowler=data.bowlers.find(b=>b.id===$('notifyBowler').value);
        if(!selectedBowler)throw new Error('Select your own bowler from the list.');
        const profiles=await api('/roster?competition_id='+encodeURIComponent(current?.id));
        const match=matchRosterProfile(profiles,selectedBowler);
        if(!personal){
          if(!match.profile)throw new Error(match.reason==='ambiguous'||match.reason==='conflict'
            ?'This bowler matches multiple roster profiles. Ask a manager to correct the Player IDs or email links.'
            :'This bowler has no matching permanent roster profile. Ask a manager to correct the roster.');
          const message='Confirm that you are '+selectedBowler.name+'. This profile can only be changed by a Manager.';
          if(!confirm(window.BowlingApp?.translateText(message)||message))return;
          await api('/roster/claim','POST',{competitionId:current.id,profileId:match.profile.id,bowlerId:selectedBowler.id,sessionId:context.sessionId,confirm:true});
        }
        const selectedId=$('notifyBowler').value,selectedName=$('notifyBowler').selectedOptions[0].textContent;
        const date=$('notifyDate').value;
        const linked=await api('/balance','POST',{competitionId:current?.id,bowlerId:selectedId,sessionId:context.sessionId});
        // Before account claim, the API intentionally sent only roster names.
        // Refetch after claim to obtain just this bowler's official results.
        const refreshed=!personal?await api(context.sessionId
          ?'/session?id='+encodeURIComponent(context.sessionId)
          :'/results?id='+encodeURIComponent(current.id)):null;
        renderViewer(refreshed?.results||data,refreshed?.personal||linked.personal,
          {...context,date,selectedId,currency:refreshed?.currency||context.currency});
        $('notifyStatus').textContent='Balance linked to '+selectedName+'. Notifications remain off.';localize();
      } catch(error){$('notifyStatus').textContent=error.message;localize();}
    });
    $('enableNotifications')?.addEventListener('click',async()=>{
      try {
        if(!('serviceWorker' in navigator)||!('PushManager' in window)||!cfg.vapidPublicKey) throw new Error('Notifications are not available on this device yet.');
        if(await Notification.requestPermission()!=='granted') throw new Error('Notification permission was not granted.');
        const registration=await navigator.serviceWorker.ready;
        const key=Uint8Array.from(atob(cfg.vapidPublicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
        const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
        const linked=await api('/notifications','POST',{competitionId:current?.id,bowlerId:$('notifyBowler').value,eventDate:$('notifyDate').value,sessionId:context.sessionId,subscription});
        if(linked.personal)renderViewer(data,linked.personal,{...context,date:$('notifyDate').value});
        $('notifyStatus').textContent='Notifications enabled for '+$('notifyBowler').selectedOptions[0].textContent+' on '+$('notifyDate').value+'.';
        localize();
      } catch(error){$('notifyStatus').textContent=error.message;localize();}
    });
    localize();
  }
  async function openSavedSession(id) {
    const result=await api('/session?id='+encodeURIComponent(id));
    const rows=await listCompetitions(), competition=rows.find(c=>c.id===result.competitionId);
    if(competition?.format==='delarosa'||result.results?.format==='delarosa-masters-v1'){
      const handoffToken=await activeToken();
      sessionStorage.setItem('dlr-auth-handoff',JSON.stringify({token:handoffToken,user,createdAt:Date.now()}));
      location.href='/DeLaRosaMasters/?competition='+encodeURIComponent(result.competitionId)+'&session='+encodeURIComponent(result.id);
      return;
    }
    current=competition||{id:result.competitionId,name:'Competition'};
    legacyPreview=null;
    $('legacyReviewCard').classList.add('hidden');
    $('legacyReviewContent').textContent='';
    $('viewerCompetition').textContent=(competition?.name||'Competition')+' › '+result.label;
    renderViewer(result.results,result.personal,{sessionId:result.id,date:String(result.date).slice(0,10),currency:result.currency});
    $('printSavedSession').classList.toggle('hidden',!(admin&&competition?.can_manage));
    $('nightlyBowlerCard').classList.add('hidden'); // Archived sessions never accept signups.
    // Clear any previous CURRENT-session migration warning; this archive is
    // already saved and has no conversion prerequisite for viewing it.
    notice('Saved historical session — read-only. Original scores, brackets, awards, payments and payouts are preserved.');
    show('portalViewer');
  }
  async function printSavedSession() {
    if(!(admin&&current?.can_manage))throw new Error('Manager access required.');
    const sheet=$('sessionPrintSheet'),source=$('viewerContent'),copy=source.cloneNode(true);
    copy.removeAttribute('id');copy.className='session-print-content';
    copy.querySelectorAll('.no-print,#balanceCard,button,input,select').forEach(element=>element.remove());
    copy.querySelectorAll('[id]').forEach(element=>element.removeAttribute('id'));
    const translate=value=>window.BowlingApp?.translateText(value)||value;
    const printed=new Intl.DateTimeFormat(window.BowlingApp?.language()==='es'?'es-MX':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date());
    sheet.innerHTML='<div class="print-brand"><img class="print-badge" src="assets/app-icon.svg" alt="ProDrillOS championship badge"><img class="print-main-logo" src="assets/brackets-logo.png?v=20260922" alt="Brackets by ProDrillOS"><div class="print-title"><h1>'+esc(translate('Saved Session Report'))+'</h1><p><strong>'+esc($('viewerCompetition').textContent)+'</strong></p><p>'+esc(translate('Printed'))+': '+esc(printed)+'</p></div></div>';
    sheet.appendChild(copy);
    sheet.insertAdjacentHTML('beforeend','<footer class="print-footer">Brackets by ProDrillOS · brackets.prodrillos.com</footer>');
    await Promise.all([...sheet.querySelectorAll('img')].map(image=>image.complete?image.decode?.().catch(()=>{}):new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});})));
    if(document.fonts?.ready)await document.fonts.ready;
    const cleanup=()=>document.body.classList.remove('print-saved-session');
    document.body.classList.add('print-saved-session');
    window.addEventListener('afterprint',cleanup,{once:true});
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    window.print();
    setTimeout(cleanup,60000);
  }
  let serverBase=null;
  let lastSaveError=null;
  const draftKey=id=>'prodrillos-pending:'+user.id+':'+id;
  function keepDraft(job){
    try{localStorage.setItem(draftKey(job.p_competition_id),JSON.stringify({...job,savedLocallyAt:new Date().toISOString()}));}
    catch{notice('This computer could not keep a recovery copy. Keep this page open until the server confirms the save.');}
  }
  function bracketsVerified(data=window.BowlingApp.getState()) {
    return !!serverBase&&(!data?.generated||
      (serverBase.generated===true&&
       JSON.stringify(serverBase.brackets||{})===JSON.stringify(data.brackets||{})));
  }
  function preserveBracketDraft(data) {
    if(!current?.id||!admin)return;
    const copy=structuredClone(data),snapshot=window.BowlingApp.snapshot(copy);
    keepDraft({p_competition_id:current.id,p_state:copy,
      p_results:snapshot.publicData,p_personal:snapshot.personal,
      base:structuredClone(serverBase)});
  }
  function queueSave(data) {
    if (!current || !admin) return;
    lastSaveError=null;
    const snapshot = window.BowlingApp.snapshot();
    saveJob = {p_competition_id:current.id,p_state:structuredClone(data),p_results:snapshot.publicData,p_personal:snapshot.personal,base:structuredClone(serverBase)};
    keepDraft(saveJob);
    notice('Saving changes…');
    if (!saving) void drainSaves();
  }
  async function drainSaves() {
    saving = true;
    while (saveJob) {
      const job = saveJob;
      saveJob = null;
      try {
        const jobSnapshot=window.BowlingApp.snapshot(job.p_state);job.p_results=jobSnapshot.publicData;job.p_personal=jobSnapshot.personal;
        let saved;
        for(let attempt=0;attempt<3;attempt++){
        try{saved=await api('/save?id=' + encodeURIComponent(job.p_competition_id),'POST',
          {state:job.p_state,results:job.p_results,personal:job.p_personal,eventDate:new Date().toLocaleDateString('en-CA')});break;}
        catch(error){
          const staleSave=error.status===409&&/session changed in another tab or device|\bstale\b/i.test(error.message||'');
          if(!staleSave||job.p_state._startNewSession||job.p_state._replaceBracketDraw||attempt===2)throw error;
          // /config may have created a config-only state row. Fill missing fields
          // with fresh defaults before merging, as when opening a competition.
          // Without this, omitted bracket arrays look like a changed draw.
          const latestRaw=await api('/state?id='+encodeURIComponent(job.p_competition_id));
          const latest=latestRaw?{...window.BowlingApp.fresh(),...latestRaw}:window.BowlingApp.fresh();
          const merged=window.MonsterSaveMerge.merge(job.base,job.p_state,latest);
          if(saveJob){saveJob.p_state=window.MonsterSaveMerge.merge(job.p_state,saveJob.p_state,merged);saveJob.base=structuredClone(latest);keepDraft(saveJob);}
          job.base=structuredClone(latest);job.p_state=merged;
          const snapshot=window.BowlingApp.snapshot(merged);job.p_results=snapshot.publicData;job.p_personal=snapshot.personal;
          if(current?.id===job.p_competition_id)window.BowlingApp.setState(saveJob?.p_state||merged);
          keepDraft(saveJob||job);
        }
        }
        lastSaveError=null;
        serverBase=structuredClone(job.p_state);serverBase._serverUpdatedAt=saved.updatedAt;serverBase._sessionId=saved.sessionId;delete serverBase._startNewSession;delete serverBase._replaceBracketDraw;
        if(saved.sessionId){window.BowlingApp.setSessionId(saved.sessionId);if(saveJob){saveJob.p_state._sessionId=saved.sessionId;if(saveJob.base)saveJob.base._sessionId=saved.sessionId;if(job.p_state._startNewSession)delete saveJob.p_state._startNewSession;if(job.p_state._replaceBracketDraw&&JSON.stringify(job.p_state.brackets)===JSON.stringify(saveJob.p_state.brackets))delete saveJob.p_state._replaceBracketDraw;}}
        if(!saveJob){try{localStorage.removeItem(draftKey(job.p_competition_id));}catch{}}
        if(saved.updatedAt){window.BowlingApp.setServerRevision(saved.updatedAt);if(saveJob){saveJob.p_state._serverUpdatedAt=saved.updatedAt;keepDraft(saveJob);}}
      }
      catch (error) { lastSaveError=error;saveJob = saveJob || job;keepDraft(saveJob);if($('scoreSaveState'))$('scoreSaveState').textContent='Not saved to server. '+error.message; notice('Save failed: ' + error.message + '. Your edits remain on this screen.'); break; }
      notice('Saved to Neon at ' + new Date().toLocaleTimeString());
      if($('scoreSaveState'))$('scoreSaveState').textContent='Scores saved to Neon.';
    }
    saving = false;
  }
  async function flushSaves() {
    while(saving) await new Promise(resolve=>setTimeout(resolve,50));
    if(saveJob) await drainSaves();
    while(saving) await new Promise(resolve=>setTimeout(resolve,50));
    if(saveJob) throw lastSaveError || new Error('Neon did not confirm the save. Check the Session Sign-Up requirements before retrying.');
    return true;
  }
  // Read the authoritative nightly eligibility before any staging-only test
  // scores are generated. Never guess from locally edited bracket/team counts.
  async function checkNightlyScoreReadiness() {
    if(!current?.can_manage) throw new Error('Open this competition as its manager.');
    const data=await api('/nightly/events?competition_id='+encodeURIComponent(current.id));
    const event=data.events?.find(row=>row.state_session_id===data.currentSessionId);
    if(!event) throw new Error('No current Session Sign-Up was found. Open Session Sign-Up to review the session before creating test scores.');
    if(event.status==='cancelled') throw new Error('This session was cancelled. No test scores can be saved.');
    const eligibility=event.eligibility;
    if(!eligibility) throw new Error('Nightly eligibility could not be verified. No test scores were created.');
    if(eligibility.unapprovedDoublesTeams>0) {
      throw new Error('Virtual Doubles has '+eligibility.proposedDoublesTeams+
        ' teams but only '+eligibility.verifiedDoublesTeams+' are covered by approved entries. '+
        'Review each bowler\'s actual team count in Session Sign-Up, obtain confirmation of the increased buy-in, approve handicaps if needed, and Sync approved entries before generating test scores. No scores were created.');
    }
    if(!eligibility.ready)
      throw new Error('No event meets the eight-bowler or eight-team minimum. Review Session Sign-Up before generating test scores.');
    if(!event.scoreReadiness||!event.scoreReadiness.ready)
      throw new Error('Before generating test scores, prepare and save every qualifying event in Neon: '+
        (event.scoreReadiness?.missing||[]).map(item=>item.label).join(', ')+
        '. Review Session Sign-Up. No scores were created.');
    return true;
  }
  async function saveNow(section) {
    if(!current||!admin)throw new Error('Manager access required.');
    const local=window.BowlingApp.getState();
    if(section==='scores'&&local.generated&&!bracketsVerified(local))
      throw new Error('Save and verify the bracket draw in Neon before saving scores. Your draft remains on this screen.');
    if(section==='brackets'){
      if(!serverBase)throw new Error('Reload the current session before saving brackets.');
      const base=structuredClone(serverBase);
      const officialScores=new Map((base.bowlers||[]).map(b=>[String(b.id),b.scores]));
      // Save a bracket-only revision first. Previously, an autosaved score in
      // the same unverified draft triggered the first-score guard and blocked
      // the draw itself; keep the user's scores separately on this device.
      const staged=structuredClone(local);
      staged.bowlers=(staged.bowlers||[]).map(b=>({
        ...b,scores:structuredClone(officialScores.get(String(b.id))||{g1:null,g2:null,g3:null})
      }));
      // Replacement permission must come from the explicit Generate action;
      // first-time draws need no old draw to replace.
      staged._replaceBracketDraw=local._replaceBracketDraw===true||!base.generated;
      const scoresWaiting=(local.bowlers||[]).some(b=>
        JSON.stringify(b.scores||{})!==
        JSON.stringify(officialScores.get(String(b.id))||{g1:null,g2:null,g3:null}));
      try{
        while(saving)await new Promise(resolve=>setTimeout(resolve,50));
        // A failed old combined-score save cannot repeatedly race this
        // explicit bracket-only operation. Its data remains in "local".
        saveJob=null;
        queueSave(staged);
        await flushSaves();
        const stored=await api('/state?id='+encodeURIComponent(current.id));
        if(stored?.generated!==local.generated||
          JSON.stringify(stored?.brackets||{})!==JSON.stringify(local.brackets||{}))
          throw new Error('Neon did not verify the bracket draw. Your local draft is retained.');
        if(scoresWaiting)preserveBracketDraft(window.BowlingApp.getState());
        window.BowlingApp.refresh();
        notice(scoresWaiting
          ?'Brackets saved and verified in Neon. Scores are still in your local draft; save them separately in Scoring.'
          :'Brackets saved and verified in Neon. Scoring and payment status may now be used.');
        return {saved:true,bracketsVerified:true,scoresWaiting};
      }catch(error){
        // Keep the ORIGINAL score-bearing draft even if staging failed.
        // Do not replace it with the score-cleared bracket save payload.
        saveJob=null;
        preserveBracketDraft(local);
        window.BowlingApp.refresh();
        throw error;
      }
    }
    queueSave(local);
    await flushSaves();
    const stored=await api('/state?id='+encodeURIComponent(current.id));
    const matches=JSON.stringify((stored?.bowlers||[]).map(b=>[b.id,b.scores]))===
      JSON.stringify((local.bowlers||[]).map(b=>[b.id,b.scores]));
    if(!matches)throw new Error('Neon did not return the latest scores. Keep this page open and try again.');
    notice('Scores saved and verified in Neon.');
    return {saved:true};
  }
  async function setScoresLocked(locked){
    await saveNow('scores');
    const revision=window.BowlingApp.getState()._serverUpdatedAt;
    const saved=await api('/scores-lock?id='+encodeURIComponent(current.id),'POST',{locked,revision});
    serverBase=structuredClone(saved);window.BowlingApp.setState(saved);
    notice(locked?'All scores saved and locked.':'Scores reopened for corrections.');
    return {saved:true};
  }
  // /config and /payment save independently of the usual autosave endpoint.
  // Both advance the authoritative Neon state revision. Refresh that revision
  // immediately or the next queued save can be rejected as stale and block
  // navigation to every other competition until the browser is reloaded.
  async function synchronizeSeparateWrite(competitionId) {
    const stored=await api('/state?id='+encodeURIComponent(competitionId));
    if(!stored?._serverUpdatedAt||!Array.isArray(stored.bowlers))
      throw new Error('The change was saved, but its new session revision could not be verified. Reload this competition before editing.');
    if(current?.id!==competitionId)
      throw new Error('The competition changed while verifying the save. Reopen it before making further edits.');
    serverBase=structuredClone(stored);
    window.BowlingApp.setState(serverBase);
    return stored;
  }
  async function saveConfiguration(config) {
    if(!current||!admin) throw new Error('Open a competition as administrator first.');
    const competitionId=current.id;
    // Never apply a separate state write on top of a pending autosave.
    await flushSaves();
    const result=await api('/config?id='+encodeURIComponent(competitionId),'POST',{config});
    await synchronizeSeparateWrite(competitionId);
    notice(result.needsPriceConfirmation
      ?'Costs saved to Neon. Session signup is paused until you review and confirm these prices in Session Sign-Up.'
      :'Payout configuration saved to Neon.');
    return result;
  }
  async function savePayment(bowlerId,paid) {
    if(!current||!admin) throw new Error('Open a competition as administrator first.');
    const competitionId=current.id;
    await flushSaves();
    const result=await api('/payment?id='+encodeURIComponent(competitionId),'POST',{bowlerId,paid});
    await synchronizeSeparateWrite(competitionId);
    notice('Payment status saved to Neon.');return result;
  }
  async function createCompetition(event) {
    event.preventDefault();
    const name = $('competitionName').value.trim(), kind = $('competitionKind').value,format=$('competitionFormat').value;
    if (!name) return;
    const importRoster=$('importRosterAfterCreate').checked;
    const data = await api('/competitions','POST',{name,kind,format,visibility:$('competitionVisibility').value,managerName:$('competitionManagerName').value,...locationPayload()});
    $('createCompetition').reset();
    if(importRoster){
      await refreshDashboard();
      await openRosterManager(data.id);
      notice('Upload your Tournaments roster Excel file, review the import, then apply it.');
    }else await openCompetition(data.id);
  }
  function showCompetitionEditor(c) {
    $('editCompetitionId').value=c.id;$('editCompetitionName').value=c.name||'';$('editCompetitionKind').value=c.kind||'league';$('editCompetitionVisibility').value=c.visibility||'public';
    $('editCompetitionCenter').value=c.bowling_center||'';$('editCompetitionCountry').value=c.country||'';$('editCompetitionRegion').value=c.region||'';$('editCompetitionCity').value=c.city||'';$('editCompetitionAddress').value=c.formatted_address||'';$('editCompetitionPlaceId').value=c.google_place_id||'';$('editCompetitionLatitude').value=c.latitude??'';$('editCompetitionLongitude').value=c.longitude??'';
    $('editCompetitionLocationStatus').textContent=c.formatted_address||[c.city,c.region,c.country].filter(Boolean).join(' · ')||'Search for and select the bowling center.';
    $('editCompetitionForm').classList.remove('hidden');$('editCompetitionForm').scrollIntoView({behavior:'smooth'});$('editCompetitionName').focus();
  }
  async function saveCompetitionDetails(event) {
    event.preventDefault();const competitionId=$('editCompetitionId').value;
    await api('/competitions/edit','POST',{competitionId,name:$('editCompetitionName').value.trim(),kind:$('editCompetitionKind').value,visibility:$('editCompetitionVisibility').value,...locationPayload('editCompetition')});
    $('editCompetitionForm').classList.add('hidden');notice('Competition details saved.');await refreshDashboard();
  }
  async function deleteCompetition(button) {
    if(!admin)throw new Error('Manager access required');
    const name=button.dataset.competitionName||'Unnamed competition';
    const message='Permanently delete '+name+' and all of its sessions, bowlers, brackets, scores, payouts and manager assignments? This cannot be undone.';
    if(!confirm(window.BowlingApp?.translateText(message)||message))return;
    button.disabled=true;button.textContent='Deleting…';localize();
    try{await api('/competitions/delete','POST',{competitionId:button.dataset.deleteCompetition});if(current?.id===button.dataset.deleteCompetition)current=null;notice(name+' was deleted.');await refreshDashboard();}
    catch(error){button.disabled=false;button.textContent='Delete league/tournament';localize();throw error;}
  }
  async function saveUserAccess(container) {
    const userId=container.dataset.user,select=container.querySelector('[data-user-role]'),newRole=select.value;
    await api('/users/role','POST',{userId,role:newRole});
    const competitionIds=newRole==='manager'?[...container.querySelectorAll('[data-assignment]:checked')].map(input=>input.dataset.assignment):[];
    await api('/users/assignments','POST',{userId,competitionIds});
    notice('User access saved.');await loadUsers();
  }
  async function saveSession() {
    if (!admin) throw new Error('Manager access required.');
    // This button is an OPTIONAL local copy only. Permanent database archives
    // happen transactionally when the manager starts the next session.
    await window.BowlingApp.exportBackup(true);
    notice('Local session backup downloaded. Database archiving happens automatically when starting the next session.');
    return {saved:true,local:true};
  }
  let rollingOver=false;
  async function startFresh({label='',date='',archiveLabel='',archiveDate=''}={}) {
    if(!admin||!current?.can_manage)throw new Error('Manager access required.');
    await flushSaves();
    const previous=window.BowlingApp.getState(),blank=window.BowlingApp.fresh();
    blank.config={...previous.config};blank.language=previous.language;
    blank._paymentScopeVersion=1; // New session, not retroactive to saved archives.
    blank._payoutRulesVersion=previous._payoutRulesVersion||'modern-v1';
    if(label){blank.sessionLabel=String(label).trim().slice(0,120);if(!blank.sessionLabel)throw new Error('Enter a valid session name.');}
    if(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(new Date(date+'T12:00:00Z').getTime()))
      throw new Error('Enter a valid session date.');blank.sessionDate=date;}
    // Name/date of the *completed* session are independent of the name/date
    // for the next session. These metadata values are passed to the server's
    // atomic archive transaction, leaving the saved historic snapshot intact.
    const oldArchiveLabel=String(archiveLabel||'').trim();
    const oldArchiveDate=String(archiveDate||'').trim();
    if(oldArchiveLabel.length>120)throw new Error('Archive session name is too long.');
    if(oldArchiveDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(oldArchiveDate)||
      Number.isNaN(new Date(oldArchiveDate+'T12:00:00Z').getTime())||
      new Date(oldArchiveDate+'T12:00:00Z').toISOString().slice(0,10)!==oldArchiveDate))
      throw new Error('Enter a valid archive session date.');
    // Refresh handicaps ONLY when a new session begins; archives and the current
    // session retain the handicaps used for those games.
    const roster=await loadPermanentRoster(current.id);
    blank.bowlers=previous.bowlers.map(bowler=>{
      const playerId=String(bowler.membershipNumber||bowler.membership_number||'').trim().toLowerCase();
      const matches=roster.filter(p=>p.active&&(playerId?String(p.membership_number||'').toLowerCase()===playerId:p.name.trim().toLowerCase()===bowler.name.trim().toLowerCase()));
      const handicap=matches.length===1?Number(matches[0].handicap):bowler.handicap;
      return {...bowler,handicap,hdcpCount:0,scratchCount:0,high:false,highEntries:0,pairs:false,
        paid:false,paidSessionId:null,paidChargeCents:null,scores:{g1:null,g2:null,g3:null}};
    });
    blank._startNewSession=true;blank._serverUpdatedAt=previous._serverUpdatedAt;blank._sessionId=previous._sessionId;
    // Rollover is NOT an autosave. Keep the completed session visible and
    // untouched in the browser until Neon has atomically archived it and
    // committed a distinct new session ID. Never queue an empty recovery draft.
    const competitionId=current.id,previousId=previous._sessionId;
    if(!previous._serverUpdatedAt)throw new Error('Reload the saved session from Neon before starting a new one.');
    if(rollingOver)throw new Error('A new-session request is already in progress.');
    rollingOver=true;
    try{
      const next=window.BowlingApp.snapshot(blank);
      const saved=await api('/save?id='+encodeURIComponent(competitionId),'POST',{
        state:blank,results:next.publicData,personal:next.personal,
        archiveLabel:oldArchiveLabel,archiveDate:oldArchiveDate,
        eventDate:new Date().toLocaleDateString('en-CA')
      });
      if(!saved?.saved||!saved.sessionId||saved.sessionId===previousId)
        throw new Error('Neon did not confirm a distinct new session. Reload before trying again.');
      // A pre-existing scored, bracketed, or paid session MUST have an archive.
      const hadSession=!!previousId;
      if(hadSession&&!saved.archivedSessionId)
        throw new Error('Neon did not confirm the old session archive. Do not start another session; refresh and inspect saved sessions.');
      const [stored,archives]=await Promise.all([
        api('/state?id='+encodeURIComponent(competitionId)),
        api('/sessions?competition_id='+encodeURIComponent(competitionId)+'&all=1')
      ]);
      if(stored?._sessionId!==saved.sessionId)
        throw new Error('Neon did not verify the new active session. Reload before editing.');
      if(hadSession&&(!Array.isArray(archives)||!archives.some(a=>a.id===saved.archivedSessionId)))
        throw new Error('Previous session archive is not visible in Neon. Do not retry; refresh and inspect saved sessions.');
      // This is the FIRST point at which the local editor switches sessions.
      serverBase=structuredClone(stored);
      window.BowlingApp.setState(serverBase);
      $('sessionLabel').value='';
      $('sessionDate').value='';
      const archiveShortcut=$('viewLastArchivedSession');
      if(saved.archivedSessionId){
        archiveShortcut.dataset.session=saved.archivedSessionId;
        archiveShortcut.classList.remove('hidden');
      }else{
        archiveShortcut.classList.add('hidden');
        delete archiveShortcut.dataset.session;
      }
      if(!label)document.querySelector('[data-tab="registration"]').click();
      notice(hadSession
        ?'Previous session archived and verified in Neon. Open Reports & payouts → View last saved session to review the archive. New session ready; confirm buy-ins before opening signup.'
        :'New session saved in Neon; confirm buy-ins before opening signup.');
      return {started:true,sessionId:saved.sessionId,archivedSessionId:saved.archivedSessionId||null};
    }finally{rollingOver=false;}
  }
  window.addEventListener('online',()=>{if(saveJob&&!saving)void drainSaves();});
  window.addEventListener('beforeunload',event=>{if(saving||saveJob||rollingOver){event.preventDefault();event.returnValue='';}});
  window.MonsterPortal = {persist:queueSave,preserveBracketDraft,bracketsVerified,saveNow,setScoresLocked,saveSession,startFresh,flush:flushSaves,checkNightlyScoreReadiness,saveConfiguration,savePayment,profileForName};

  async function boot() {
    if (!cfg.url || !cfg.apiUrl) {
      show('portalAuth');
      notice('Site setup is incomplete. The Neon project URL must be configured.');
      $('loginForm').querySelector('button[type=submit]').disabled = true;
      return;
    }
    client = newClient();
    setupGeoapifyPlaces();
    $('sessionDate').value=new Date().toLocaleDateString('en-CA');
    if('serviceWorker' in navigator) await navigator.serviceWorker.register('/sw.js');
    let installPrompt=null;
    window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('installCard').classList.remove('hidden');});
    $('installApp').addEventListener('click',async()=>{if(!installPrompt)return;await installPrompt.prompt();installPrompt=null;$('installCard').classList.add('hidden');});
    $('loginForm').addEventListener('submit',async event => {
      event.preventDefault();
      try {
        const email = $('loginEmail').value.trim().toLowerCase(), password = $('loginPassword').value;
        await resetExpiredSession();
        const authResponse=await fetch(cfg.apiUrl+'/auth/sign-in',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})}),data=await authResponse.json();
        if(!authResponse.ok)throw new Error(data.error||'Could not sign in');
        needsSessionReset = false;
        $('loginPassword').value = '';
        user = data.user;sessionToken=data.token;
        if(user&&sessionToken)sessionStorage.setItem(authKey,JSON.stringify({user,token:sessionToken}));
        await activeToken();
        localStorage.removeItem('pending-account-type');
        await identify(data.user);
      } catch (error) { fail(error); }
    });
    const showForgotPassword=showForm=>{
      $('forgotPasswordForm').classList.toggle('hidden',!showForm);
      $('loginForm').classList.toggle('hidden',showForm);
      $('authChoices').classList.toggle('hidden',showForm);
      $('registerForm').classList.add('hidden');
      $('verifyForm').classList.add('hidden');
      if(showForm){$('forgotPasswordEmail').value=$('loginEmail').value.trim()||lastEmail;$('forgotPasswordEmail').focus();}
      localize();
    };
    $('showForgotPassword').addEventListener('click',()=>showForgotPassword(true));
    $('cancelForgotPassword').addEventListener('click',()=>showForgotPassword(false));
    $('forgotPasswordForm').addEventListener('submit',async event=>{
      event.preventDefault();
      try {
        const email=$('forgotPasswordEmail').value.trim().toLowerCase();
        const {error}=await client.auth.requestPasswordReset({email,redirectTo:location.origin+location.pathname});
        if(error)throw error;
        notice('If an account exists for that email, a password reset link has been sent.');
      } catch(error){fail(error);}
    });
    $('resetPasswordForm').addEventListener('submit',async event=>{
      event.preventDefault();
      try {
        const password=$('resetPassword').value,confirmation=$('confirmResetPassword').value;
        if(password!==confirmation)throw new Error('The passwords do not match.');
        const token=new URLSearchParams(location.search).get('token');
        if(!token)throw new Error('This password reset link is invalid or has expired.');
        const {error}=await client.auth.resetPassword({newPassword:password,token});
        if(error)throw error;
        $('resetPassword').value='';$('confirmResetPassword').value='';
        history.replaceState({},'',location.pathname);
        $('resetPasswordForm').classList.add('hidden');$('loginForm').classList.remove('hidden');$('authChoices').classList.remove('hidden');
        notice('Password updated. You can now sign in.');$('loginEmail').focus();
      } catch(error){fail(error);}
    });
    $('registerForm').addEventListener('submit',async event => {
      event.preventDefault();
      try {
        const email = $('registerEmail').value.trim().toLowerCase();
        // New accounts are Bowler by default. Manager access requires SuperAdmin approval.
        const {data,error} = await client.auth.signUp.email({email,password:$('registerPassword').value,
          name:email.split('@')[0] || 'Bowler'});
        if (error) throw error;
        $('registerPassword').value = '';
        verificationEmail = email;
        if (!data?.user?.emailVerified) $('verifyForm').classList.remove('hidden');
        notice('Check your email for a verification code, then enter it below.');
      } catch (error) { fail(error); }
    });
    $('verifyForm').addEventListener('submit',async event => {
      event.preventDefault();
      try {
        const {error} = await client.auth.emailOtp.verifyEmail({email:verificationEmail,otp:$('verificationCode').value.trim()});
        if (error) throw error;
        $('verificationCode').value = '';
        $('verifyForm').classList.add('hidden');
        notice('Email confirmed. You can now sign in.');
      } catch (error) { fail(error); }
    });
    $('resendVerification').addEventListener('click',async () => {
      try {
        const {error} = await client.auth.sendVerificationEmail({email:verificationEmail,callbackURL:location.origin+location.pathname});
        if (error) throw error;
        notice('A new verification code has been sent.');
      } catch (error) { fail(error); }
    });
    $('showRegister').addEventListener('click',() => $('registerForm').classList.toggle('hidden'));
    $('portalLogin').addEventListener('click',async () => {
      if (user && !sessionExpired) {
        await client.auth.signOut();
        sessionStorage.removeItem('dlr-auth-handoff');
        sessionStorage.removeItem(authKey);sessionToken=null;
        user = null; role='user';admin = false;superAdmin=false; current = null; reauth = false; sessionExpired = false;
        updateAuthButton();
        await identify(null);
        notice('You are logged out.');
        return;
      }
      const email = user?.email || lastEmail;
      reauth = !!current;
      user = null;
      role='user';
      admin = false;
      superAdmin=false;
      sessionExpired = false;
      updateAuthButton();
      $('loginEmail').value = email;
      await identify(null,current?.id);
      notice(current ? 'Log in again to continue. Your open competition and bracket information are preserved.' : 'Log in to continue.');
      $('loginPassword').focus();
    });
    $('backDashboard').addEventListener('click',() => void returnToDashboard().catch(fail));
    $('viewerBack').addEventListener('click',() => void returnToDashboard().catch(fail));
    $('viewLastArchivedSession').addEventListener('click',()=>{
      const id=$('viewLastArchivedSession').dataset.session;
      if(id)void openSavedSession(id).catch(fail);
    });
    $('userDashboardTabs').addEventListener('click',event=>{const button=event.target.closest('[data-dashboard-tab]');if(button)showDashboardTab(button.dataset.dashboardTab);});
    $('editEquipmentFromStats').addEventListener('click',()=>showDashboardTab('equipment'));

    document.querySelector('[data-tab="session-signup"]').addEventListener('click',()=>{
      void loadNightlyManager().catch(fail);
    });
    $('nightlyNewSessionDate').value=new Date().toLocaleDateString('en-CA');
    $('nightlyNewSessionForm').addEventListener('submit',event=>void (async()=>{
      event.preventDefault();
      if(!current?.can_manage)throw new Error('Open a league or tournament as its manager.');
      const label=$('nightlyNewSessionLabel').value.trim(),date=$('nightlyNewSessionDate').value;
      if(!label||!date)throw new Error('Enter a session name and date to open sign-up.');
      const warning='Start a new session? The completed current session, including all scores, brackets, payments and payouts, will first be archived to Neon. Only after the archive is verified will the next session start with a cleared playing area. Your permanent roster and archived sessions will remain. No separate Save Session step is required.';
      if(!window.confirm(window.BowlingApp?.translateText?.(warning)||warning))return;
      const button=$('nightlyCreateNextSession'),message=$('nightlyNewSessionStatus');
      button.disabled=true;message.textContent='Creating new session and opening registration…';
      try{
        await startFresh({label,date});
        if(current?.id){
          await loadNightlyManager();
          const newId=window.BowlingApp.getState()._sessionId;
          const displayed=$('nightlyManagerEvents').textContent;
          if(!newId||!displayed.includes(label))throw new Error('The new session was saved, but the signup screen did not confirm its activation. Refresh this competition before continuing.');
        }
        notice('New session created. Review and save the four buy-in costs before opening registration.');
        message.textContent='Session '+label+' created. Registration is pending cost approval.';
      }finally{button.disabled=false;}
    })().catch(error=>{ $('nightlyNewSessionStatus').textContent=error.message||'Could not create session.';fail(error);}));

    $('nightlyBowlerEvents').addEventListener('submit',event=>void (async()=>{
      const form=event.target.closest('[data-nightly-self]');if(!form)return;event.preventDefault();
      const counts=nightlyAmounts(form),eventId=form.dataset.nightlySelf;
      const result=await api('/nightly/quote','POST',{competitionId:current?.id,eventId,counts});
      if(!result.counts)throw new Error('The Neon backend needs the automatic Doubles-count update. Do not confirm entries until the staging backend is updated.');
      const verifiedCounts=result.counts;
      form.elements.namedItem('virtualDoublesEntries').value=verifiedCounts.virtualDoublesEntries;
      nightlyReviewQuotes.set(eventId,{counts:verifiedCounts,quote:result.quote});
      showNightlyReview(form,result.quote);
    })().catch(fail));
    $('nightlyBowlerEvents').addEventListener('input',event=>{
      const form=event.target.closest('[data-nightly-self]');if(!form)return;
      if(event.target.matches('[data-nightly-agree]')){
        form.querySelector('[data-nightly-confirm]').disabled=!event.target.checked;
      }else if(event.target.matches('input[name]')){
        nightlyReviewQuotes.delete(form.dataset.nightlySelf);
        const review=form.querySelector('[data-nightly-review]');
        if(review)review.innerHTML='';
      }
    });
    $('nightlyBowlerEvents').addEventListener('click',event=>void (async()=>{
      const button=event.target.closest('[data-nightly-confirm],[data-nightly-edit]');
      if(!button)return;
      const form=button.closest('[data-nightly-self]'),eventId=form?.dataset.nightlySelf;
      if(!form||!eventId)return;
      if(button.hasAttribute('data-nightly-edit')){
        nightlyReviewQuotes.delete(eventId);
        form.querySelector('[data-nightly-review]').innerHTML='';
        return;
      }
      const review=nightlyReviewQuotes.get(eventId);
      if(!review||!form.querySelector('[data-nightly-agree]')?.checked||button.disabled)
        throw new Error('Review and confirm your registration first.');
      if(JSON.stringify(review.counts)!==JSON.stringify(nightlyAmounts(form)))
        throw new Error('Entry quantities changed. Review your registration again.');
      button.disabled=true;
      try{
        await api('/nightly/entry','POST',{competitionId:current?.id,eventId,
          counts:review.counts,confirmed:true,expectedTotalCents:review.quote.totalCents,
          expectedUnitPricesCents:review.quote.unitPricesCents});
        nightlyReviewQuotes.delete(eventId);
        notice('Registration confirmed. The manager can now verify your handicap.');
        await loadNightlyBowler();
      }catch(error){
        nightlyReviewQuotes.delete(eventId);
        const reviewElement=form.querySelector('[data-nightly-review]');
        if(reviewElement)reviewElement.innerHTML='';
        throw error;
      }
    })().catch(fail));
    $('nightlyManagerEvents').addEventListener('change',event=>{
      if(!event.target.matches('[data-nightly-prices-agree]'))return;
      const panel=event.target.closest('.pair-card');
      const button=panel?.querySelector('[data-nightly-activate]');
      if(button)button.disabled=!event.target.checked;
    });
    $('nightlyManagerEvents').addEventListener('click',event=>void (async()=>{
      const settings=event.target.closest('[data-nightly-configure]');
      if(settings){document.querySelector('[data-tab="registration"]').click();return;}
      const button=event.target.closest('[data-nightly-activate]');
      if(!button)return;
      if(button.disabled||!button.closest('.pair-card')?.querySelector('[data-nightly-prices-agree]')?.checked)
        throw new Error('Review and confirm all four saved session buy-ins first.');
      const competitionId=current?.id,eventId=button.dataset.nightlyActivate;
      // Submit EXACTLY the prices displayed at checkbox confirmation.
      // The backend rejects the request if the saved configuration changed.
      const pricing=JSON.parse(button.dataset.prices||'null');
      if(!pricing)throw new Error('Reload the saved costs before opening registration.');
      button.disabled=true;
      try{
        const result=await api('/nightly/activate','POST',{
          competitionId,eventId,confirmed:true,expectedUnitPricesCents:pricing
        });
        if(!result.registrationOpen)throw new Error('Registration could not be confirmed as open.');
        notice('Session prices confirmed. Digital and admin-assisted signup are now open.');
        await loadNightlyManager();
      }catch(error){button.disabled=false;throw error;}
    })().catch(fail));
    $('nightlyManagerEvents').addEventListener('submit',event=>void (async()=>{
      const form=event.target.closest('[data-nightly-manual],[data-nightly-approve]');if(!form)return;event.preventDefault();
      const competitionId=current?.id;
      if(form.dataset.nightlyManual){
        // The server must calculate partner counts from saved team assignments,
        // never from an unsaved editor copy or a chosen maximum.
        await flushSaves();
        const eventId=form.dataset.nightlyManual,profileId=form.elements.namedItem('profileId').value,counts=nightlyAmounts(form);
        const result=await api('/nightly/quote','POST',{competitionId,eventId,profileId,counts});
        if(form.elements.namedItem('profileId').value!==profileId||
          JSON.stringify(nightlyAmounts(form))!==JSON.stringify(counts))return;
        if(!result.counts)throw new Error('The Neon backend needs the automatic Doubles-count update. Do not confirm entries until the staging backend is updated.');
      const verifiedCounts=result.counts;
        form.elements.namedItem('virtualDoublesEntries').value=verifiedCounts.virtualDoublesEntries;
        nightlyManagerQuotes.set(form,{eventId,profileId,counts:verifiedCounts,quote:result.quote});
        showNightlyReview(form,result.quote,true);
      }else{
        // Handicap approval may update the official session's row/revision.
        // Flush any pending edits first, then reload that exact revision so
        // generating brackets cannot accidentally save a stale editor copy.
        await flushSaves();
        await api('/nightly/handicap','POST',{competitionId,eventId:form.dataset.nightlyApprove,profileId:form.dataset.profileId,handicap:Number(form.elements.namedItem('handicap').value)});
        await openCompetition(competitionId);
        notice('Handicap approved. Current session refreshed from Neon.');
      }
    })().catch(fail));
    const invalidateAssistedReview=event=>{
      const form=event.target.closest('[data-nightly-manual]');if(!form)return;
      if(event.target.matches('[data-nightly-agree]')){
        const confirmButton=form.querySelector('[data-nightly-confirm]');
        if(confirmButton)confirmButton.disabled=!event.target.checked;
      }else if(event.target.matches('[name]')){
        nightlyManagerQuotes.delete(form);
        const review=form.querySelector('[data-nightly-review]');
        if(review)review.innerHTML='';
      }
    };
    $('nightlyManagerEvents').addEventListener('change',event=>{
      if(!event.target.matches('[data-nightly-manual] [name="profileId"]'))return;
      const form=event.target.closest('[data-nightly-manual]');
      const option=event.target.selectedOptions?.[0];
      const values=option?.dataset.registeredCounts?JSON.parse(option.dataset.registeredCounts):{};
      for(const key of ['handicapBrackets','scratchBrackets','highGameEntries','virtualDoublesEntries']){
        const element=form.elements.namedItem(key);
        if(element)element.value=values[key]??0;
      }
      const review=form.querySelector('[data-nightly-review]');
      if(review)review.innerHTML='';
      nightlyManagerQuotes.delete(form);
    });
    $('nightlyManagerEvents').addEventListener('input',invalidateAssistedReview);
    $('nightlyManagerEvents').addEventListener('change',invalidateAssistedReview);
    $('nightlyManagerEvents').addEventListener('click',event=>void (async()=>{
      const button=event.target.closest('[data-nightly-confirm],[data-nightly-edit],[data-nightly-apply],[data-nightly-reconcile-high]');if(!button)return;
      if(button.matches('[data-nightly-reconcile-high]')){
        // A stale roster with High Game disabled triggers a deliberate 409 and
        // leaves the failed saveJob queued for recovery. That is precisely the
        // state this reconciliation repairs. Other failed saves MUST still
        // block reconciliation rather than silently discarding unsaved scores.
        while(saving)await new Promise(resolve=>setTimeout(resolve,50));
        const highMismatch=error=>error?.status===409&&
          /Confirmed High Game entries do not match the scoring roster/.test(error.message||'');
        if(saveJob&&!highMismatch(lastSaveError))
          throw new Error('Other pending edits could not be saved. Resolve that error first; no unsaved scores will be discarded.');
        if(!confirm('Restore confirmed High Game entries from the registration ledger? Official scores, handicaps and buy-in commitments will not change. Pending High Game mismatch edits will be safely rebased and retried.'))return;
        const competitionId=current?.id;
        button.disabled=true;
        try{
          // The backend repairs ONLY the confirmed High Game flags and keeps an
          // audited pre-repair snapshot. It can safely run while a 409 draft is
          // saved on this computer, because it never writes that draft.
          const result=await api('/nightly/reconcile-high','POST',{
            competitionId,eventId:button.dataset.nightlyReconcileHigh,confirmed:true
          });
          if(saveJob){
            // Rebase the retained draft against the newly reconciled server
            // state. Its unchanged High Game flags adopt the server's approved
            // values; independent unsaved scores remain in the local draft.
            const remoteRaw=await api('/state?id='+encodeURIComponent(competitionId));
            if(!remoteRaw)throw new Error('High Game was reconciled in Neon, but its updated state could not be loaded. Keep this page open; your unsaved draft is still stored here.');
            const remote={...window.BowlingApp.fresh(),...remoteRaw};
            let merged;
            try{
              merged=window.MonsterSaveMerge.merge(saveJob.base,saveJob.p_state,remote);
            }catch(error){
              throw new Error('High Game was restored in Neon, but pending edits conflict with the updated session: '+error.message+' Keep this page open; the unsaved draft has not been discarded.');
            }
            // High Game authorization belongs to the registration ledger:
            // never let a locally edited or legacy flag override that truth.
            const official=new Map((remote.bowlers||[]).map(b=>[String(b.id),b]));
            for(const bowler of merged.bowlers||[]){
              const approved=official.get(String(bowler.id));
              if(approved){
                bowler.high=approved.high;
                bowler.highEntries=approved.highEntries;
              }
            }
            serverBase=structuredClone(remote);
            window.BowlingApp.setState(merged);
            queueSave(merged);
            await flushSaves();
          }
          await openCompetition(competitionId);
          notice(result.reconciled+' High Game roster entries reconciled from approved registrations. Existing scores and any successfully rebased edits were preserved.');
        }finally{button.disabled=false;}
        return;
      }
      if(button.matches('[data-nightly-confirm],[data-nightly-edit]')){
        const form=button.closest('[data-nightly-manual]');if(!form)return;
        if(button.matches('[data-nightly-edit]')){
          nightlyManagerQuotes.delete(form);
          form.querySelector('[data-nightly-review]').innerHTML='';
          return;
        }
        const review=nightlyManagerQuotes.get(form),profileId=form.elements.namedItem('profileId').value;
        if(!review||review.profileId!==profileId||
           JSON.stringify(nightlyAmounts(form))!==JSON.stringify(review.counts)||
           !form.querySelector('[data-nightly-agree]')?.checked)
          throw new Error('Review the selected bowler, entry quantities and maximum total before confirming.');
        await api('/nightly/entry','POST',{
          competitionId:current?.id,eventId:review.eventId,profileId,counts:review.counts,
          confirmed:true,assistedAuthorized:true,expectedTotalCents:review.quote.totalCents,
          expectedUnitPricesCents:review.quote.unitPricesCents
        });
        notice('Manager-assisted bowler registration saved; no payment was taken.');
        await loadNightlyManager();return;
      }
      const competitionId=current?.id,eventId=button.dataset.nightlyApply;
      button.disabled=true;
      try{
        while(saving)await new Promise(resolve=>setTimeout(resolve,50));
        // Either approved Doubles entries OR approved High Game flags may
        // leave an old roster draft blocked by a 409. Both are repaired by
        // this same verified bulk sync. Never flush a known-bad stale draft
        // before it has been rebased on the authoritative ledger.
        const knownMismatch=lastSaveError?.status===409&&
          /Doubles team commitments do not match|Confirmed High Game entries do not match the scoring roster/.test(lastSaveError.message||'');
        if(saveJob&&!knownMismatch)await flushSaves();
        if(saveJob){
          const savedState=await api('/state?id='+encodeURIComponent(competitionId));
          const pairsKey=state=>JSON.stringify((state?.pairs||[]).map(pair=>pair.map(String).sort().join('|')).sort());
          if(!savedState||pairsKey(saveJob.p_state)!==pairsKey(savedState))
            throw new Error('Your unsaved Doubles partnerships must be saved before the batch review. The draft is retained.');
        }
        const preview=await api('/nightly/sync-preview','POST',{competitionId,eventId});
        const money=cents=>'$'+(cents/100).toFixed(2),NL=String.fromCharCode(10);
        const details=preview.rows.map(row=>row.name+': Doubles '+row.previousDoubles+' to '+row.assignedDoubles+
          ', maximum '+money(row.oldCents)+' to '+money(row.newCents)+', handicap '+row.handicap+
          (row.handicapPending?' (approve)':' (approved)')).join(NL);
        const prompt='Review '+preview.rows.length+' bowlers and '+preview.teamCount+' Doubles teams.'+
          NL+NL+details+NL+NL+'Combined maximum: '+money(preview.totalBeforeCents)+' to '+
          money(preview.totalAfterCents)+'; change '+money(preview.extraCents)+'.'+NL+NL+
          'Confirming attests that every affected manager-assisted bowler authorized their revised maximum amount and you verified the displayed handicaps. Digital bowlers must approve changes personally. No payment is taken.'+
          NL+NL+'Confirm and synchronize all entries?';
        if(!confirm(prompt))return;
        const result=await api('/nightly/apply','POST',{
          competitionId,eventId,bulkAuthorized:true,confirmed:true,
          managerAttested:true,syncFingerprint:preview.fingerprint
        });
        if(saveJob){
          const raw=await api('/state?id='+encodeURIComponent(competitionId));
          if(!raw)throw new Error('Neon synced registrations but could not reload the session. Keep the tab open; pending edits are retained.');
          const remote={...window.BowlingApp.fresh(),...raw};
          let merged;
          try{merged=window.MonsterSaveMerge.merge(saveJob.base,saveJob.p_state,remote);}
          catch(error){throw new Error('Neon synchronized registrations but the unsaved draft conflicts. Keep the tab open: '+error.message);}
          const official=new Map((remote.bowlers||[]).map(row=>[String(row.id),row]));
          for(const bowler of merged.bowlers||[]){
            const approved=official.get(String(bowler.id));
            if(!approved)continue;
            for(const key of ['high','highEntries','pairs','hdcpCount','scratchCount',
              'handicap','rosterProfileId','membershipNumber'])bowler[key]=approved[key];
          }
          serverBase=structuredClone(remote);
          window.BowlingApp.setState(merged);
          queueSave(merged);await flushSaves();
        }
        await openCompetition(competitionId);
        notice('Synchronized '+result.applied+' registrations and '+result.verifiedTeams+
          ' Doubles teams; updated '+result.updatedDoubles+' commitments and approved '+
          result.approvedHandicaps+' handicaps in Neon.');
      }finally{button.disabled=false;}
    })().catch(fail));

    $('printSavedSession').addEventListener('click',()=>void printSavedSession().catch(fail));
    $('competitionCards').addEventListener('click',event => {
      const remove=event.target.closest('[data-delete-competition]');
      if(remove){void deleteCompetition(remove).catch(fail);return;}
      const button = event.target.closest('[data-open]');
      if (button) void openCompetition(button.dataset.open).catch(fail);
      const roster=event.target.closest('[data-roster]');if(roster)void openRosterManager(roster.dataset.roster).catch(fail);
      const linked=event.target.closest('[data-linked-accounts]');if(linked)void openLinkedAccounts(linked.dataset.linkedAccounts).catch(fail);
      const qrButton=event.target.closest('[data-share-qr]');
      if(qrButton)void qrShowShare(qrButton.dataset.shareQr).catch(fail);
      const editCompetition=event.target.closest('[data-edit-competition]');if(editCompetition){const c=competitions.find(x=>x.id===editCompetition.dataset.editCompetition);if(c)showCompetitionEditor(c);}
      const removeLeague=event.target.closest('[data-remove-league]');if(removeLeague)void api('/memberships','DELETE',{competitionId:removeLeague.dataset.removeLeague}).then(refreshDashboard).catch(fail);
      const previous=event.target.closest('[data-previous]');if(previous)void (async()=>{const rows=await api('/sessions?competition_id='+encodeURIComponent(previous.dataset.previous)+'&all=1'),currentYear=new Date().getFullYear(),older=rows.filter(x=>Number(String(x.session_date).slice(0,4))!==currentYear),groups=Object.groupBy?Object.groupBy(older,x=>String(x.session_date).slice(0,4)):older.reduce((o,x)=>((o[String(x.session_date).slice(0,4)]??=[]).push(x),o),{});document.querySelector('[data-previous-list="'+previous.dataset.previous+'"]').innerHTML=Object.entries(groups).sort((a,b)=>b[0]-a[0]).map(([year,list])=>'<h4>'+esc(year)+'</h4>'+list.map(x=>'<div class="session-row"><span class="session-label">'+esc(x.label)+'<br><small>'+esc(String(x.session_date).slice(0,10))+(x.bracket_details_purged_at?' · Financial archive':'')+'</small></span>'+(admin&&competitions.find(c=>c.id===previous.dataset.previous)?.can_manage?'<button type="button" class="secondary" data-rename-session="'+esc(x.id)+'" data-rename-competition="'+esc(previous.dataset.previous)+'" data-rename-label="'+esc(x.label)+'"'+(cfg.archiveRenameEnabled===false?' disabled title="Session renaming is disabled in this read-only preview"':'')+'>'+'Edit name'+'</button>':'')+'<button class="secondary" data-session="'+esc(x.id)+'">View</button></div>').join('')).join('')||'<p class="hint">No previous years.</p>';localize();})().catch(fail);
      const renameSession=event.target.closest('[data-rename-session]');
      if(renameSession){
        if(cfg.archiveRenameEnabled===false){
          notice('Archive renaming is disabled in the read-only preview. The saved session name has not changed.');
          return;
        }
        const competitionId=renameSession.dataset.renameCompetition;
        if(!(admin&&competitions.some(c=>c.id===competitionId&&c.can_manage)))return;
        const original=renameSession.dataset.renameLabel||'';
        const name=window.prompt('Edit saved session display name (scores, date and payouts will not change):',original);
        if(name===null)return;
        const label=name.trim();
        if(!label||label.length>120){notice('Session name must be between 1 and 120 characters.');return;}
        if(label===original)return;
        renameSession.disabled=true;
        void api('/sessions/rename','POST',{competitionId,sessionId:renameSession.dataset.renameSession,label})
          .then(()=>{notice('Saved session display name updated.');return refreshDashboard();})
          .catch(error=>{
            renameSession.disabled=false;
            if(error.status===400&&/Invalid competition ID/i.test(error.message||'')){
              notice('This backend does not yet support editing saved session names. No archive data was changed.');
            }else fail(error);
          });
        return;
      }
      const session = event.target.closest('[data-session]');
      if (session) void openSavedSession(session.dataset.session).catch(fail);
    });
    $('qrStartCamera').addEventListener('click',()=>void qrStartScanning().catch(error=>qrStatus(error.message)));
    $('qrStopCamera').addEventListener('click',()=>{qrStopScanning();qrStatus('Camera stopped.');});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)qrStopScanning();});
    window.addEventListener('pagehide',qrStopScanning);
    $('qrUpload').addEventListener('change',event=>void qrReadUpload(event.target.files?.[0])
      .catch(error=>qrStatus(error.message)).finally(()=>{event.target.value='';}));
    $('qrCancelJoin').addEventListener('click',()=>{qrClearInvitation();qrClearLinkFromAddress();qrStatus('Invitation dismissed.');});
    $('qrConfirmJoin').addEventListener('click',()=>void (async()=>{
      if(admin||!qrPendingCompetitionId)throw Error('Scan or upload a competition QR code first.');
      const id=qrPendingCompetitionId;
      $('qrConfirmJoin').disabled=true;
      try{
        await api('/memberships','POST',{competitionId:id,token:qrPendingToken});
        qrClearLinkFromAddress();qrClearInvitation();
        await refreshDashboard();
        qrStatus('Competition added to your dashboard.');
      }catch(error){$('qrConfirmJoin').disabled=false;throw error;}
    })().catch(error=>qrStatus(error.message)));
    $('qrCloseShare').addEventListener('click',()=>{
      $('competitionQrShare').classList.add('hidden');qrShareInviteUrl='';$('qrCodeCanvasWrap').textContent='';
    });
    $('qrDownload').addEventListener('click',()=>{try{qrDownloadImage();}catch(error){$('qrShareStatus').textContent=error.message;}});
    $('qrShareNative').addEventListener('click',()=>void qrNativeShare().catch(error=>{
      if(error.name!=='AbortError')$('qrShareStatus').textContent=error.message;
    }));
    $('qrCopyLink').addEventListener('click',()=>void navigator.clipboard.writeText(qrShareInviteUrl)
      .then(()=>$('qrShareStatus').textContent='Invitation link copied.')
      .catch(error=>$('qrShareStatus').textContent=error.message));
    $('qrShareWhatsapp').addEventListener('click',()=>window.open('https://wa.me/?text='+encodeURIComponent(qrInviteText()),'_blank','noopener,noreferrer'));
    $('qrShareEmail').addEventListener('click',()=>{
      const subject='Join '+qrShareName+' on ProDrillOS';
      window.location.href='mailto:?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(qrInviteText());
    });
    $('leagueDirectorySearch').addEventListener('input',()=>void searchDirectory().catch(fail));
    $('addCompetitionShortcut').addEventListener('click', () => {
  const directory = $('bowlerLeagues');
  const search = $('leagueDirectorySearch');

  directory.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });

  search.focus({ preventScroll: true });
});
    $('leagueDirectoryResults').addEventListener('click',event=>{const button=event.target.closest('[data-add-league]');if(!button)return;void api('/memberships','POST',{competitionId:button.dataset.addLeague}).then(refreshDashboard).catch(fail);});
    $('editCompetitionForm').addEventListener('submit',event=>void saveCompetitionDetails(event).catch(fail));
    $('cancelCompetitionEdit').addEventListener('click',()=>$('editCompetitionForm').classList.add('hidden'));
    $('quickAddBowlerForm').addEventListener('submit',event=>void (async()=>{
      event.preventDefault();
      if(!rosterCompetition?.id)throw new Error('Open a Permanent Roster as its manager.');
      await addPermanentBowlerFromForm(event.currentTarget,rosterCompetition.id);
    })().catch(fail));
    $('nightlyQuickAddBowlerForm').addEventListener('submit',event=>void (async()=>{
      event.preventDefault();
      if(!current?.id||!current.can_manage)throw new Error('Open a league or tournament as its manager.');
      await addPermanentBowlerFromForm(event.currentTarget,current.id);
    })().catch(fail));
    $('closeRosterManager').addEventListener('click',()=>$('rosterManager').classList.add('hidden'));
    $('closeLinkedAccounts').addEventListener('click',()=>$('linkedAccountsManager').classList.add('hidden'));
    $('linkedAccountsTable').addEventListener('click',event=>{const save=event.target.closest('[data-save-link]'),unlink=event.target.closest('[data-unlink]'),button=save||unlink;if(!button)return;const profileId=button.dataset.saveLink||button.dataset.unlink,input=document.querySelector('[data-link-email="'+CSS.escape(profileId)+'"]'),email=unlink?'':input.value.trim();button.disabled=true;void api('/roster/link-account','POST',{competitionId:rosterCompetition.id,profileId,email}).then(()=>{notice(email?'Bowler account link saved.':'Bowler account unlinked.');return openLinkedAccounts(rosterCompetition.id)}).catch(error=>{button.disabled=false;fail(error)});});
    $('permanentRosterTable').addEventListener('click',event=>{
      const retire=event.target.closest('[data-retire-unused-profile]');
      if(retire){
        if(!confirm('Retire unused permanent roster profile "'+retire.dataset.profileName+'"? The server will refuse if this bowler has signups, a linked account, or an active scoring record. This does not delete historical results.'))return;
        void api('/roster/deactivate-unused','POST',{
          competitionId:rosterCompetition.id,profileId:retire.dataset.retireUnusedProfile,confirmed:true
        }).then(async()=>{await openRosterManager(rosterCompetition.id);await loadNightlyManager();notice('Unused permanent profile retired. The registration ledger and scores are unchanged.');}).catch(fail);
        return;
      }
      const button=event.target.closest('[data-reset-profile]');
      if(!button)return;
      void api('/roster/reset-claim','POST',{competitionId:rosterCompetition.id,profileId:button.dataset.resetProfile}).then(()=>openRosterManager(rosterCompetition.id)).catch(fail);
    });
    $('equipmentScoredSession').addEventListener('change',renderScoredEquipment);
    $('equipmentScoredForm').addEventListener('submit',event=>void (async()=>{
      event.preventDefault();
      if(admin||role!=='user')throw new Error('Bowler account required.');
      const key=$('equipmentScoredSession').value,session=(equipmentPerformance?.availableSessions||[])
        .find(x=>x.sourceKind+':'+x.sourceSessionId===key);
      if(!session)throw new Error('Select a saved scored session.');
      const balls=Object.fromEntries([...$('equipmentScoredGames').querySelectorAll('[data-scored-ball]')]
        .map(input=>[input.dataset.scoredBall,input.value.trim()]));
      await api('/equipment/link-scored-session','POST',
        {sourceKind:session.sourceKind,sourceSessionId:session.sourceSessionId,laneStart:Number($('equipmentScoredLane').value),balls});
      notice('Equipment linked to your saved scores. View the Equipment Statistics tab for updated averages.');
      await loadEquipment();
    })().catch(fail));
    $('equipmentForm').addEventListener('submit',event=>void (async()=>{
      event.preventDefault();
      if(admin||role!=='user')throw new Error('Bowler account required to save personal equipment.');
      const body={competitionId:$('equipmentCompetition').value,sessionDate:$('equipmentDate').value,laneStart:Number($('equipmentLane').value),
        ballGame1:$('equipmentBall1').value,ballGame2:$('equipmentBall2').value,ballGame3:$('equipmentBall3').value};
      await api('/equipment/session','POST',body);
      notice('Lane pair and bowling balls saved to your personal history.');
      await loadEquipment();
    })().catch(fail));
    $('updateHandicaps').addEventListener('click',()=>$('handicapUpload').click());
    $('handicapUpload').addEventListener('change',event=>void previewHandicapFile(event.target.files[0]).catch(fail));
    $('handicapPreview').addEventListener('click',event=>{
      if(event.target.id!=='applyHandicapChanges'||!pendingHandicapPreview||!rosterCompetition)return;
      const changes=[...document.querySelectorAll('[data-hcp-index]:checked')].map(input=>pendingHandicapPreview.preview[Number(input.dataset.hcpIndex)])
        .map(x=>({profileId:x.profileId,oldHandicap:Number(x.oldHandicap),newHandicap:Number(x.newHandicap)}));
      if(!changes.length)return notice('Select at least one handicap change.');
      if(!confirm('Apply '+changes.length+' handicap updates to the permanent roster for FUTURE sessions only?'))return;
      void api('/roster/handicap-apply','POST',{competitionId:rosterCompetition.id,changes,sourceName:$('handicapUpload').dataset.fileName||'manager-file'})
        .then(async result=>{pendingHandicapPreview=null;$('handicapPreview').innerHTML='';await openRosterManager(rosterCompetition.id);notice(result.updated+' handicaps updated for future sessions.');})
        .catch(fail);
    });
    $('downloadRosterTemplate').addEventListener('click',()=>{if(!window.XLSX)return fail(new Error('Excel tools are still loading.'));const rows=[['Bowler First Name','Bowler Last Name','Handicap'],['Juan','Pérez',15]],sheet=XLSX.utils.aoa_to_sheet(rows),book=XLSX.utils.book_new();sheet['!cols']=[{wch:22},{wch:22},{wch:12}];XLSX.utils.book_append_sheet(book,sheet,'Roster');XLSX.writeFile(book,'BracketsByProDrillOS_Roster_Template.xlsx');});
    $('rosterUpload').addEventListener('change',event=>void (async()=>{const file=event.target.files[0];if(!file||!rosterCompetition)return;const book=XLSX.read(await file.arrayBuffer(),{type:'array'}),raw=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{defval:''}),rows=raw.map(x=>({firstName:String(x['Bowler First Name']??'').trim(),lastName:String(x['Bowler Last Name']??'').trim(),handicap:x.Handicap??''}));pendingRosterPreview=await api('/roster/import-preview','POST',{competitionId:rosterCompetition.id,rows});const counts=pendingRosterPreview.preview.reduce((o,x)=>(o[x.status]=(o[x.status]||0)+1,o),{}),invalid=pendingRosterPreview.preview.filter(x=>x.status==='invalid');$('rosterImportPreview').innerHTML='<h3>Import preview</h3><p>'+Object.entries(counts).map(([k,v])=>esc(k)+': '+v).join(' · ')+'</p>'+(invalid.length?'<div class="notice"><strong>Fix these rows before importing:</strong><ul>'+invalid.map(x=>'<li>'+esc([x.firstName,x.lastName].filter(Boolean).join(' ')||'Blank row')+' — '+esc(x.reason)+'</li>').join('')+'</ul></div>':'<button id="applyRosterImport" type="button">Apply roster import</button>');event.target.dataset.fileName=file.name;})().catch(fail));
    $('rosterImportPreview').addEventListener('click',event=>{if(event.target.id!=='applyRosterImport'||!pendingRosterPreview)return;void api('/roster/import','POST',{competitionId:rosterCompetition.id,fileName:$('rosterUpload').dataset.fileName,rows:pendingRosterPreview.preview}).then(()=>{pendingRosterPreview=null;$('rosterImportPreview').innerHTML='<p>Roster import saved.</p>';return openRosterManager(rosterCompetition.id);}).catch(fail);});
    $('undoRosterImport').addEventListener('click',()=>{if(!rosterCompetition||!confirm('Undo the most recent roster import?'))return;void api('/roster/import-undo','POST',{competitionId:rosterCompetition.id}).then(()=>openRosterManager(rosterCompetition.id)).catch(fail);});
    $('name').addEventListener('change',()=>{const p=profileForName($('name').value);if(!p)return;$('membershipNumber').value=p.membership_number||'';$('bowlerEmail').value=p.email||'';$('handicap').value=p.handicap;});
    $('userAccessRows').addEventListener('change',event=>{
      const select=event.target.closest('[data-user-role]');if(!select)return;
      select.closest('[data-user]').querySelectorAll('[data-assignment]').forEach(input=>input.disabled=select.value!=='manager');
    });
    $('userAccessRows').addEventListener('click',event=>{const button=event.target.closest('[data-save-access]');if(button)void saveUserAccess(button.closest('[data-user]')).catch(fail);});
    $('userEmailSearch').addEventListener('input',searchAccessUsers);
    $('userEmailSearch').addEventListener('change',searchAccessUsers);
    $('userSearchResults').addEventListener('click',event=>{const button=event.target.closest('[data-pick-user]');if(!button)return;const account=accessUsers.find(item=>item.id===button.dataset.pickUser);if(!account)return;$('userEmailSearch').value=account.email;$('userSearchResults').innerHTML='';renderAccessUser(account);});
    $('adminCompetitionSearch').addEventListener('input',event=>{const q=event.target.value.trim().toLowerCase();document.querySelectorAll('[data-competition-search]').forEach(card=>card.classList.toggle('hidden',q&&!card.dataset.competitionSearch.includes(q)));});
    $('createCompetition').addEventListener('submit',event => void createCompetition(event).catch(fail));
    const resetParams=new URLSearchParams(location.search),resetToken=resetParams.get('token'),resetError=resetParams.get('error');
    if(resetToken||resetError){
      show('portalAuth');$('loginForm').classList.add('hidden');$('authChoices').classList.add('hidden');$('resetPasswordForm').classList.toggle('hidden',!resetToken);$('forgotPasswordForm').classList.toggle('hidden',!resetError);
      notice(resetError?'This password reset link is invalid or has expired. Request a new link.':'Choose a new password to finish resetting your account.');
      localize();return;
    }
    const {data,error} = await client.auth.getSession(),saved=savedAuth();
    if (error) throw error;
    user=data?.user||saved?.user||null;sessionToken=data?.session?.token||sessionToken||saved?.token||null;
    await identify(user);
  }
  boot().catch(error => {
    // Session restoration can fail before an API request is made. Always recover
    // to a usable login screen without replacing the in-memory competition.
    user = null;role='user';
    admin = false;superAdmin=false;
    sessionExpired = true;
    needsSessionReset = true;
    show('portalAuth');
    updateAuthButton();
    notice((error?.message || 'Session expired.') + ' Use Log in to continue.');
  });
})();

