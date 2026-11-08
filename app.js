const bowlerNameOrder=new Intl.Collator('es',{sensitivity:'base',numeric:true});
function alphabetical(list){return [...list].sort((a,b)=>bowlerNameOrder.compare(String(a?.name??a??'').trim(),String(b?.name??b??'').trim()));}
const KEY = 'monster-bowling-v2';
const LANGUAGE_KEY = 'monster-bowling-language';
const DEFAULT_CONFIG = {currency:'MXN',hdcpBuyin:10,hdcpFirstAmount:250,hdcpSecondAmount:100,scratchBuyin:10,scratchFirstAmount:250,scratchSecondAmount:100,highBuyin:20,pairsBuyin:20,pairsPaidPlaces:1,pairsPlacePercentages:[90]};
const CONFIG_IDS = Object.keys(DEFAULT_CONFIG).filter(id=>id!=='pairsPlacePercentages');
const MONEY_IDS = CONFIG_IDS.filter(id=>id.endsWith('Buyin')||id.endsWith('Amount'));
const NUMBER_IDS = CONFIG_IDS.filter(id=>typeof DEFAULT_CONFIG[id]==='number');
const PERCENT_IDS = [];
const money = cents => '$' + (cents / 100).toFixed(2);
const cents = value => Math.round(Number(value) * 100);
const safe = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const num = (value, fallback=0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const blankScores = () => ({g1:null,g2:null,g3:null});
const ES = {
  'Add one bowler':'Agregar un jugador',
  'Add a new bowler (no spreadsheet)':'Agregar jugador nuevo (sin Excel)',
  'First name':'Nombre',
  'Last name':'Apellido',
  'Email (optional)':'Correo electrónico (opcional)',
  'Add bowler to permanent roster':'Agregar jugador a la lista permanente',
  'No spreadsheet needed. This adds a permanent profile and generates a Player ID. It does not register or charge the bowler for any session.':'No necesitas archivo Excel. Se crea un perfil permanente con un ID de jugador. No se inscribe ni se cobra al jugador en ninguna sesión.',
  'Create the permanent profile here, then select that bowler in Admin-assisted signup below. Registration quantities and total buy-ins still require confirmation before the bowler joins this session.':'Crea el perfil permanente aquí y después elige al jugador en la inscripción asistida por el administrador. La cantidad de inscripciones y su costo total todavía deben confirmarse para esta sesión.',
  'Bracket first- and second-place prizes use fixed amounts. High Game and Doubles use the percentage-based prize rules shown below. Buy-ins are per bracket, High Game entry, or bowler per Doubles team.':'Los premios del primero y segundo lugar de brackets son montos fijos. Línea Alta y Parejas Virtuales usan las reglas porcentuales indicadas abajo. Los costos son por bracket, inscripción de Línea Alta o jugador por pareja.',
  "This is the current session's scoring roster, not a registration form. Register or update entries in Session Sign-Up using confirmed quantities and total buy-ins. Use Permanent roster for bowler identity corrections. Only bowlers with a current calculated entry charge can be marked paid; this status is a manager record, not bank verification.":'Esta es la lista de jugadores de la sesión para registrar puntuaciones, no un formulario de inscripción. Inscribe o actualiza entradas en Inscripciones de la sesión con cantidades y costos confirmados. Usa la lista permanente para corregir identidades. Solo se pueden marcar como pagados jugadores con cargos calculados; la marca es un registro del administrador, no una verificación bancaria.',
  'Charges marked paid':'Cargos marcados como pagados',
  'No current charge':'Sin cargo en esta sesión',
  'Save brackets before payment':'Guardar brackets antes de cobrar',
  'Bracket draw is not saved in Neon. Charges and payouts shown here are provisional until Save Brackets is verified.':'Los brackets todavía no están guardados en Neon. Los cargos y premios mostrados son provisionales hasta verificar que se guardaron los brackets.',
  'Use Session Sign-Up':'Usar Inscripciones de la sesión',
  'Use Session Sign-Up for digital or admin-assisted registration and approved maximum buy-ins.':'Usa Inscripciones de la sesión para inscripciones digitales o asistidas con los costos máximos autorizados.',
  'Session registrations must be managed through Session Sign-Up; use Permanent roster for identity corrections.':'Las inscripciones se gestionan en Inscripciones de la sesión; usa la lista permanente para corregir identidades.',
  'No current session charge exists for this bowler. Review confirmed entries in Session Sign-Up first.':'Este jugador no tiene cargos en la sesión actual. Revisa primero las inscripciones confirmadas.',
  'Public — searchable by everyone':'Pública — visible en búsquedas',
  'Private — existing members only':'Privada — solo miembros actuales',
  'Invitation only — QR/link required':'Solo por invitación — requiere QR o enlace',
  'Visibility':'Visibilidad',
  'One partner has reached the approved Doubles team limit. Update and confirm their entries in Session Sign-Up, then Sync before adding another team.':'Un integrante alcanzó su límite autorizado de Parejas Virtuales. Actualiza y confirma sus inscripciones en Inscripciones de la sesión, luego sincroniza antes de agregar otro equipo.',
  'Virtual Doubles — assigned partners':'Parejas Virtuales — compañeros asignados',
  'Counted automatically from distinct registered teams. Review the total after partners are assigned.':'Se cuentan automáticamente las parejas registradas y distintas. Revisa el total después de asignar compañeros.',
  'Select bowler':'Seleccionar jugador',
  'RECONFIRM REQUIRED':'REQUIERE NUEVA CONFIRMACIÓN',
  'Doubles team added. Both partners must review and confirm their updated team counts and buy-ins in Session Sign-Up before scoring.':'Pareja Virtual agregada. Ambos jugadores deben revisar y confirmar la nueva cantidad de parejas y el costo correspondiente en Inscripciones de la sesión antes de registrar puntuaciones.',
  '90% of total High Game entries is divided into three equal game pools. Highest handicap score in each game wins its game pool. Every winner payout is rounded DOWN to a multiple of $50; ties share the game pool and each share is rounded down. The admin retains at least 10% plus rounding remainders.':'El 90% de las inscripciones de Línea Alta se divide entre los tres juegos. El mayor puntaje con hándicap de cada juego gana su bolsa. Cada premio se redondea HACIA ABAJO a múltiplos de $50; los empates dividen la bolsa y cada parte se redondea hacia abajo. El administrador conserva al menos el 10% más los sobrantes.',
  'Pay highest combined score in each game (Games 1, 2 and 3)':'Premiar el mayor puntaje combinado en cada juego (1, 2 y 3)',
  'Pay highest combined series':'Premiar la serie combinada más alta',
  'Number of paid team places (1–20)':'Número de lugares de parejas premiados (1–20)',
  'For each enabled award category, the total Doubles purse is divided equally. Set the percentage of that category pool paid to 1st, 2nd, etc. The combined percentages cannot exceed 100%. Each team\'s prize is rounded DOWN to a multiple of $50 BEFORE splitting it equally between partners. Any unused amount is retained by the admin.':'La bolsa de Parejas Virtuales se divide por igual entre los premios habilitados. Indica el porcentaje de cada bolsa para primero, segundo y otros lugares. La suma no puede superar 100%. El premio de cada pareja se redondea HACIA ABAJO a múltiplos de $50 ANTES de dividirlo entre sus dos integrantes. El administrador conserva el sobrante.',
  'Doubles — Series Only':'Parejas Virtuales — solo serie',
  "Only the combined three-game series (with both bowlers' handicaps) is eligible for a prize. No individual-game prizes are paid.":'Solo se premia la serie combinada de tres juegos (con el hándicap de ambos jugadores). No hay premios por juegos individuales.',
  "Enter the percentage of the TOTAL Doubles purse for every paid place (for example: 35%, 20%, 15%, 10%, 5%). The percentages may add to less than 100%, but not more. Each winning TEAM's prize is rounded DOWN to a multiple of $50 before splitting the amount equally between partners. The remainder is retained by the admin.":'Indica el porcentaje de la bolsa TOTAL de Parejas Virtuales para cada lugar premiado (por ejemplo: 35%, 20%, 15%, 10%, 5%). La suma puede ser menor de 100%, pero nunca mayor. El premio de cada PAREJA se redondea HACIA ABAJO a múltiplos de $50 antes de dividirlo entre ambos integrantes. El administrador conserva el sobrante.',
  'Enter a positive percentage for every paid Doubles place; the total cannot exceed 100%.':'Ingresa un porcentaje mayor que cero para cada lugar premiado; la suma no puede superar 100%.',
  'High Game awards — 90% split across Games 1–3':'Premios de Línea Alta — 90% distribuido entre los juegos 1–3',
  'Choose 1–20 paid Doubles places and percentages totaling no more than 100%.':'Elige entre 1 y 20 lugares premiados de Parejas Virtuales y porcentajes cuya suma no supere 100%.',
  'High Game — Participate?':'Línea Alta — ¿Participar?',
  'Private competitions cannot issue invitations. Change visibility to invitation-only.':'Las competencias privadas no pueden emitir invitaciones. Cambia la visibilidad a Solo por invitación.',
  'Generate a NEW invitation QR? Previously shared invitation-only links will stop working.':'¿Generar un NUEVO QR de invitación? Los enlaces anteriores dejarán de funcionar.',
  'Add a competition with a QR code':'Agregar competencia con código QR',
  'Scan QR with camera':'Escanear QR con cámara',
  'Upload QR image':'Subir imagen QR',
  'Stop camera':'Detener cámara',
  'Camera stopped.':'Cámara detenida.',
  'Confirm competition':'Confirmar competencia',
  'Share Competition QR':'Compartir QR de la competencia',
  'Share competition QR code':'Compartir código QR de la competencia',
  'Download QR image':'Descargar imagen QR',
  'Share QR / link':'Compartir QR / enlace',
  'Copy invitation link':'Copiar enlace de invitación',
  'Invitation link':'Enlace de invitación',
  'Invitation link copied.':'Enlace de invitación copiado.',
  'Invitation link copied. Paste it into WhatsApp or email.':'Enlace copiado. Pégalo en WhatsApp o correo.',
  'QR ready. Download the image, share it, or send the invitation link.':'QR listo. Descarga la imagen, compártela o envía el enlace.',
  'Preparing QR image…':'Preparando imagen QR…',
  'Competition found. Review and confirm below.':'Competencia encontrada. Revísala y confirma abajo.',
  'Already added.':'Ya se agregó.',
  'Invitation dismissed.':'Invitación cancelada.',
  'Competition added to your dashboard.':'Competencia agregada a tu panel.',
  'This competition is already on your dashboard.':'Esta competencia ya está en tu panel.',
  'Confirm to add this competition to your dashboard. Your bowler profile and tournament entries are managed separately.':'Confirma para agregar esta competencia a tu panel. Tu perfil de jugador y las inscripciones del torneo se gestionan por separado.',
  'Add to my dashboard':'Agregar a mi panel',
  'Camera permission was denied. Allow camera access in browser settings, or upload a QR image.':'Se denegó el acceso a la cámara. Actívalo en la configuración del navegador o sube una imagen QR.',
  'Camera is unavailable. Upload a QR image or open the invitation link instead.':'La cámara no está disponible. Sube una imagen QR o abre el enlace de invitación.',
  'Your browser will ask for camera access. Hold the competition QR inside the frame.':'El navegador solicitará acceso a la cámara. Coloca el QR de la competencia dentro del recuadro.',
  'No QR code was found in this image. Try a clearer picture.':'No se encontró un código QR en la imagen. Prueba con una imagen más clara.',
  'Sign in with a bowler account to add a competition.':'Inicia sesión con una cuenta de jugador para agregar una competencia.',
  'QR image is not ready yet. Try sharing the link.':'La imagen QR aún no está lista. Prueba compartir el enlace.',
  'Only a competition manager can share its QR code.':'Solo el administrador de la competencia puede compartir su código QR.',
  'Select a competition to share first.':'Primero selecciona una competencia para compartir.',
  'My leagues and tournaments':'Mis ligas y torneos',
  'Add leagues you bowl in. Search by name, country, state, city or bowling center.':'Agrega las ligas en las que participas. Busca por nombre, país, estado, ciudad o boliche.',
  'Scan the manager\'s QR code with your camera, upload a saved QR image, or open their WhatsApp/email invitation link. Camera permission is requested only when you choose Scan.':'Escanea el QR del administrador con la cámara, sube una imagen QR guardada o abre su enlace de WhatsApp/correo. El permiso de cámara solo se solicita al elegir Escanear.',
  'Bowlers can scan this QR inside their app or open the invitation link from WhatsApp or email. They must sign in and confirm the competition; the QR does not grant manager access.':'Los jugadores pueden escanear este QR en la aplicación o abrir el enlace de WhatsApp o correo. Deben iniciar sesión y confirmar la competencia; el QR no otorga permisos de administrador.',

  'This computer could not keep a recovery copy. Keep this page open until the server confirms the save.':'No se pudo guardar una copia de recuperación en esta computadora. Mantenga abierta esta página hasta que el servidor confirme que se guardaron los cambios.',
  'View previous years':'Ver años anteriores',
  'No previous years.':'No hay años anteriores.',
  'Financial archive':'Archivo financiero',
  'Added':'Agregado',
  'No matching leagues.':'No se encontraron ligas.',
  'No other matching leagues.':'No se encontraron otras ligas que coincidan.',
  'Status':'Estado',
  'Account link':'Cuenta vinculada',
  'Active':'Activo',
  'Linked':'Vinculado',
  'Reset':'Restablecer',
  'Not linked':'Sin vincular',
  'Import history':'Historial de importaciones',
  'Undone':'Deshecha',
  'No roster imports yet.':'Todavía no hay importaciones de jugadores.',
  'Roster import':'Importación de jugadores',
  'Add to my dashboard':'Agregar a mi panel','+ Find a League or Tournament':'+ Buscar liga o torneo',
  'All scores saved and locked.':'Se guardaron y bloquearon todas las puntuaciones.',
  'Scores reopened for corrections.':'Se desbloquearon las puntuaciones para hacer correcciones.',
  'Bowler account link saved.':'Se guardó la vinculación de la cuenta del jugador.',
  'Bowler account unlinked.':'Se desvinculó la cuenta del jugador.',
  'Excel tools are still loading.':'Las herramientas de Excel todavía se están cargando.',
  'Undo the most recent roster import?':'¿Deshacer la última importación de jugadores?',
  'Saving changes…':'Guardando cambios…',
  'Not saved to server.':'No se guardó en el servidor.',
  'Registration, brackets, scoring and payouts':'Registro, brackets, puntuación y premios',
  '/ MANAGER':'/ ADMINISTRADOR',
  'Registration & configuration':'Registro y configuración','Brackets':'Brackets','High Game':'Linea Alta',
  'Doubles':'Parejas Virtuales','Scoring':'Puntuación','Reports & payouts':'Reportes y premios','Competition Summary':'Resumen de la competencia','Overview of entries, payouts and profit for this session.':'Resumen de inscripciones, premios y ganancia de esta sesión.','Handicap brackets played':'Brackets con hándicap jugados','Scratch brackets played':'Brackets scratch jugados','High Game entries':'Inscripciones de Línea Alta','Doubles teams played':'Parejas Virtuales jugadas','Total income':'Ingreso total','Total payout':'Pago total','Total profit':'Ganancia total','Summary':'Resumen','Results':'Resultados',
  'Buy-ins and payouts':'Inscripciones y premios','Buy-ins are per bowler or bracket entry. All awards use the fixed payout amounts saved below.':'Los costos son por jugador o por entrada a un bracket. Todos los premios usan las cantidades fijas guardadas abajo.',
  'A final-game tie is decided by handicap series, then highest handicap game. If both remain tied, the combined first and second prizes are split equally.':'Un empate en la final se decide por la serie con hándicap y después por el juego más alto con hándicap. Si todo sigue empatado, los premios combinados del primer y segundo lugar se dividen en partes iguales.',
  'Handicap bracket':'Bracket con hándicap','Scratch bracket':'Bracket scratch','Handicap High Game Pot':'Linea Alta con hándicap',
  'Buy-in ($)':'Inscripción ($)','1st place (%)':'1.er lugar (%)','2nd place (%)':'2.º lugar (%)',
  'Winner payout (%)':'Premio al ganador (%)','Highest game plus handicap wins. Tied winners split the payout equally.':'Gana el juego más alto con hándicap. Si hay empate, se divide el premio.',
  'Buy-in per team entry, per bowler ($)':'Inscripción por equipo, por jugador ($)',
  'Pay highest combined game':'Premiar el juego combinado más alto','High Game payout (%)':'Premio de Linea Alta (%)',
  'Pay highest combined series':'Premiar la serie combinada más alta','Series payout (%)':'Premio de serie (%)',
  "Each partner's handicap is included in every game. You may pay either prize or both. Enabled payouts together cannot exceed 100% of Doubles buy-ins.":'Se suma el hándicap de ambos jugadores en cada juego. Puede premiar uno o ambos resultados. Los premios activos no pueden superar el 100% de las inscripciones de Parejas Virtuales.',
  'Register a bowler':'Registrar jugador','Bracket numbers are the maximum each bowler is willing to play. Doubles charges depend on the teams added in the Doubles tab.':'Los números de brackets son el máximo que cada jugador desea jugar. El costo de Parejas Virtuales depende de los equipos agregados en esa pestaña.',
  'Name':'Nombre','Handicap per game':'Hándicap por juego','Max handicap brackets':'Máximo de brackets con hándicap','Max scratch brackets':'Máximo de brackets scratch',
  'Handicap brackets':'Brackets con hándicap','Scratch brackets':'Brackets scratch','High Game Pot':'Linea Alta',
  'Add bowler':'Agregar jugador','Save changes':'Guardar cambios','Cancel edit':'Cancelar edición','Roster':'Participantes',
  'Bowler':'Jugador','Handicap':'Hándicap','Max HDCP':'Máx. hándicap','Max scratch':'Máx. scratch','Doubles teams':'Equipos de Parejas Virtuales',
  'Each team shows combined handicap scores for Games 1–3 and its combined series. Add or remove teams here; individual bowler scores remain in Scoring. A bowler may play on multiple different teams and pays one buy-in for each team.':'Cada pareja muestra sus puntajes combinados con hándicap en los juegos 1–3 y su serie combinada. Agrega o elimina parejas aquí; los puntajes individuales se mantienen en Puntuaciones. Un jugador puede participar en varias parejas diferentes y paga una inscripción por cada una.',
  'Actions':'Acciones','Edit':'Editar','Remove':'Eliminar','Yes':'Sí','No':'No',
  "The draw creates the maximum number of complete eight-bowler brackets within each bowler's limit, while minimizing repeated bracket groups and first-round opponents. Fewer than eight entrants cannot form a bracket. Unused willingness is not charged.":'El sorteo crea la cantidad máxima de brackets completos de ocho jugadores sin superar el límite de cada jugador y minimiza grupos y oponentes repetidos en la primera ronda. Con menos de ocho participantes no se forma un bracket. Los lugares no usados no se cobran.',
  'Generate brackets':'Generar brackets','Handicap brackets':'Brackets con hándicap','Scratch brackets':'Brackets scratch',
  'GAME 1':'JUEGO 1','GAME 2 · SEMIFINAL':'JUEGO 2 · SEMIFINAL','GAME 3 · FINAL':'JUEGO 3 · FINAL','WINNER':'GANADOR',
  'Blue circle = winner   •   Red X = loser   •   BYE = automatic advance':'Círculo azul = ganador   •   X roja = perdedor   •   LIBRE = avance automático',
  'Blue circle = round winner   •   Gold 1 = champion   •   Silver 2 = finalist   •   Red X = eliminated':'Círculo azul = ganador de ronda   •   Oro 1 = campeón   •   Plata 2 = finalista   •   X roja = eliminado',
  'Blue circle = round winner   •   Gold 1 = champion   •   Silver 2 = finalist   •   Red X = eliminated   •   BYE = automatic advance':'Círculo azul = ganador de ronda   •   Oro 1 = campeón   •   Plata 2 = finalista   •   X roja = eliminado   •   LIBRE = pase automático',
  'BYE':'LIBRE','PENDING':'PENDIENTE',
  'All three games use handicap. Each game\'s highest score wins that game\'s share of 90% of the High Game purse, rounded DOWN to a multiple of $50. Tied winners divide that game\'s prize.':'Los tres juegos incluyen hándicap. El puntaje más alto de cada juego gana su parte del 90% de la bolsa de Línea Alta, redondeada HACIA ABAJO a múltiplos de $50. Los ganadores empatados dividen el premio de ese juego.',
  'Generate / update standings':'Generar / actualizar resultados','Best game':'Mejor juego','Pot result':'Resultado de Linea Alta',
  'Add each two-bowler team here. A bowler may play on multiple different teams and pays one buy-in for each team. Both bowlers must already be in the roster.':'Agregue aquí cada equipo de dos jugadores. Un jugador puede participar en varios equipos distintos y paga una inscripción por cada uno. Ambos deben estar registrados.',
  'First bowler':'Primer jugador','Second bowler':'Segundo jugador','Add Doubles Team':'Agregar Pareja Virtual','Please register bowler.':'Por favor, registre al jugador.',
  "Enter each bowler's scratch games once. Those scores update every bracket and Doubles team that includes that bowler. Handicap is added per game.":'Ingrese una vez los juegos scratch de cada jugador. Los resultados actualizan todos sus brackets y Parejas Virtuales. El hándicap se suma por juego.',
  'Scores':'Puntuaciones','Game 1':'Juego 1','Game 2':'Juego 2','Game 3':'Juego 3','Scratch series':'Serie scratch','HDCP series':'Serie con hándicap',
  'Doubles match totals':'Totales de Parejas Virtuales','Team':'Equipo','Combined series':'Serie combinada','Combined':'Combinado','Series':'Serie',
  'Tournament summary':'Resumen del torneo','Event columns show winnings minus buy-ins. Red is a loss; green is a gain. Overall balance is total winnings minus total charges.':'Las columnas por evento muestran premios menos inscripciones. Rojo indica pérdida y verde ganancia. El saldo total es premios menos cargos.',
  'Why they pay':'Motivo del cargo','Total due':'Total a pagar','Winnings and why':'Premios y motivo','Total won':'Total ganado','Scratch':'Scratch','Balance':'Saldo',
  'Total charges':'Cargos totales','Total winnings':'Premios totales','Combined bowler balance':'Saldo combinado de jugadores',
  'Competition data':'Datos de la competencia',"Starting a new competition downloads a JSON backup, then clears this browser's tournament data after you confirm the download is saved.":'Iniciar una competencia descarga una copia JSON y después borra los datos de este navegador cuando confirme que se guardó.',
  'Start New Competition':'Iniciar nueva competencia','Restore a JSON backup':'Restaurar copia JSON','Print report':'Imprimir reporte',
  'No Doubles teams added yet.':'Todavía no hay Parejas Virtuales agregadas.','Remove team':'Eliminar equipo',
  'Add a team above to see its game results.':'Agregue una Pareja Virtual arriba para ver sus resultados.',
  'Payout is pending until every entrant has all three scores.':'El premio está pendiente hasta que todos tengan tres puntuaciones.',
  'needs the next score only from bowlers still competing.':'solo necesita la siguiente puntuación de los jugadores que siguen compitiendo.',
  'No bowlers registered for High Game Pot.':'No hay jugadores registrados para Linea Alta.',
  'No brackets generated. At least eight different bowlers must select this event.':'No se generaron brackets. Se necesitan al menos ocho jugadores distintos en este evento.',
  'No event participants.':'No hay participantes en eventos.',
  'No participants.':'Sin participantes.','No winnings':'Sin premios','No entries':'Sin inscripciones',
  'No bowlers registered yet.':'Todavía no hay jugadores registrados.','No Doubles teams added yet.':'Todavía no hay Parejas Virtuales agregadas.',
  'Payouts appear after every team bowler has all three scores.':'Los premios aparecerán cuando todos los integrantes tengan tres puntuaciones.',
  'Doubles results':'Resultados de Parejas Virtuales','Best combined game:':'Mejor juego combinado:',
  'Doubles bowlers without a team are not charged.':'Los jugadores sin Pareja Virtual no pagan inscripción.',
  'Generate brackets to determine actual bracket charges.':'Genere los brackets para calcular los cargos reales.',
  'Bowler saved. Generate brackets again after roster changes.':'Jugador guardado. Genere los brackets de nuevo después de cambiar la lista.',
  'Doubles team added.':'Pareja Virtual agregada.','Doubles team removed.':'Pareja Virtual eliminada.',
  'A Doubles team needs two different bowlers.':'Una Pareja Virtual necesita dos jugadores diferentes.',
  'This Doubles team is already registered.':'Esta Pareja Virtual ya está registrada.',
  'Score saved.':'Puntuación guardada.','Configuration saved.':'Configuración guardada.',
  'High Game standings updated.':'Resultados de Linea Alta actualizados.',
  'Competition data was kept.':'Se conservaron los datos de la competencia.',
  'Backup restored.':'Copia restaurada.','Could not read the JSON backup.':'No se pudo leer la copia JSON.',
  'This is not a valid Monster Bowling backup.':'Esta copia JSON de Monster Bowling no es válida.',
  'Download SVG image':'Descargar imagen SVG',
  'New competition started. Previous data is in your JSON backup.':'Nueva competencia iniciada. Los datos anteriores están en la copia JSON.',
  'Backup was not saved. Competition data was kept.':'No se guardó la copia. Se conservaron los datos.',
  'Check the buy-ins and fixed payout amounts.':'Revise las inscripciones y las cantidades fijas de los premios.',
  'Doubles needs all three scores for every team bowler.':'Parejas Virtuales necesita las tres puntuaciones de cada integrante.',
  'Language / Idioma':'Idioma / Language','Language':'Idioma','English':'Inglés','Log in':'Iniciar sesión','Log out':'Cerrar sesión',
  'Sign in':'Iniciar sesión','Select a league or tournament to view its results. The administrator can sign in to manage all competitions.':'Seleccione una liga o torneo para ver sus resultados. El administrador puede iniciar sesión para gestionar todas las competencias.',
  'Sign in to view your available leagues, tournaments, sessions and results.':'Inicie sesión para ver sus ligas, torneos, sesiones y resultados disponibles.',
  'Email':'Correo electrónico','Password':'Contraseña','League / tournament':'Liga / torneo','Choose a league or tournament':'Seleccione una liga o torneo',
  'Forgot password?':'¿Olvidó su contraseña?','Reset your password':'Restablecer su contraseña','Enter your account email and we will send you a secure password reset link.':'Ingrese el correo de su cuenta y le enviaremos un enlace seguro para restablecer su contraseña.',
  'Send reset link':'Enviar enlace','Back to sign in':'Volver al inicio de sesión','Choose a new password':'Elija una contraseña nueva','Enter your new password below.':'Ingrese su contraseña nueva abajo.',
  'New password':'Contraseña nueva','Confirm new password':'Confirmar contraseña nueva','Update password':'Actualizar contraseña',
  'Create an account':'Crear una cuenta','Register with email':'Registrarse con correo electrónico','Confirm the email we send you before signing in. No administrator approval is needed.':'Confirme el correo que le enviaremos antes de iniciar sesión. No necesita aprobación del administrador.',
  'Register':'Registrarse','Verify your email':'Verifique su correo electrónico','Enter the code sent to your email.':'Ingrese el código enviado a su correo electrónico.',
  'Verification code':'Código de verificación','Verify email':'Verificar correo','Send another code':'Enviar otro código',
  'Leagues and tournaments':'Ligas y torneos','Manage leagues and tournaments':'Administrar ligas y torneos','Available leagues and tournaments':'Ligas y torneos disponibles','Playing Summary':'Resumen de juego','Equipment Statistics':'Estadísticas de bolas y pistas',"Nightly Registration":"Inscripción nocturna","Session Sign-Up":"Inscripción a la sesión","Create a new session — pricing approval required":"Crear una sesión nueva — se requiere aprobación de costos","Costs saved to Neon. Session signup is paused until you review and confirm these prices in Session Sign-Up.":"Costos guardados en Neon. Las inscripciones permanecerán pausadas hasta que revises y confirmes los importes en Inscripción a la sesión.","Registration is pending cost confirmation by the league manager. No entries can be submitted yet.":"El registro está pendiente de que el administrador confirme los costos. Todavía no se pueden enviar inscripciones.","Each new session starts with sign-up closed. First configure and save your buy-in costs in Registration & configuration, then return here to review those costs and open registration. Digital and admin-assisted sign-up remain open until brackets are generated; there is no time-based cutoff. Handicaps can be corrected until the first official game is saved.":"Cada sesión nueva inicia con las inscripciones cerradas. Primero configura y guarda los costos en Registro y configuración; después regresa aquí para revisar esos importes y abrir las inscripciones. Los registros digitales y asistidos permanecen abiertos hasta generar los brackets, sin horario de cierre. Se puede corregir el hándicap hasta registrar el primer juego oficial.","Create a new session with sign-up initially closed. Review and save buy-in prices before explicitly opening registration. This resets the current session's entries, payment status, brackets and scores, but keeps the roster, handicaps and existing cost settings for review. Save or archive any results you need before proceeding.":"Crea una nueva sesión con las inscripciones inicialmente cerradas. Revisa y guarda los costos antes de abrir el registro. Se reinician las inscripciones, pagos, brackets y puntuaciones, pero se conservan el padrón, los hándicaps y los costos anteriores para revisión. Guarda o archiva los resultados que necesites antes de continuar.","Create New Session — Review Costs First":"Crear nueva sesión — revisar costos primero","⚠ Before opening signup: configure and save the session buy-in costs.":"⚠ Antes de abrir inscripciones: configura y guarda los costos de la sesión.","The price review below uses prices saved in Neon, not unsaved fields. Digital and assisted signup remain disabled until you approve them.":"Los importes mostrados provienen de los costos guardados en Neon, no de campos sin guardar. Los registros digitales y asistidos seguirán deshabilitados hasta que los apruebes.","1. Set or review buy-ins in Registration & configuration":"1. Configurar o revisar costos en Registro y configuración","2. Review saved prices for this session":"2. Revisar los costos guardados para esta sesión","Saved buy-in":"Costo guardado","I have reviewed and approved all four saved buy-in prices for this session.":"Revisé y aprobé los cuatro costos guardados para esta sesión.","Open Registration with These Prices":"Abrir inscripciones con estos costos","Registration pending — confirm costs first":"Inscripciones pendientes — primero confirma los costos","Registration pending — manager must confirm session costs":"Inscripciones pendientes — el administrador debe confirmar los costos","Save valid buy-ins for all four categories before registration can be opened.":"Guarda costos válidos para las cuatro categorías antes de abrir las inscripciones.","New session created. Review and save the four buy-in costs before opening registration.":"Nueva sesión creada. Revisa y guarda los cuatro costos antes de abrir las inscripciones.","New session ready. Review and confirm buy-in prices before opening registration; archived scores unchanged.":"Nueva sesión lista. Revisa y confirma los costos antes de abrir inscripciones; las puntuaciones archivadas no cambiaron.","Session prices confirmed. Digital and admin-assisted signup are now open.":"Costos confirmados. Las inscripciones digitales y asistidas ya están abiertas.","Session is open for registration.":"La sesión está abierta para inscripciones.","Session created. Registration is pending cost approval.":"Sesión creada. Las inscripciones están pendientes de aprobación de costos.","Open sign-up for a new session":"Abrir inscripciones para una nueva sesión","Create the next current session and open digital and manager-assisted registration immediately. This resets the current session's entries, payment status, brackets and scores, but keeps the roster, handicaps and buy-ins. Save or archive any results you need before proceeding.":"Crea la siguiente sesión y abre inmediatamente las inscripciones digitales y asistidas por el administrador. Se reiniciarán las inscripciones, pagos, brackets y puntuaciones de la sesión actual, pero se conservarán los jugadores, hándicaps y cuotas. Guarda o archiva los resultados que necesites antes de continuar.","New session name":"Nombre de la nueva sesión","Session date":"Fecha de la sesión","Create New Session & Open Sign-Up":"Crear nueva sesión y abrir inscripciones","Creating new session and opening registration…":"Creando nueva sesión y abriendo inscripciones…","New session created. Digital and admin-assisted sign-up are open until brackets are generated.":"Nueva sesión creada. Las inscripciones digitales y asistidas estarán abiertas hasta que se generen los brackets.","Enter a session name and date to open sign-up.":"Ingresa el nombre y la fecha de la sesión para abrir las inscripciones.","Start a new current session and open digital sign-up? The previous session’s entries, payments, brackets, High Game, Doubles and scores will be reset. Save or archive previous results first. Existing archived sessions and permanent roster profiles will remain.":"¿Iniciar una nueva sesión y abrir las inscripciones digitales? Se reiniciarán las inscripciones, pagos, brackets, Línea Alta, Dobles y puntuaciones de la sesión anterior. Guarda o archiva los resultados anteriores primero. Las sesiones archivadas y los jugadores del padrón permanente se conservarán.","Session Sign-Up · Manager":"Inscripción a la sesión · Administrador","Enter brackets, High Game, or Virtual Doubles for the current session. Digital signup stays open until your manager generates the bracket draws.":"Inscríbete a brackets, Línea Alta o Parejas Virtuales para la sesión actual. La inscripción digital permanece abierta hasta que el administrador genere los brackets.","Sign-up activates automatically whenever you save a fresh unscored session. Digital and admin-assisted signup remain available until brackets are generated. There is no time-based cutoff. Handicaps can be corrected until the first official game is saved.":"La inscripción se activa automáticamente al guardar una nueva sesión sin juegos registrados. Las inscripciones digitales y asistidas permanecen abiertas hasta generar los brackets. No hay límite de horario. Se puede corregir el hándicap hasta que se guarde el primer juego oficial.","Use the same session's roster for assisted registrations and approvals. Sync entries before generating brackets.":"Usa la lista de jugadores de la misma sesión para inscripciones asistidas y aprobaciones. Sincroniza las inscripciones antes de generar los brackets.","Registration open until bracket generation":"Inscripciones abiertas hasta generar los brackets","No sessions available yet. Start and save a fresh scoreless session in the manager to activate digital sign-up automatically.":"Todavía no hay sesiones disponibles. Inicia y guarda una sesión sin juegos registrados para activar automáticamente la inscripción digital.","Manager-assisted registration saved; no payment was taken.":"Se guardó la inscripción asistida; no se realizó ningún cobro.","Session buy-ins are not configured.":"No se configuraron las cuotas de la sesión.","Admin-assisted signup":"Registro asistido por el administrador","Available for both digital and manual nights while registration is open. Register a bowler from the permanent roster, even without a bowler account.":"Disponible tanto para jornadas digitales como manuales mientras esté abierto el registro. Inscribe a un jugador del padrón permanente, aunque no tenga cuenta.","Review assisted registration & total":"Revisar inscripción asistida y total","Add active bowlers to the permanent roster before assisting with signup.":"Agrega jugadores activos al padrón permanente antes de inscribirlos.","Manager-assisted registration:":"Inscripción asistida por el administrador:","Verify the selected bowler authorizes these entries and this maximum commitment before saving on their behalf.":"Verifica que el jugador seleccionado autorice estas inscripciones y el compromiso máximo antes de guardarlas en su nombre.","I confirm the selected bowler authorized these entries and the maximum commitment shown above.":"Confirmo que el jugador seleccionado autorizó estas inscripciones y el compromiso máximo indicado arriba.","Confirm & save assisted registration":"Confirmar y guardar inscripción asistida","This is the maximum potential amount if all requested entries are assigned. Actual bracket charges depend on complete brackets. No payment is taken here. High Game is Yes/No (one entry per bowler); tied high scores split one fixed prize equally. Virtual Doubles charges only verified distinct teams, with each award split between partners.":"Este es el compromiso máximo posible si se asignan todas las inscripciones solicitadas. Los cargos reales de brackets dependen de completar brackets. Aquí no se cobra ningún pago. Línea Alta es Sí/No (una inscripción por jugador); los empates dividen el premio fijo en partes iguales. Parejas Virtuales solo cobra equipos distintos y verificados, y divide cada premio entre ambos integrantes.","Manager-assisted bowler registration saved; no payment was taken.":"La inscripción asistida se guardó correctamente; no se realizó ningún cobro.","Review the selected bowler, entry quantities and maximum total before confirming.":"Revisa el jugador seleccionado, las cantidades y el importe máximo antes de confirmar.","Cancelled — insufficient participation":"Cancelada — participación insuficiente","Event minimums:":"Mínimos por evento:","Qualified":"Calificado","Cancelled":"Cancelado","Minimums: 8 distinct bowlers in a bracket or High Game, or 8 verified Virtual Doubles teams.":"Mínimos: 8 jugadores distintos en brackets o Línea Alta, u 8 equipos verificados de Parejas Virtuales.","This night was cancelled because no event met its minimum. Registrations are retained; no draws or charges will be created.":"Esta jornada se canceló porque ningún evento cumplió con el mínimo. Las inscripciones se conservan y no habrá sorteos ni cargos.","This night was cancelled because no category reached the minimum of eight. Your registration record is kept; there is no competition charge.":"Esta jornada se canceló porque ninguna categoría alcanzó el mínimo de ocho. Tu inscripción se conserva y no habrá cargo por la competencia.","Review registration & total":"Revisar inscripción y total","Review your registration — not submitted yet":"Revisa tu inscripción — todavía no enviada","Event":"Evento","Quantity":"Cantidad","Unit price":"Precio unitario","Maximum subtotal":"Subtotal máximo","Maximum potential commitment":"Compromiso máximo posible","I have reviewed the quantities and maximum potential commitment shown above.":"He revisado las cantidades y el compromiso máximo posible indicado arriba.","Confirm & submit registration":"Confirmar y enviar inscripción","Edit quantities":"Editar cantidades","This is the maximum amount you may owe if all requested entries are assigned. Actual bracket charges depend on complete brackets. This confirmation does not take a payment. Multi-entry High Game and Virtual Doubles payouts are still being implemented.":"Este es el importe máximo que podrías pagar si se asignan todas las inscripciones solicitadas. Los cargos reales de los brackets dependen de que se formen brackets completos. Esta confirmación no cobra ningún pago. Los premios para múltiples entradas de Línea Alta y Parejas Virtuales siguen en desarrollo.","Registration confirmed. The manager can now verify your handicap.":"Inscripción confirmada. El administrador ya puede verificar tu hándicap.","Review and confirm your registration first.":"Primero revisa y confirma tu inscripción.","Entry quantities changed. Review your registration again.":"Las cantidades cambiaron. Vuelve a revisar tu inscripción.","Registration confirmed":"Inscripción confirmada","Not confirmed by bowler":"Aún no confirmada por el jugador","Manager-entered registration":"Registro capturado por el administrador","Nightly Registration · Manager":"Inscripción nocturna · Administrador","Register for this night using your linked permanent bowler profile. Registration closes at the scheduled cutoff or once the manager generates brackets.":"Inscríbete esta noche con tu perfil de jugador vinculado. El registro cierra a la hora programada o cuando el administrador genera los brackets.","Competition":"Competencia","Create nightly registration":"Crear registro nocturno","Scheduled start / signup cutoff":"Hora de inicio / cierre de inscripciones","Registration mode":"Modalidad de inscripción","Digital — bowlers sign up":"Digital — inscripción de jugadores","Manual — manager enters":"Manual — inscripción por administrador","Session name":"Nombre de la sesión","Handicap brackets":"Brackets con hándicap","Scratch brackets":"Brackets scratch","High Game entries":"Inscripciones de Línea Alta","Virtual Doubles entries":"Inscripciones de Parejas Virtuales","Add manager-entered registration":"Registrar jugador manualmente","Save nightly registration":"Guardar inscripción nocturna","Bowler registrations":"Jugadores inscritos","Register bowler":"Inscribir jugador","Approve handicap":"Aprobar hándicap","Update handicap":"Actualizar hándicap","Sync approved entries to bracket roster":"Sincronizar inscripciones con los brackets","Registration open":"Inscripciones abiertas","Registration closed":"Inscripciones cerradas","Handicaps editable":"Hándicaps editables","Handicaps locked":"Hándicaps bloqueados","No registrations yet.":"Aún no hay inscripciones.","No digital signups have been scheduled for this league yet.":"Todavía no se programan inscripciones digitales para esta liga.","Nightly registration created. Bowlers can sign up until the cutoff or bracket generation.":"Registro nocturno creado. Los jugadores pueden inscribirse hasta el cierre o la generación de brackets.","Your nightly entry is saved. The manager can review your handicap.":"Tu inscripción nocturna se guardó. El administrador puede revisar tu hándicap.","Handicap approved for this nightly session.":"Hándicap aprobado para esta sesión.","Manager-entered bowler registration saved.":"Inscripción del jugador guardada por el administrador.","Signup is closed. Your saved entry remains visible above.":"La inscripción está cerrada. Tu registro permanece visible arriba.","Multiple High Game and Virtual Doubles requests are saved but cannot yet be synced into payouts. Use one-click sync only for compatible entries; refresh the manager session afterward.":"Las inscripciones múltiples de Línea Alta y Parejas Virtuales se guardan, pero todavía no se pueden aplicar a los premios. Sincroniza solo inscripciones compatibles y después actualiza la sesión del administrador.","Create a fresh unscored session in the manager first. Schedule the start and select digital or manual signup. Bracket generation stops new entries; handicaps can be corrected until the first official game is saved.":"Primero crea una sesión nueva sin puntuaciones. Programa el inicio y elige inscripción digital o manual. La generación de brackets cierra inscripciones; los hándicaps pueden corregirse hasta guardar el primer juego oficial.",'Edit lanes & bowling balls':'Editar pistas y bolas','Your verified scratch scores grouped by bowling ball, lane pair, and game number. Results are based on the actual scores saved by the competition manager.':'Tus puntuaciones scratch verificadas, agrupadas por bola, par de pistas y número de juego. Los resultados se basan en las puntuaciones guardadas por el encargado de la competencia.','Your bowling ball, lane and game averages are available in the Equipment Statistics tab.':'Los promedios por bola, pista y número de juego están disponibles en la pestaña Estadísticas de bolas y pistas.','Equipment linked to your saved scores. View the Equipment Statistics tab for updated averages.':'Equipo vinculado a tus puntuaciones guardadas. Consulta la pestaña Estadísticas de bolas y pistas para ver los promedios actualizados.','My playing summary':'Mi resumen de juego','All linked leagues, tournaments, current sessions and saved sessions.':'Todas las ligas, torneos, sesiones actuales y sesiones guardadas vinculadas.','Total games':'Juegos totales','Total pinfall':'Pinos totales','Average':'Promedio','Money invested':'Dinero invertido','Money won':'Dinero ganado','Net result':'Resultado neto','By competition':'Por competencia','Games':'Juegos','Pinfall':'Pinos','Invested':'Invertido','Won':'Ganado','Net':'Neto','Link your account to a bowler profile to begin building your summary.':'Vincule su cuenta a un perfil de jugador para comenzar a crear su resumen.','Bowler of the Month':'Jugador del Mes','bracket win rate':'de victorias en brackets','brackets won':'brackets ganados',
  'Install Brackets':'Instalar Brackets','Install this webapp on your phone for quick access to sessions and results.':'Instale esta aplicación web en su teléfono para acceder rápidamente a sesiones y resultados.','Install app':'Instalar aplicación',
  'Competition name':'Nombre de la competencia','Type':'Tipo','League':'Liga','Tournament':'Torneo','Create competition':'Crear competencia','Back to dashboard':'Volver al panel',
  'Manage current session':'Administrar sesión actual','View current session':'Ver sesión actual','Manage Bowler Linked Accounts':'Administrar cuentas vinculadas de jugadores','Permanent roster':'Lista permanente','Edit details':'Editar detalles','Saved sessions':'Sesiones guardadas','View last saved session':'Ver última sesión guardada','View':'Ver','No saved sessions yet.':'Todavía no hay sesiones guardadas.','No competitions are available yet.':'Todavía no hay competencias disponibles.',
  'Review or change which registered login email belongs to each bowler. Assigning an email here replaces its previous bowler link in this competition.':'Revise o cambie qué correo de acceso registrado pertenece a cada jugador. Asignar un correo aquí reemplaza su vínculo anterior en esta competencia.','Bowler':'Jugador','Player ID':'ID del jugador','Roster email':'Correo de la lista','Linked login email':'Correo de acceso vinculado','Actions':'Acciones','Registered email':'Correo registrado','Save link':'Guardar vínculo','Unlink':'Desvincular','Close linked accounts':'Cerrar cuentas vinculadas','Inactive':'Inactivo',
  'The Excel template requires Bowler First Name, Bowler Last Name and Handicap. The app combines both name fields and only imports complete full names. When saved, each bowler receives a unique ID made from the competition country and state followed by seven digits.':'La plantilla de Excel requiere Nombre, Apellido y Hándicap del jugador. La aplicación combina ambos campos y solo importa nombres completos. Al guardar, cada jugador recibe un ID único creado con el país y estado de la competencia seguido de siete dígitos.','Fix these rows before importing:':'Corrija estas filas antes de importar:','Blank row':'Fila vacía','Apply roster import':'Aplicar importación de jugadores','Import preview':'Vista previa de importación',
  'Payout method: Fixed amount':'Método de premio: cantidad fija','1st place fixed ($)':'1.er lugar fijo ($)','2nd place fixed ($)':'2.º lugar fijo ($)','Winner fixed payout ($)':'Premio fijo al ganador ($)',
  'Highest game plus handicap wins. Tied winners split the fixed payout equally.':'Gana el juego más alto con hándicap. Los ganadores empatados dividen el premio fijo por partes iguales.',
  'High Game fixed team payout ($)':'Premio fijo por equipo para Linea Alta ($)','Series fixed team payout ($)':'Premio fijo por equipo para serie ($)',
  "Each partner's handicap is included in every game. Fixed team payouts are split equally between both partners.":'El hándicap de cada integrante se incluye en cada juego. Los premios fijos del equipo se dividen por igual entre ambos.',
  'Save payout configuration':'Guardar configuración de premios','Bowler login email':'Correo de acceso del jugador',
  "Bracket numbers are the maximum each bowler is willing to play. Doubles charges depend on the teams added in the Doubles tab. Add the bowler's login email so they can see their personal balance.":'Los números de brackets son el máximo que cada jugador está dispuesto a jugar. Los cargos de Parejas Virtuales dependen de los equipos agregados en esa pestaña. Agregue el correo de acceso del jugador para que pueda ver su saldo personal.',
  'Paid':'Pagado','Outstanding':'Pendiente','Settle now':'Liquidar ahora','Payments received':'Pagos recibidos','Total to settle now':'Total por liquidar ahora','Net settlement with bowlers':'Saldo neto con jugadores','Positive = payable to bowlers; negative = collectible from bowlers. Not tournament profit.':'Positivo = pago a jugadores; negativo = cobro a jugadores. No es la ganancia del torneo.',
  'Event columns show what must be settled now. Paid bowlers receive their full winnings; unpaid entry charges are deducted. Red is owed and green is payable to the bowler.':'Las columnas muestran lo que debe liquidarse ahora. Los jugadores que pagaron reciben todos sus premios; a quienes no pagaron se les descuentan las inscripciones. Rojo indica deuda y verde indica pago al jugador.',
  'Save this session':'Guardar esta sesión','Save the scores and payouts under this league, then begin the next bowling date with the same roster.':'Guarde las puntuaciones y premios en esta liga y luego inicie la siguiente fecha con la misma lista de jugadores.',
  "Session history & local backup":"Historial de sesiones y respaldo local","Start New Session automatically archives the completed session, scores, bracket draws, payments and payouts in Neon before opening the next session. If the archive cannot be verified, the current session is kept unchanged. Download local backup is optional and only saves a copy on this device.":"Iniciar nueva sesión archiva automáticamente en Neon la sesión completada, puntuaciones, brackets, pagos y premios antes de abrir la siguiente. Si no se puede verificar el archivo, se conserva la sesión actual. Descargar respaldo local es opcional y guarda una copia solamente en este dispositivo.","Create a new session with sign-up initially closed. The completed current session, its scores, brackets, payments and payouts are automatically archived to Neon before the next session is created. If archiving fails, the current session remains unchanged. Your permanent roster, handicaps and cost settings carry forward. Review costs before opening registration.":"Crea una sesión nueva con las inscripciones inicialmente cerradas. La sesión anterior, puntuaciones, brackets, pagos y premios se archivan automáticamente en Neon antes de crear la siguiente. Si falla el archivo, la sesión actual queda intacta. Se conservan el padrón permanente, los hándicaps y los costos. Confirma los costos antes de abrir inscripciones.","Previous session archived in Neon. New session ready; review and confirm buy-ins before opening registration.":"Sesión anterior archivada en Neon. La nueva sesión está lista; revisa y confirma los costos antes de abrir las inscripciones.","Start a new session? The completed current session, including all scores, brackets, payments and payouts, will first be archived to Neon. Only after the archive is verified will the next session start with a cleared playing area. Your permanent roster and archived sessions will remain. No separate Save Session step is required.":"¿Iniciar una nueva sesión? Se archivará primero en Neon la sesión actual con puntuaciones, brackets, pagos y premios. Solamente después de verificar el archivo se abrirá la siguiente sesión. Se conservan el padrón permanente y las sesiones archivadas. No necesitas guardar la sesión por separado.",'Session name':'Nombre de la sesión','Session date':'Fecha de la sesión','Save session':'Guardar sesión','Download local backup':'Descargar respaldo local','Local session backup downloaded. The active database session was not changed.':'Respaldo local descargado. La sesión activa en la base de datos no cambió.','Downloading backup…':'Descargando respaldo…','Start New Session':'Iniciar nueva sesión','Start a new session? The completed session, including scores, bracket draws, payments and winnings, will be archived in Neon before the next session begins. Your roster and handicaps stay in place. If the database archive fails, the current session will not be reset.':'La sesión completada, con puntuaciones, brackets, pagos y premios, se archivará en Neon antes de iniciar la siguiente. Si falla el archivo, la sesión actual no se reiniciará.','Print Payouts':'Imprimir premios','Payout Summary':'Resumen de premios','Printed':'Impreso','Print Saved Session':'Imprimir sesión guardada','Saved Session Report':'Reporte de sesión guardada',
  'Save the scores and payouts under this league. Starting a new session keeps the roster and handicaps, then resets entries, payments, brackets and scores.':'Guarde las puntuaciones y premios en esta liga. Iniciar una nueva sesión conserva la lista y los hándicaps, y reinicia las inscripciones, pagos, brackets y puntuaciones.',
  'Scores with handicap':'Puntuaciones con hándicap','Payout summary':'Resumen de premios','Results are pending.':'Los resultados están pendientes.',
  'Your balance':'Su saldo','Select your bowler above and choose Show my balance.':'Seleccione su jugador arriba y elija Mostrar mi saldo.',
  'Entry charges':'Cargos de inscripción','Winnings':'Premios','Current balance':'Saldo actual','Your bowler and notifications':'Su jugador y notificaciones',
  'Choose your bowler to view the correct balance and only the brackets that include you. Notifications are optional.':'Seleccione su jugador para ver el saldo correcto y solamente los brackets en las que participa. Las notificaciones son opcionales.',
  'Event date':'Fecha del evento','Show my balance':'Mostrar mi saldo','Enable notifications':'Activar notificaciones',
  'Matchups will appear when the previous game is decided.':'Los enfrentamientos aparecerán cuando se decida el juego anterior.',
  'This bowler is not entered in any handicap brackets.':'Este jugador no está inscrito en ningun bracket con hándicap.',
  'This bowler is not entered in any scratch brackets.':'Este jugador no está inscrito en ningun bracket scratch.',
  'No brackets generated.':'No se generaron brackets.','No charges':'Sin cargos','Competition':'Competencia','open':'abierta','league':'liga','tournament':'torneo',
  'Results have not been published for this competition yet.':'Todavía no se han publicado resultados para esta competencia.',
  'Total winnings':'Premios totales','Total won':'Total ganado','Paid:':'Pagado:','Outstanding:':'Pendiente:',
  'Configuration changed. Select Save payout configuration to keep it.':'La configuración cambió. Seleccione Guardar configuración de premios para conservarla.',
  'Changes not saved yet.':'Los cambios todavía no se han guardado.','Saving…':'Guardando…','Saved to Neon.':'Guardado en Neon.',
  'Generate Test Scores (Staging Only)':'Generar puntuaciones de prueba (solo staging)',
  'Generate the brackets or competition event before creating test scores.':'Genera los brackets o el evento antes de crear puntuaciones de prueba.',
  'One or more game scores already exist. Test scores will never overwrite them.':'Ya existen puntuaciones registradas. Las puntuaciones de prueba nunca las reemplazarán.',
  'No participating bowlers are available for test scores.':'No hay jugadores participantes para las puntuaciones de prueba.',
  'Scores are locked. Test scores cannot replace official scores.':'Las puntuaciones están bloqueadas. Las puntuaciones de prueba no pueden reemplazar resultados oficiales.',
  'Saving test scores to Neon…':'Guardando puntuaciones de prueba en Neon…',
  'Test score generation is available only to staging managers.':'Las puntuaciones de prueba solo están disponibles para administradores en staging.',
  'Open a saved staging competition session first.':'Primero abre una sesión guardada en staging.',
  'Upload Scores':'Subir puntuaciones','Save All & Lock Scores':'Guardar todo y bloquear puntuaciones','Edit Scores':'Editar puntuaciones','Saving score…':'Guardando puntuación…','Scores saved to Neon.':'Puntuaciones guardadas en Neon.','Scores are locked. Use Edit Scores to make a correction.':'Las puntuaciones están bloqueadas. Use Editar puntuaciones para corregirlas.','Scores save automatically. Upload Scores checks that all entered scores reached the database.':'Las puntuaciones se guardan automáticamente. Subir puntuaciones verifica que todas estén en la base de datos.',
  'Save brackets':'Guardar brackets','Save scores':'Guardar puntuaciones','Brackets saved and verified in Neon.':'Brackets guardados y verificados en Neon.','Scores saved and verified in Neon.':'Puntuaciones guardadas y verificadas en Neon.',
  'Saving brackets…':'Guardando brackets…','Saving scores…':'Guardando puntuaciones…','The brackets were not saved.':'No se guardaron los brackets.','The scores were not saved.':'No se guardaron las puntuaciones.',
  'Could not save.':'No se pudo guardar.','Try again.':'Inténtelo de nuevo.','Payout configuration saved.':'Configuración de premios guardada.',
  'Payout configuration was not saved.':'No se guardó la configuración de premios.','Check the fixed payout amounts.':'Revise las cantidades fijas de los premios.',
  'Check the payout configuration.':'Revise la configuración de premios.','Check the name, handicap and bracket counts.':'Revise el nombre, el hándicap y las cantidades de brackets.',
  'A bowler with that name is already registered.':'Ya existe un jugador registrado con ese nombre.','That login email is already linked to another bowler.':'Ese correo de acceso ya está vinculado a otro jugador.',
  'Saving payment status…':'Guardando estado de pago…','Payment status saved to Neon.':'Estado de pago guardado en Neon.',
  'Bowler and their Doubles teams removed. Generate brackets again.':'Se eliminaron el jugador y sus Parejas Virtuales. Genere los brackets nuevamente.',
  'Enter a whole game score from 0 to 300.':'Ingrese una puntuación entera entre 0 y 300.','Register bowlers first.':'Registre jugadores primero.',
  'Select High Game during registration, then generate the standings.':'Seleccione Linea Alta durante el registro y luego genere las posiciones.',
  'Unknown':'Desconocido','Full winnings are now payable.':'Ahora corresponde pagar todos los premios.','Entry charges will be deducted from winnings.':'Los cargos de inscripción se descontarán de los premios.',
  'Notifications are not available on this device yet.':'Las notificaciones todavía no están disponibles en este dispositivo.','Notification permission was not granted.':'No se concedió permiso para las notificaciones.',
  'Verify your email before signing in.':'Verifique su correo electrónico antes de iniciar sesión.','Signed in again. Your competition information was preserved.':'Sesión iniciada nuevamente. Se conservó la información de la competencia.',
  'Check your email for a verification code, then enter it below.':'Revise su correo para obtener el código de verificación e ingréselo abajo.','Email confirmed. You can now sign in.':'Correo confirmado. Ya puede iniciar sesión.',
  'A new verification code has been sent.':'Se envió un nuevo código de verificación.','You are logged out.':'Su sesión se cerró.','Log in to continue.':'Inicie sesión para continuar.',
  'If an account exists for that email, a password reset link has been sent.':'Si existe una cuenta con ese correo, se envió un enlace para restablecer la contraseña.',
  'The passwords do not match.':'Las contraseñas no coinciden.','This password reset link is invalid or has expired.':'Este enlace para restablecer la contraseña no es válido o venció.',
  'Password updated. You can now sign in.':'Contraseña actualizada. Ya puede iniciar sesión.','This password reset link is invalid or has expired. Request a new link.':'Este enlace para restablecer la contraseña no es válido o venció. Solicite uno nuevo.',
  'Choose a new password to finish resetting your account.':'Elija una contraseña nueva para terminar de restablecer su cuenta.',
  'Payout configuration saved to Neon.':'Configuración de premios guardada en Neon.','Site setup is incomplete. The Neon project URL must be configured.':'La configuración del sitio está incompleta. Debe configurarse la dirección del proyecto Neon.',
  'Competition is not available.':'La competencia no está disponible.','Enter a session name and date before saving.':'Ingrese un nombre y una fecha para la sesión antes de guardarla.',
  'Delete league/tournament':'Eliminar liga/torneo','Deleting…':'Eliminando…','Unnamed competition':'Competencia sin nombre','SuperAdmin only':'Solo para SuperAdmin',
  'Neon did not confirm the save.':'Neon no confirmó el guardado.','Open a competition as administrator first.':'Abra primero una competencia como administrador.',
  'Request failed':'La solicitud falló','Session expired':'La sesión expiró','Session expired.':'La sesión expiró.','Session expired. Sign in again.':'La sesión expiró. Inicie sesión nuevamente.',
  'Your session expired. Log in again to continue; the information on this screen is preserved.':'Su sesión expiró. Inicie sesión nuevamente para continuar; la información de esta pantalla se conservó.',
  'Session expired. Use Log in to continue.':'La sesión expiró. Use Iniciar sesión para continuar.',
  'Competitions':'Competencias','Users & access':'Usuarios y acceso','Change an account between User and Manager, then assign the leagues or tournaments that Manager can edit.':'Cambie una cuenta entre Usuario y Encargado y luego asigne las ligas o torneos que puede editar.',
  'SuperAdmin — Users & access':'SuperAdmin — Usuarios y acceso','Designate which registered users can manage a league or tournament, and choose exactly which competitions they can edit.':'Designe qué usuarios registrados pueden administrar una liga o torneo y elija exactamente qué competencias pueden editar.',
  'Find user by email':'Buscar usuario por correo','Start typing an email address':'Comience a escribir un correo electrónico','Search for and select a registered user.':'Busque y seleccione un usuario registrado.',
  'Saving session…':'Guardando sesión…','Saving scores, payouts and backup…':'Guardando puntuaciones, premios y copia de seguridad…','Session saved. The current session remains open.':'Sesión guardada. La sesión actual permanece abierta.','Starting a new session…':'Iniciando una sesión nueva…','A new session is ready with the roster and handicaps preserved.':'La nueva sesión está lista con la lista y los hándicaps conservados.','Manager access required.':'Se requiere acceso de encargado.','The latest competition changes could not be saved. Try again.':'No se pudieron guardar los cambios más recientes de la competencia. Inténtelo de nuevo.',
  'Start a new session? The roster, player IDs, emails and handicaps will remain. Entries, payment status, brackets, High Game, Doubles and scores will reset. Save the current session first if you need to keep it.':'¿Iniciar una sesión nueva? Se conservarán la lista, los ID, correos y hándicaps. Se reiniciarán las inscripciones, pagos, brackets, Linea Alta, Parejas Virtuales y puntuaciones. Guarde primero la sesión actual si desea conservarla.',
  'Account type':'Tipo de cuenta','User':'Usuario','Manager':'Encargado','Admin':'Administrador','Managed competitions':'Competencias administradas','All competitions':'Todas las competencias','Save access':'Guardar acceso','No users found.':'No se encontraron usuarios.','User access saved.':'Acceso del usuario guardado.'
  ,'Edit competition details':'Editar detalles de la competencia','Search for the bowling center name':'Buscar el nombre del boliche','Save details':'Guardar detalles','Competition details saved.':'Detalles de la competencia guardados.','Search for and select the bowling center.':'Busque y seleccione el boliche.','Enter at least three characters to search for a bowling center.':'Ingrese al menos tres caracteres para buscar un boliche.','Searching locations…':'Buscando ubicaciones…','Select the correct bowling center below.':'Seleccione abajo el boliche correcto.','Try the bowling center name with its city.':'Pruebe el nombre del boliche junto con su ciudad.','No matching bowling centers found.':'No se encontraron boliches coincidentes.','Bowling center search is awaiting its Geoapify key.':'La búsqueda de boliches está esperando su clave de Geoapify.','Location search is temporarily unavailable.':'La búsqueda de ubicaciones no está disponible temporalmente.'
};
const originalText=new WeakMap();
const renderedText=new WeakMap();
const originalAttributes=new WeakMap();
const renderedAttributes=new WeakMap();
function translateText(original) {
  if(state.language!=='es') return original;
  const trimmed=original.trim();

  const pendingPrefix='Pending edits are stored on this computer. ';
  if(trimmed.startsWith(pendingPrefix)){
    return original.replace(
      trimmed,
      'Los cambios pendientes están guardados en esta computadora. '+
      trimmed.slice(pendingPrefix.length)
    );
  }

  let translated=ES[trimmed];
  if(!translated) translated=trimmed
    .replace(/^Game (\d+) matchups$/,'Enfrentamientos del juego $1')
    .replace(/^Game (\d+) average$/,'Promedio del juego $1')
    .replace(/^G(\d+) average$/,'Promedio J$1')
    .replace(/^(\d+(?:\.\d+)?)% bracket win rate$/,'$1% de victorias en brackets')
    .replace(/^(\d+) of (\d+) brackets won$/,'$1 de $2 brackets ganados')
    .replace(/^Standings after game (\d+)$/,'Posiciones después del juego $1')
    .replace(/^Your balance — /,'Su saldo — ')
    .replace(/^Permanent roster — /,'Lista permanente — ')
    .replace(/^Confirm that you are (.+)\. This profile can only be changed by a Manager\.$/,'¿Confirmas que eres $1? Solo un encargado puede cambiar este perfil.')
    .replace(/^Manage Bowler Linked Accounts — /,'Administrar cuentas vinculadas de jugadores — ')
    .replace(/ · Financial archive$/,' · Archivo financiero')
    .replace(/^Total charges: /,'Cargos totales: ').replace(/ · Paid: /,' · Pagado: ').replace(/ · Outstanding: /,' · Pendiente: ')
    .replace(/^Total won: /,'Total ganado: ').replace(/^Current balance: /,'Saldo actual: ')
    .replace(/^Balance linked to (.+)\. Notifications remain off\.$/,'Saldo vinculado a $1. Las notificaciones permanecen desactivadas.')
    .replace(/^Notifications enabled for (.+) on (.+)\.$/,'Notificaciones activadas para $1 el $2.')
    .replace(/^Editing (.+)\. Changes save to Neon\.$/,'Editando $1. Los cambios se guardan en Neon.')
    .replace(/^Saved to Neon at (.+)$/,'Guardado en Neon a las $1')
    .replace(/^Save failed: (.+)\. Your edits remain on this screen\.$/,'Error al guardar: $1. Sus cambios permanecen en esta pantalla.')
    .replace(/Session expired\. Sign in again\./g,'La sesión expiró. Inicie sesión nuevamente.')
    .replace(/^(.+) Use Log in to continue\.$/,'$1 Use Iniciar sesión para continuar.')
    .replace(/^(.+) was saved\. The next session is ready with the roster preserved\.$/,'Se guardó $1. La siguiente sesión está lista con la misma lista de jugadores.')
    .replace(/^Permanently delete (.+) and all of its sessions, bowlers, brackets, scores, payouts and manager assignments\? This cannot be undone\.$/,'¿Eliminar permanentemente $1 y todas sus sesiones, jugadores, brackets, puntuaciones, premios y asignaciones de encargados? Esta acción no se puede deshacer.')
    .replace(/^(.+) was deleted\.$/,'Se eliminó $1.')
    .replace(/\bleague\b/g,'liga').replace(/\btournament\b/g,'torneo').replace(/\bopen\b/g,'abierta')
    .replace(/\bYes\b/g,'Sí').replace(/\bNo\b/g,'No')
    .replace(/^(.+) marked paid\. Full winnings are now payable\.$/,'$1 marcado como pagado. Ahora corresponde pagar todos los premios.')
    .replace(/^(.+) marked unpaid\. Entry charges will be deducted from winnings\.$/,'$1 marcado como no pagado. Los cargos de inscripción se descontarán de los premios.')
    .replace(/^Remove (.+) and their Doubles teams\?$/,'¿Eliminar a $1 y sus equipos de Parejas Virtuales?')
    .replace(/^(\d+) brackets? generated with new pairings\.$/,'Se generaron $1 brackets con nuevos enfrentamientos.')
    .replace(/^(\d+) brackets? generated\.$/,'Se generaron $1 brackets.')
    .replace(/^Team #(\d+)/,'Equipo n.º $1').replace(/^Pair #(\d+)/,'Pareja Virtual n.º $1')
    .replace(/Doubles high game/g,'Linea Alta de Parejas Virtuales').replace(/Doubles series/g,'Serie de Parejas Virtuales')
    .replace(/Doubles team(s)?/g,(_,plural)=>plural?'equipos de Parejas Virtuales':'equipo de Parejas Virtuales')
    .replace(/Handicap bracket(s)?/g,(_,plural)=>plural?'brackets con hándicap':'bracket con hándicap')
    .replace(/Scratch bracket(s)?/g,(_,plural)=>plural?'brackets scratch':'bracket scratch')
    .replace(/HDCP High Game Pot/g,'Linea Alta con hándicap')
    .replace(/Registered for Doubles but not on a team, so not charged:/g,'Registrados para Parejas Virtuales pero sin equipo, por lo que no pagan:')
    .replace(/Unused bracket willingness is not charged:/g,'Los lugares no usados en los brackets no se cobran:')
    .replace(/Willingness above the available full brackets:/g,'Lugares ofrecidos por encima de los brackets disponibles:')
    .replace(/Best combined game:/g,'Mejor juego combinado:').replace(/Winning game:/g,'Juego ganador:').replace(/Payout:/g,'Premio:')
    .replace(/Balances may change when pending results are entered\./g,'Los saldos pueden cambiar cuando se ingresen los resultados pendientes.')
    .replace(/No winnings/g,'Sin premios').replace(/No entries/g,'Sin inscripciones');
  return original.replace(trimmed,translated);
}
function translateUI() {
  if(typeof document==='undefined') return;
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()) {
    const node=walker.currentNode;if(['SCRIPT','STYLE'].includes(node.parentElement?.tagName))continue;
    const current = node.nodeValue;
const previouslyRendered = renderedText.get(node);

// Detect text changed by the application itself.
if (
  !originalText.has(node) ||
  (renderedText.has(node) && current !== previouslyRendered)
) {
  originalText.set(node, current);
}

const translated = translateText(originalText.get(node));

if (current !== translated) {
  node.nodeValue = translated;
}

renderedText.set(node, translated);

  }
document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(element => {
  const originals = originalAttributes.get(element) || {};
  const rendered = renderedAttributes.get(element) || {};
  for (const name of ['placeholder', 'title', 'aria-label']) {
    if (!element.hasAttribute(name)) {
      delete originals[name];
      delete rendered[name];
      continue;
    }
    const current = element.getAttribute(name);
    if (
      !Object.prototype.hasOwnProperty.call(originals, name) ||
      (
        Object.prototype.hasOwnProperty.call(rendered, name) &&
        current !== rendered[name]
      )
    ) {
      originals[name] = current;
    }

    const translated = translateText(originals[name]);

    if (current !== translated) {
      element.setAttribute(name, translated);
    }

    rendered[name] = translated;
  }

  originalAttributes.set(element, originals);
  renderedAttributes.set(element, rendered);
});
  document.documentElement.lang=state.language;
}
function preferredLanguage() { try{return localStorage.getItem(LANGUAGE_KEY)==='es'?'es':'en';}catch{return 'en';} }
function fresh() { return {config:{...DEFAULT_CONFIG,pairsPlacePercentages:[...DEFAULT_CONFIG.pairsPlacePercentages]},bowlers:[],brackets:{hdcp:[],scratch:[]},generated:false,highGenerated:false,pairs:[],pairsGenerated:false,language:preferredLanguage()}; }
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (!raw || !Array.isArray(raw.bowlers)) return fresh();
    const config={...DEFAULT_CONFIG};
    CONFIG_IDS.forEach(id=>{if(raw.config && Object.hasOwn(raw.config,id)) config[id]=raw.config[id];});
    if(Array.isArray(raw.config?.pairsPlacePercentages))
      config.pairsPlacePercentages=[...raw.config.pairsPlacePercentages];
    return {config,bowlers:raw.bowlers.map(({quin,...b})=>({...b,email:typeof b.email==='string'?b.email:'',paid:!!b.paid,high:!!b.high,pairs:!!b.pairs,scores:{...blankScores(),...b.scores}})),brackets:raw.brackets || {hdcp:[],scratch:[]},generated:!!raw.generated,highGenerated:!!raw.highGenerated,pairs:Array.isArray(raw.pairs)?raw.pairs:[],pairsGenerated:!!raw.pairsGenerated,language:raw.language==='es'?'es':'en'};
  } catch { return fresh(); }
}
let state = typeof localStorage === 'undefined' || globalThis.MONSTER_PORTAL_MODE ? fresh() : load();
let editingId = null;
let doublesDraftPercentages = null;
let doublesDraftCount = null;
function persist() {
  if (globalThis.MONSTER_PORTAL_MODE) {
    globalThis.MonsterPortal?.persist(state);
  } else if (typeof localStorage !== 'undefined') localStorage.setItem(KEY,JSON.stringify(state));
}
function configured(c) {
  if(!['MXN','USD'].includes(c.currency))return false;
  for (const id of NUMBER_IDS) if (typeof c[id]!=='number'||!Number.isFinite(c[id]) || c[id] < 0 || (PERCENT_IDS.includes(id) && c[id] > 100)) return false;
  if(!Number.isSafeInteger(c.pairsPaidPlaces)||c.pairsPaidPlaces<1||c.pairsPaidPlaces>20)return false;
  if(!Array.isArray(c.pairsPlacePercentages)||c.pairsPlacePercentages.length!==c.pairsPaidPlaces||
    c.pairsPlacePercentages.some(p=>typeof p!=='number'||!Number.isFinite(p)||p<=0||p>100||Math.abs(p*100-Math.round(p*100))>=1e-6))return false;
  const hundredths=c.pairsPlacePercentages.reduce((n,p)=>n+Math.round(p*100),0);
  return hundredths>0&&hundredths<=10000;
}
// The authoritative nightly quote-and-consent workflow owns portal registration.
// The standalone legacy editor is retained only for non-portal local mode.
function portalSignupOnly(){return !!globalThis.MONSTER_PORTAL_MODE;}
function paymentApplied(data,bowler,due){
  if(due<=0||!bowler.paid)return false;
  return data._paymentScopeVersion!==1||(bowler.paidSessionId===data._sessionId&&
    Number(bowler.paidChargeCents)===due);
}
function totalEntries(type) { return state.brackets[type].reduce((n,b)=>n+b.length,0); }
function assignedCount(type,id) { return state.brackets[type].reduce((n,b)=>n+b.filter(p=>p===id).length,0); }
function shuffle(a) { for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function drawPairKey(a,b) { return a==null||b==null?'':[a,b].sort().join('|'); }
function allFirstRoundPairings(ids) {
  if(!ids.length)return [[]];
  const [first,...rest]=ids,result=[];
  for(let i=0;i<rest.length;i++) {
    const second=rest[i],remaining=rest.filter((_,index)=>index!==i);
    for(const pairs of allFirstRoundPairings(remaining))result.push([[first,second],...pairs]);
  }
  return result;
}
function seedBracket(ids,matchups) {
  const choices=allFirstRoundPairings(ids),scores=choices.map(pairs=>({pairs,score:pairs.reduce((sum,[a,b])=>sum+(matchups.get(drawPairKey(a,b))||0),0)}));
  const best=Math.min(...scores.map(choice=>choice.score)),finalists=shuffle(scores.filter(choice=>choice.score===best));
  const pairs=shuffle(finalists[0].pairs.map(pair=>shuffle([...pair])));
  pairs.forEach(([a,b])=>{const key=drawPairKey(a,b);if(key)matchups.set(key,(matchups.get(key)||0)+1);});
  return pairs.flat();
}
function buildBrackets(bowlers,type) {
  const prop = type==='hdcp'?'hdcpCount':'scratchCount';
  const pool = bowlers.map(b=>({id:b.id,limit:Math.max(0,Math.floor(Number(b[prop])||0)),assigned:0}));
  const eligible=pool.filter(b=>b.limit>0).length;
  if(eligible<8) return [];
  const spots=8;
  const total = pool.reduce((n,b)=>n+b.limit,0);
  let low=0, high=Math.floor(total/spots);
  // A bowler can appear only once in each bracket. This condition gives the
  // maximum number of complete eight-bowler brackets possible under
  // everyone's limits. Incomplete brackets and byes are never generated.
  while(low<high) {
    const mid=Math.ceil((low+high)/2);
    if(pool.reduce((n,b)=>n+Math.min(b.limit,mid),0)>=spots*mid) low=mid;
    else high=mid-1;
  }
  const count=low, entries=count*spots;
  if(!count) return [];
  // Spread spots across bowlers first, then use the remaining capacity.
  for(let i=0;i<entries;i++) {
    const eligible=pool.filter(b=>b.assigned<Math.min(b.limit,count));
    const chosen=shuffle(eligible).sort((a,b)=>(a.assigned/Math.min(a.limit,count))-(b.assigned/Math.min(b.limit,count)))[0];
    chosen.assigned++;
  }
  // Place the largest assignments first. Prefer brackets containing bowlers
  // this bowler has shared the fewest previous groups with.
  const result=Array.from({length:count},()=>[]);
  const sharedGroups=new Map(),matchups=new Map();
  shuffle(pool).sort((a,b)=>b.assigned-a.assigned).forEach(b=>{
    for(let placement=0;placement<b.assigned;placement++) {
      const available=result.map((ids,index)=>({ids,index})).filter(slot=>slot.ids.length<spots&&!slot.ids.includes(b.id));
      const ranked=shuffle(available).sort((left,right)=>{
        const repeated=slot=>slot.ids.reduce((sum,id)=>sum+(sharedGroups.get(drawPairKey(b.id,id))||0),0);
        return repeated(left)-repeated(right)||left.ids.length-right.ids.length;
      });
      const chosen=ranked[0];
      if(!chosen)throw new Error('Unable to place every bracket entry.');
      chosen.ids.forEach(id=>{const key=drawPairKey(b.id,id);sharedGroups.set(key,(sharedGroups.get(key)||0)+1);});
      chosen.ids.push(b.id);
    }
  });
  // Among all 105 possible pairings in an eight-slot bracket, choose one that
  // produces the fewest repeated first-round opponent matchups.
  return result.map(ids=>seedBracket(ids,matchups));
}
function pairCount(data,id) { return data.pairs.filter(ids=>ids.includes(id)).length; }
function addTeamByNames(data,name1,name2) {
  const find=name=>data.bowlers.find(b=>b.name.toLocaleLowerCase()===name.trim().toLocaleLowerCase());
  const a=find(name1),b=find(name2);
  if(!a||!b) return 'not_registered';
  if(a.id===b.id) return 'same_bowler';
  if(data.pairs.some(ids=>ids.includes(a.id)&&ids.includes(b.id))) return 'duplicate_team';
  // Partner assignments determine the team count. Do not impose a
  // preselected maximum; Neon verifies both partners' confirmed buy-ins
  // before the draw or any score can be published.
  data.pairs.push([a.id,b.id]);a.pairs=true;b.pairs=true;data.pairsGenerated=true;
  return 'added';
}
// Staging-only convenience: never overwrite even one existing official score.
// Keep this pure so test generation is easy to verify without a database.
// Immediate manager guidance; Neon independently checks the PERSISTED setup
// and confirmed registrations before accepting the very first official score.
function preScoreChecklistLocal(data={}){
  const bowlers=Array.isArray(data.bowlers)?data.bowlers:[];
  const unique=items=>new Set(items.map(b=>String(b.id))).size;
  const counts={
    hdcp:unique(bowlers.filter(b=>Number(b.hdcpCount)>0)),
    scratch:unique(bowlers.filter(b=>Number(b.scratchCount)>0)),
    high:unique(bowlers.filter(b=>b.high===true))
  };
  const pairKeys=new Set((data.pairs||[]).filter(ids=>Array.isArray(ids)&&ids.length===2&&ids[0]!==ids[1])
    .map(ids=>ids.map(String).sort().join('|')));
  const roster=new Map(bowlers.map(b=>[String(b.id),b]));
  const drawn=type=>(data.brackets?.[type]||[]).some(ids=>
    Array.isArray(ids)&&ids.length===8&&new Set(ids.map(String)).size===8&&
    ids.every(id=>roster.has(String(id))&&Number(roster.get(String(id))?.[type+'Count'])>0));
  const checks=[
    {name:'Handicap brackets',tab:'brackets',entries:counts.hdcp,
      required:counts.hdcp>=8,done:!!data.generated&&drawn('hdcp')},
    {name:'Scratch brackets',tab:'brackets',entries:counts.scratch,
      required:counts.scratch>=8,done:!!data.generated&&drawn('scratch')},
    {name:'High Game',tab:'high-game',entries:counts.high,
      required:counts.high>=8,done:!!data.highGenerated},
    {name:'Virtual Doubles',tab:'pairs',entries:pairKeys.size,
      required:pairKeys.size>=8,done:!!data.pairsGenerated}
  ];
  const missing=checks.filter(x=>(x.required&&!x.done)||
    (['High Game','Virtual Doubles'].includes(x.name)&&x.entries>0&&!x.required));
  return {checks,missing,ready:checks.some(x=>x.required)&&!missing.length};
}
function buildStagingTestScores(data,random=Math.random) {
  if(!data || !Array.isArray(data.bowlers) || !data.brackets || !data._sessionId)
    throw new Error('Open a saved staging competition session first.');
  if(data.scoresLocked)throw new Error('Scores are locked. Test scores cannot replace official scores.');
  const checklist=preScoreChecklistLocal(data);
  if(!checklist.ready)
    throw new Error('Generate the brackets or competition event before creating test scores. '+
      (checklist.missing.length?'Missing: '+checklist.missing.map(item=>item.name).join(', ')+'.':
        'At least one event must meet its eight-bowler or eight-team minimum.'));
  const ids=new Set([
    ...(data.brackets.hdcp||[]).flat(),
    ...(data.brackets.scratch||[]).flat(),
    ...(data.pairs||[]).flat(),
    ...data.bowlers.filter(b=>b.high).map(b=>b.id)
  ].filter(Boolean));
  const participants=data.bowlers.filter(b=>ids.has(b.id));
  if(!participants.length)throw new Error('No participating bowlers are available for test scores.');
  const alreadyScored=participants.some(b=>['g1','g2','g3'].some(g=>
    b.scores?.[g]!==null && b.scores?.[g]!==undefined && b.scores?.[g]!==''));
  if(alreadyScored)throw new Error('One or more game scores already exist. Test scores will never overwrite them.');
  const score=()=>{
    const value=Number(random());
    if(!Number.isFinite(value)||value<0||value>1)throw new Error('Invalid test score generator.');
    return 135+Math.min(110,Math.floor(value*111));
  };
  const next={
    ...data,
    bowlers:data.bowlers.map(b=>ids.has(b.id)
      ?{...b,scores:{...b.scores,g1:score(),g2:score(),g3:score()}}
      :{...b})
  };
  return {state:next,participants:participants.length,games:participants.length*3};
}
function isStagingScoreTool() {
  return !!globalThis.MONSTER_PORTAL_MODE &&
    globalThis.location?.hostname==='brackets-clone.monsterproshop.workers.dev';
}
function complete(b) { return ['g1','g2','g3'].every(g=>b.scores[g]!==null && b.scores[g]!=='' && Number.isFinite(Number(b.scores[g]))); }
function hasGame(b,g) { return b.scores['g'+g]!==null && b.scores['g'+g]!=='' && Number.isFinite(Number(b.scores['g'+g])); }
function game(b,g,handicap=false) { return Number(b.scores['g'+g])+(handicap?Number(b.handicap):0); }
function series(b,handicap=false) { return [1,2,3].reduce((n,g)=>n+game(b,g,handicap),0); }
function bestGame(b,handicap=false) { return Math.max(...[1,2,3].map(g=>game(b,g,handicap))); }
function pairGame(team,g) { return team.reduce((n,b)=>n+game(b,g,true),0); }
function pairSeries(team) { return [1,2,3].reduce((n,g)=>n+pairGame(team,g),0); }
function pairBest(team) { return Math.max(...[1,2,3].map(g=>pairGame(team,g))); }
function pairedTeams(data) {
  const byId=new Map((data.bowlers||[]).map(b=>[b.id,b]));
  const seen=new Set();
  return (data.pairs||[]).filter(ids=>{
    if(!Array.isArray(ids)||ids.length!==2||ids[0]===ids[1]||!ids.every(id=>byId.has(id)))return false;
    const key=ids.map(String).sort().join('|');
    if(seen.has(key))return false;
    seen.add(key);return true;
  }).map(ids=>ids.map(id=>byId.get(id)));
}
const highTicketCount=b=>b.high?1:0; // High Game entry is Yes/No.
// High Game and Doubles awards round down in the competition's saved currency:
// MXN: 50-peso increments; USD: 5-dollar increments. Cents are integers.
const prizeIncrementCents=config=>config?.currency==='USD'?500:5000;
const floorPrize=(amount,config)=>Math.floor(Math.max(0,amount)/prizeIncrementCents(config))*prizeIncrementCents(config);
function highTicketAwards(players,purse,config) {
  if(!players.length||purse<=0)return [];
  const budgetPerGame=Math.floor(purse*90/100/3),awards=[];
  for(let g=1;g<=3;g++){
    const best=Math.max(...players.map(b=>game(b,g,true)));
    const winners=players.filter(b=>game(b,g,true)===best);
    const each=floorPrize(Math.floor(budgetPerGame/winners.length),config);
    for(const b of winners)if(each>0)awards.push({
      id:b.id,category:'high',
      description:'HDCP High Game Pot · Game '+g+' ('+best+')'+(winners.length>1?' tie':''),
      amount:each
    });
  }
  return awards;
}
function rankAwards(players,value,pool,percentages,description,category) {
  const sorted=[...players].sort((a,b)=>value(b)-value(a)||a.name.localeCompare(b.name));
  const awards=[];
  let rank=0;
  for(let i=0;i<sorted.length && rank<percentages.length;){
    const tied=sorted.filter(p=>value(p)===value(sorted[i]));
    const first=i, last=i+tied.length;
    const amount=percentages.slice(first,Math.min(last,percentages.length)).reduce((n,p)=>n+Math.round(pool*p/100),0);
    if(amount>0) {
      const share=Math.floor(amount/tied.length), remainder=amount%tied.length;
      tied.forEach((p,j)=>awards.push({id:p.id,category,description:description+' · '+(first+1)+(tied.length>1?' tie':'')+' ('+value(p)+')',amount:share+(j<remainder?1:0)}));
    }
    i=last;rank=i;
  }
  return awards;
}
function pairAwards(teams,metric,categoryBudget,percentages,description,config) {
  if(!teams.length||categoryBudget<=0)return [];
  const ranked=teams.map(team=>({team,score:metric(team),key:team.map(b=>String(b.id)).sort().join('|')}))
    .sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key));
  const awards=[];
  for(let start=0;start<ranked.length&&start<percentages.length;){
    let end=start+1;
    while(end<ranked.length&&ranked[end].score===ranked[start].score)end++;
    const hundredths=percentages.slice(start,Math.min(end,percentages.length)).reduce((n,p)=>n+Math.round(p*100),0);
    const perTeam=floorPrize(Math.floor(Math.floor(categoryBudget*hundredths/10000)/(end-start)),config);
    for(let i=start;i<end;i++){
      if(!perTeam)continue;
      const team=ranked[i].team,half=Math.floor(perTeam/2);
      team.forEach((b,j)=>awards.push({
        id:b.id,category:'pairs',
        description:description+' · '+(start+1)+(end-start>1?' tie':'')+
          ' · '+team.map(x=>x.name).join(' & ')+' ('+ranked[i].score+')',
        amount:half+(j===0?perTeam%2:0)
      }));
    }
    start=end;
  }
  return awards;
}
function bracketFinalists(ids,type,bowlers) {
  const byId=new Map(bowlers.map(b=>[b.id,b]));
  const players=ids.map(id=>id===null?null:byId.get(id));
  const hdcp=type==='hdcp';
  if(players.some((p,i)=>ids[i]!==null&&!p))return null;
  const winners=(group,g)=>{
    const active=group.filter(Boolean);
    if(active.length<=1)return active;
    if(active.some(p=>!hasGame(p,g)))return null;
    const max=Math.max(...active.map(p=>game(p,g,hdcp)));
    return active.filter(p=>game(p,g,hdcp)===max);
  };
  const round1=[0,2,4,6].map(i=>winners(players.slice(i,i+2),1));
  if(round1.some(result=>result===null))return null;
  const semi=[winners([...round1[0],...round1[1]],2),winners([...round1[2],...round1[3]],2)];
  if(semi.some(result=>result===null))return null;
  const finalists=[...semi[0],...semi[1]];
  if(finalists.length>1&&finalists.some(player=>!hasGame(player,3)))return null;
  return finalists;
}
function bracketFinalAwards(finalists,type,firstAmount,secondAmount,description) {
  const hdcp=type==='hdcp', games=[1,2,3];
  const metrics=player=>[
    game(player,3,hdcp),
    games.reduce((total,g)=>total+game(player,g,true),0),
    Math.max(...games.map(g=>game(player,g,true)))
  ];
  const ranked=finalists.map(player=>({player,metrics:metrics(player)})).sort((a,b)=>
    b.metrics[0]-a.metrics[0]||b.metrics[1]-a.metrics[1]||b.metrics[2]-a.metrics[2]||a.player.name.localeCompare(b.player.name));
  const places=[firstAmount,secondAmount],awards=[];
  for(let i=0;i<ranked.length&&i<places.length;){
    let end=i+1;
    while(end<ranked.length&&ranked[end].metrics.every((value,index)=>value===ranked[i].metrics[index]))end++;
    const pool=places.slice(i,Math.min(end,places.length)).reduce((total,amount)=>total+amount,0);
    if(pool){
      const share=Math.floor(pool/(end-i)),remainder=pool%(end-i),tie=end-i>1;
      for(let j=i;j<end;j++)awards.push({id:ranked[j].player.id,category:type,description:description+' · '+(i+1)+(tie?' tie':'')+' ('+ranked[j].metrics[0]+')',amount:share+(j-i<remainder?1:0)});
    }
    i=end;
  }
  return awards;
}
function bracketGraphic(ids,type,bowlers,index) {
  const byId=new Map(bowlers.map(b=>[b.id,b]));
  const entrants=ids.map(id=>id===null?null:byId.get(id)).filter((_,i)=>i<8);
  const hdcp=type==='hdcp';
  const outcome=(members,gameNumber,ready=true)=>{
    if(!ready) return {winners:[],decided:false};
    const active=members.filter(Boolean);
    if(active.length===1) return {winners:active,decided:true};
    if(!active.length||active.some(b=>b.scores['g'+gameNumber]===null)) return {winners:[],decided:false};
    const top=Math.max(...active.map(b=>game(b,gameNumber,hdcp)));
    return {winners:active.filter(b=>game(b,gameNumber,hdcp)===top),decided:true};
  };
  const first=Array.from({length:4},(_,i)=>outcome(entrants.slice(i*2,i*2+2),1));
  const second=Array.from({length:2},(_,i)=>outcome([...first[i*2].winners,...first[i*2+1].winners],2,first[i*2].decided&&first[i*2+1].decided));
  const final=outcome([...second[0].winners,...second[1].winners],3,second.every(x=>x.decided));
  if(final.decided&&final.winners.length>1&&final.winners.every(complete)){
    const seriesTop=Math.max(...final.winners.map(player=>series(player,true)));
    final.winners=final.winners.filter(player=>series(player,true)===seriesTop);
    if(final.winners.length>1){
      const gameTop=Math.max(...final.winners.map(player=>bestGame(player,true)));
      final.winners=final.winners.filter(player=>bestGame(player,true)===gameTop);
    }
  }
  const xs=[20,300,590,870], width=210, height=34;
  const ys1=Array.from({length:8},(_,i)=>70+i*54);
  const centers1=ys1.map(y=>y+height/2);
  const centers2=Array.from({length:4},(_,i)=>(centers1[i*2]+centers1[i*2+1])/2);
  const centers3=Array.from({length:2},(_,i)=>(centers2[i*2]+centers2[i*2+1])/2);
  const center4=(centers3[0]+centers3[1])/2;
  const line=(x1,y1,x2,y2)=>'<path d="M'+x1+' '+y1+' L'+x2+' '+y2+'" fill="none" stroke="#9b8254" stroke-width="2.5"/>';
  const links=(fromX,toX,centers)=>centers.reduce((out,y,i)=>{
    if(i%2)return out;
    const y2=centers[i+1], mid=(y+y2)/2, joint=fromX+27;
    return out+line(fromX,y,joint,y)+line(fromX,y2,joint,y2)+line(joint,y,joint,y2)+line(joint,mid,toX,mid);
  },'');
  // All medal gradients and highlights are embedded in the bracket SVG,
  // so downloaded images retain the metallic appearance when printed.
  const medalId='place-metal-'+type+'-'+index;
  const metal={gold:['#fff4ac','#d3a526','#825609'],silver:['#fff','#b5c1d2','#687585'],
    bronze:['#ffe2af','#bc7d3e','#74451e'],graphite:['#e6eaf0','#929ba6','#4d5866']};
  const medalDefs='<defs>'+Object.entries(metal).map(([name,stops])=>
    '<linearGradient id="'+medalId+'-'+name+'" x1="0" y1="0" x2="1" y2="1">'+
    stops.map((color,i)=>'<stop offset="'+(i*50)+'%" stop-color="'+color+'"/>').join('')+
    '</linearGradient>').join('')+'</defs>';
  const svgMedal=(place,x,y)=>{
    const tier=place===1?'gold':place===2?'silver':place===3?'bronze':'graphite';
    const edge=metal[tier][2],title=place===1?'1st':place===2?'2nd':place===3?'3rd':place+'th';
    return '<g class="svg-place-medal" role="img" aria-label="'+title+' place medal">'+
      '<title>'+title+' place medal</title>'+
      '<path d="M'+(x-8)+' '+(y-10)+' l-4 -8 6 2 6 6 6 -6 6 -2 -4 8" fill="#315d9e" stroke="#194475" stroke-width="1"/>'+
      '<circle cx="'+x+'" cy="'+y+'" r="14.5" fill="'+edge+'"/>'+
      '<circle cx="'+x+'" cy="'+y+'" r="12.5" fill="url(#'+medalId+'-'+tier+')" stroke="#fff9" stroke-width="1"/>'+
      '<path d="M'+(x-8)+' '+(y-4)+' q8 -10 16 -2" fill="none" stroke="#fff9" stroke-width="2.3" stroke-linecap="round"/>'+
      '<text x="'+x+'" y="'+(y+5)+'" text-anchor="middle" font-weight="900" font-size="15" fill="#1c2940" stroke="#fff7" stroke-width=".25" paint-order="stroke">'+place+'</text></g>';
  };
  const box=(x,y,people,g,result,placeholder='PENDING')=>{
    const one=people.filter(Boolean), bye=!one.length;
    const label=bye?placeholder:one.map(b=>b.name).join(' / ');
    const score=one.length===1&&one[0].scores['g'+g]!==null?'  '+game(one[0],g,hdcp):'';
    const shown=(label+score).length>27?(label+score).slice(0,26)+'…':label+score;
    const won=result.decided&&one.length>0&&one.every(b=>result.winners.some(w=>w.id===b.id));
    const lost=result.decided&&one.length>0&&one.every(b=>!result.winners.some(w=>w.id===b.id));
    const bg=bye?'#eeeae3':'#fffaf0';
    let mark='';
    if(won) mark='<ellipse cx="'+(x+width/2)+'" cy="'+(y+height/2)+'" rx="'+(width/2+5)+'" ry="'+(height/2+5)+'" fill="none" stroke="#1d67d6" stroke-width="3.5"/>';
    const champion=won&&x===xs[3]&&g===3&&Number(state.config[type+'FirstAmount'])>0;
    const finalistLoser=lost&&x===xs[2]&&g===3&&final.winners.length===1&&Number(state.config[type+'SecondAmount'])>0;
    if(lost&&!finalistLoser)mark='<path d="M'+(x+width-26)+' '+(y+8)+' l16 18 M'+(x+width-10)+' '+(y+8)+' l-16 18" fill="none" stroke="#c53038" stroke-width="4" stroke-linecap="round"/>';
    if(champion||finalistLoser)mark+=svgMedal(champion?1:2,x+width-17,y+height/2);
    return '<g><title>'+safe(label)+'</title><rect x="'+x+'" y="'+y+'" width="'+width+'" height="'+height+'" rx="8" fill="'+bg+'" stroke="#bdac8b"/><text x="'+(x+12)+'" y="'+(y+22)+'" font-size="14" font-weight="700" fill="'+(bye?'#777':'#17212e')+'">'+safe(shown)+'</text>'+mark+'</g>';
  };
  let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1110 550" role="img" aria-label="'+safe((hdcp?'Handicap':'Scratch')+' bracket '+(index+1))+'" class="bracket-svg">'+medalDefs+'<rect width="1110" height="550" fill="#fffdf9"/>';
  ['GAME 1','GAME 2 · SEMIFINAL','GAME 3 · FINAL','WINNER'].forEach((t,i)=>svg+='<text x="'+xs[i]+'" y="38" fill="#073a82" font-size="16" font-weight="800">'+t+'</text>');
  svg+=links(xs[0]+width,xs[1],centers1)+links(xs[1]+width,xs[2],centers2);
  svg+=line(xs[2]+width,centers3[0],xs[2]+width+27,centers3[0])+line(xs[2]+width,centers3[1],xs[2]+width+27,centers3[1])+line(xs[2]+width+27,centers3[0],xs[2]+width+27,centers3[1])+line(xs[2]+width+27,center4,xs[3],center4);
  entrants.forEach((p,i)=>svg+=box(xs[0],ys1[i],p?[p]:[],1,first[Math.floor(i/2)],'BYE'));
  first.forEach((r,i)=>svg+=box(xs[1],centers2[i]-height/2,r.winners,2,second[Math.floor(i/2)]));
  second.forEach((r,i)=>svg+=box(xs[2],centers3[i]-height/2,r.winners,3,final));
  svg+=box(xs[3],center4-height/2,final.winners,3,{winners:final.winners,decided:final.decided});
  svg+='<text x="20" y="530" fill="#596578" font-size="13">Blue circle = round winner   •   Gold 1 = champion   •   Silver 2 = finalist   •   Red X = eliminated'+(ids.includes(null)?'   •   BYE = automatic advance':'')+'</text></svg>';
  return svg;
}
function match(ids,gameNumber,handicap,bowlers) {
  const byId=new Map(bowlers.map(b=>[b.id,b]));
  const active=ids.filter(Boolean).map(id=>byId.get(id)).filter(Boolean);
  if(active.length<=1)return {winners:active,decided:true};
  if(active.some(b=>!hasGame(b,gameNumber)))return {winners:[],decided:false};
  const top=Math.max(...active.map(b=>game(b,gameNumber,handicap)));
  return {winners:active.filter(b=>game(b,gameNumber,handicap)===top),decided:true};
}
function calculate(state) {
  const c=state.config, bowlers=state.bowlers, awards=[], pending=[];
  if(!configured(c)) return {awards,pending:['Fix the payout amounts before calculating payouts.']};
  for(const type of ['hdcp','scratch']) {
    for(const [i,ids] of state.brackets[type].entries()) {
      const finalists=bracketFinalists(ids,type,bowlers);
      if(!finalists){pending.push(type+' bracket #'+(i+1)+' needs the next score only from bowlers still competing.');continue;}
      const payouts=[cents(c[type+'FirstAmount']),cents(c[type+'SecondAmount'])];
      awards.push(...bracketFinalAwards(finalists,type,payouts[0],payouts[1],(type==='hdcp'?'HDCP':'Scratch')+' bracket #'+(i+1)));
    }
  }
  const high=bowlers.filter(b=>b.high);
  if(high.length && high.every(complete)) {
    awards.push(...highTicketAwards(high,high.length*cents(c.highBuyin),c));
  } else if(high.length) pending.push('High Game Pot needs all three scores for every entrant.');
  const teams=pairedTeams(state);
  if(teams.length && teams.every(team=>team.every(complete))) {
    // Series-only awards: ignore obsolete saved per-game payout flags.
    const purse=teams.length*2*cents(c.pairsBuyin);
    awards.push(...pairAwards(teams,pairSeries,purse,c.pairsPlacePercentages,'Doubles series',c));
  } else if(teams.length) pending.push('Doubles needs all three scores for every team bowler.');
  return {awards,pending};
}
function reportSummary(data) {
  const c=data.config, result=calculate(data);
  const count=(type,id)=>(data.brackets[type]||[]).reduce((n,ids)=>n+ids.filter(x=>x===id).length,0);
  const rows=alphabetical(data.bowlers).map(b=>{
    const h=count('hdcp',b.id), s=count('scratch',b.id);
    const paired=pairedTeams(data).filter(team=>team.some(player=>player.id===b.id)).length;
    const highEntries=highTicketCount(b);
    const charges=[
      ...(h?[{category:'hdcp',label:h+' handicap bracket'+(h===1?'':'s')+' × '+competitionMoney(cents(c.hdcpBuyin),c),amount:h*cents(c.hdcpBuyin)}]:[]),
      ...(s?[{category:'scratch',label:s+' scratch bracket'+(s===1?'':'s')+' × '+competitionMoney(cents(c.scratchBuyin),c),amount:s*cents(c.scratchBuyin)}]:[]),
      ...(highEntries?[{category:'high',label:'Handicap High Game Pot × '+competitionMoney(cents(c.highBuyin),c),amount:highEntries*cents(c.highBuyin)}]:[]),
      ...(paired?[{category:'pairs',label:paired+' Doubles team'+(paired===1?'':'s')+' × '+competitionMoney(cents(c.pairsBuyin),c),amount:paired*cents(c.pairsBuyin)}]:[])
    ];
    const winnings=result.awards.filter(a=>a.id===b.id);
    const due=charges.reduce((n,x)=>n+x.amount,0), won=winnings.reduce((n,x)=>n+x.amount,0);
    const paid=paymentApplied(data,b,due), outstanding=paid?0:due;
    const eventNet=Object.fromEntries(['hdcp','scratch','high','pairs'].map(type=>[type,winnings.filter(x=>x.category===type).reduce((n,x)=>n+x.amount,0)-(paid?0:charges.filter(x=>x.category===type).reduce((n,x)=>n+x.amount,0))]));
    return {id:b.id,name:b.name,paid,charges,due,outstanding,winnings,won,eventNet,net:won-due,settlement:won-outstanding};
  });
  const collected=rows.reduce((n,r)=>n+r.due,0), received=rows.reduce((n,r)=>n+(r.paid?r.due:0),0), outstanding=collected-received, awarded=rows.reduce((n,r)=>n+r.won,0),settlement=rows.reduce((n,r)=>n+r.settlement,0);
  return {rows,collected,received,outstanding,awarded,net:awarded-collected,settlement,pending:result.pending};
}
function competitionSummary(data) {
  const report=reportSummary(data);
  return {handicapBrackets:(data.brackets?.hdcp||[]).length,scratchBrackets:(data.brackets?.scratch||[]).length,highGameEntries:(data.bowlers||[]).reduce((n,b)=>n+highTicketCount(b),0),doublesTeams:pairedTeams(data).length,totalIncome:report.collected,totalCharges:report.collected,paymentsReceived:report.received,outstandingBalances:report.outstanding,totalPayout:report.awarded,totalProfit:report.collected-report.awarded,settlementNow:report.settlement,currency:data.config.currency==='USD'?'USD':'MXN',payoutsPending:report.pending.length>0};
}
function competitionMoney(amount,config) {
  const symbol=String.fromCharCode(36);
  return (amount<0?'−':'')+(config?.currency==='USD'?'US':'MX')+symbol+(Math.abs(amount)/100).toFixed(2);
}
function summaryCards(summary) {
  const fmt=amount=>competitionMoney(amount,summary);
  const cards=[
    ['Handicap brackets played',summary.handicapBrackets],
    ['Scratch brackets played',summary.scratchBrackets],
    ['High Game entries',summary.highGameEntries],
    ['Doubles teams played',summary.doublesTeams],
    ['Total charges',fmt(summary.totalCharges)],
    ['Payments received',fmt(summary.paymentsReceived)],
    ['Outstanding balances',fmt(summary.outstandingBalances)],
    ['Total prizes awarded',fmt(summary.totalPayout)],
    ['Projected margin (all charges)',fmt(summary.totalProfit)]
  ];
  return cards.map(([label,value],index)=>
    '<div class="summary-metric '+(index===8?'profit':'')+'"><span>'+safe(label)+'</span><strong class="'+(index===8?balanceClass(summary.totalProfit):'')+'">'+safe(value)+'</strong></div>').join('');
}
function balanceText(amount) { return (amount<0?'−':amount>0?'+':'')+money(Math.abs(amount)); }
function balanceClass(amount) { return amount<0?'balance-negative':amount>0?'balance-positive':'balance-zero'; }
function summarizedWinnings(items) {
  const labels={hdcp:'Handicap brackets',scratch:'Scratch brackets',high:'High Game Pot',pairs:'Doubles'};
  return Object.entries(items.reduce((totals,item)=>({...totals,[item.category]:(totals[item.category]||0)+item.amount}),{}))
    .map(([category,amount])=>({label:labels[category]||category,amount}));
}
function status(message) { document.getElementById('status').textContent=message;translateUI(); }
function placeMedal(place){
  const n=Number(place);
  if(!Number.isSafeInteger(n)||n<1)return '';
  const metal=n===1?'gold':n===2?'silver':n===3?'bronze':'graphite';
  const label=(state.language==='es'?'Lugar ':'Place ')+n;
  return '<span class="place-medal place-medal-'+metal+'" role="img" aria-label="'+safe(label)+'" title="'+safe(label)+'"><span aria-hidden="true">'+n+'</span></span>';
}
function paidDoublesPlaces(teams,config){
  const purse=teams.length*2*cents(config.pairsBuyin),percentages=config.pairsPlacePercentages||[];
  const teamKey=team=>team.map(b=>String(b.id)).sort().join('|');
  const ranked=teams.map(team=>({team,score:pairSeries(team),key:teamKey(team)}))
    .sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key));
  const places=new Map();
  for(let start=0;start<ranked.length&&start<percentages.length;){
    let end=start+1;
    while(end<ranked.length&&ranked[end].score===ranked[start].score)end++;
    const parts=percentages.slice(start,Math.min(end,percentages.length))
      .reduce((total,p)=>total+Math.round(p*100),0);
    const amount=floorPrize(Math.floor(Math.floor(purse*parts/10000)/(end-start)),config);
    if(amount>0)for(let i=start;i<end;i++)places.set(ranked[i].key,start+1);
    start=end;
  }
  return places;
}
function marked(value,winner,place=0) { return winner?'<span class="winner-circle">'+value+'</span>'+(place?placeMedal(place):''):String(value); }
function renderHighGame() {
  const players=alphabetical(state.bowlers.filter(b=>b.high));
  if(!state.highGenerated) {
    document.getElementById('highNotice').innerHTML='<p class="hint">Select High Game during registration, then generate the standings.</p>';
    document.getElementById('highRows').innerHTML='';
    document.getElementById('highResult').innerHTML='';
    return;
  }
  const ready=[1,2,3].map(g=>players.length>0&&players.every(b=>hasGame(b,g)));
  const top=[1,2,3].map((g,i)=>ready[i]?Math.max(...players.map(b=>game(b,g,true))):null);
  const finished=players.length>0&&players.every(complete);
  // An 8-bowler High Game can qualify but still be too small to pay a full
  // currency increment. Explain this before scores are entered.
  const perGameBudget=Math.floor(players.length*cents(state.config.highBuyin)*90/100/3);
  const noPrizeAtThisPurse=players.length>0&&floorPrize(perGameBudget,state.config)===0;
  const currencyLabel=state.config.currency==='USD'?'USD':'MXN';
  const prizeStep=(currencyLabel==='USD'?'US$':'MX$')+(prizeIncrementCents(state.config)/100).toFixed(2)+' '+currencyLabel;
  const formattedBudget=(currencyLabel==='USD'?'US$':'MX$')+(perGameBudget/100).toFixed(2);
  const insufficientPrize=state.language==='es'
    ?'La bolsa actual asigna '+formattedBudget+' por juego, menos del incremento mínimo de '+prizeStep+'. Los premios de Línea Alta se redondearían a cero. Aumenta las inscripciones o el costo de entrada antes del evento.'
    :'The current purse budgets '+formattedBudget+' per game, below the '+prizeStep+' minimum payout increment. High Game prizes would round to zero. More entries or a higher buy-in are needed before the event.';
  document.getElementById('highNotice').innerHTML=
    (players.length?(!finished?'<p class="notice">Payout is pending until every entrant has all three scores.</p>':''):'<p class="notice">No bowlers registered for High Game Pot.</p>')+
    (noPrizeAtThisPurse?'<p class="notice">'+safe(insufficientPrize)+'</p>':'');
  const payouts=calculate(state).awards.filter(a=>a.category==='high');
  const paidGames=new Set(payouts.filter(a=>a.amount>0).map(a=>{
    const match=a.description.match(/Game (\d+)/);
    return match?String(a.id)+'|'+match[1]:'';
  }));
  document.getElementById('highRows').innerHTML=players.map(b=>'<tr><td>'+safe(b.name)+' (+'+b.handicap+')'+'</td>'+[1,2,3].map((g,i)=>'<td>'+(hasGame(b,g)?marked(game(b,g,true),ready[i]&&game(b,g,true)===top[i],paidGames.has(String(b.id)+'|'+g)?1:0):'—')+'</td>').join('')+'<td>'+(complete(b)?bestGame(b,true):'—')+'</td></tr>').join('')||'<tr><td colspan="5">No participants.</td></tr>';
  document.getElementById('highResult').innerHTML=finished?'<h3>High Game awards — 90% split across Games 1–3</h3><p>'+payouts.map(a=>safe(a.description)+' — '+safe(players.find(b=>b.id===a.id)?.name||'Unknown')+' '+money(a.amount)).join('<br>')+'</p>':'';
}
function alphabeticalTeams(teams){return alphabetical(teams.map((team,index)=>({team:alphabetical(team),index,name:alphabetical(team).map(b=>b.name).join(' & ')})));}
function renderPairs() {
  const interested=alphabetical(state.bowlers.filter(b=>b.pairs)), teams=pairedTeams(state);
  document.getElementById('registeredBowlers').innerHTML=alphabetical(state.bowlers).map(b=>'<option value="'+safe(b.name)+'"></option>').join('');
  const pairedIds=new Set(state.pairs.flat()), unmatched=interested.filter(b=>!pairedIds.has(b.id));
  document.getElementById('pairsNotice').innerHTML=unmatched.length?'<p class="notice">Registered for Doubles but not on a team, so not charged: '+safe(unmatched.map(b=>b.name).join(', '))+'.</p>':'';
  const finished=teams.length>0&&teams.every(t=>t.every(complete));
  const paidPlaces=finished&&configured(state.config)?paidDoublesPlaces(teams,state.config):new Map();
  const teamKey=team=>team.map(b=>String(b.id)).sort().join('|');
  // One compact row per distinct team: only the combined handicap games and
  // the combined series. Keep each bowler's official scores in state unchanged.
  const standings=alphabeticalTeams(teams);
  document.getElementById('pairsRows').innerHTML=standings.length
    ?'<div class="table-wrap"><table class="event-table"><thead><tr><th scope="col">Team</th><th scope="col">Game 1</th><th scope="col">Game 2</th><th scope="col">Game 3</th><th scope="col">Combined series</th><th scope="col" class="no-print">Actions</th></tr></thead><tbody>'+
      standings.map(({team,index:i})=>
        '<tr><th scope="row">#'+(i+1)+' · '+safe(team.map(b=>b.name).join(' & '))+'</th>'+
          [1,2,3].map(g=>'<td>'+(team.every(b=>hasGame(b,g))?pairGame(team,g):'—')+'</td>').join('')+
          '<td>'+(team.every(complete)?marked(pairSeries(team),paidPlaces.has(teamKey(team)),paidPlaces.get(teamKey(team))||0):'—')+'</td>'+
          '<td class="no-print"><button type="button" class="danger" data-remove-pair="'+i+'">Remove team</button></td></tr>'
      ).join('')+'</tbody></table></div>'
    :'<p class="hint">Add a team above to see its game results.</p>';
  const payouts=calculate(state).awards.filter(a=>a.category==='pairs');
  document.getElementById('pairsResult').innerHTML=finished?'<h3>Doubles results</h3><p>'+payouts.map(a=>{
    const match=a.description.match(/ · (\d+)(?: tie)? · /),place=match?Number(match[1]):0;
    return (a.amount>0?placeMedal(place)+' ':'')+safe(state.bowlers.find(b=>b.id===a.id)?.name||'Unknown')+' — '+safe(a.description)+' '+money(a.amount);
  }).join('<br>')+'</p>':teams.length?'<p class="hint">Payouts appear after every team bowler has all three scores.</p>':'';
}
function captureDoublesDraft() {
  if(doublesDraftPercentages===null)
    doublesDraftPercentages=[...state.config.pairsPlacePercentages];
  const holder=document.getElementById('pairsPlaceInputs');
  holder?.querySelectorAll?.('input[data-doubles-percent]')?.forEach(el=>{
    doublesDraftPercentages[Number(el.dataset.doublesPercent)]=el.value;
  });
}
function renderDoublesPlaces() {
  const holder=document.getElementById('pairsPlaceInputs');
  if(!holder)return;
  const input=document.getElementById('pairsPaidPlaces');
  const count=Number(input.value);
  if(holder.dataset?.placeCount===String(count)&&holder.dataset?.language===state.language)return;
  captureDoublesDraft();
  if(!Number.isSafeInteger(count)||count<1||count>20||!String(input.value).trim()){
    holder.innerHTML='<p class="hint">'+(state.language==='es'?'Elige entre 1 y 20 lugares premiados.':'Choose between 1 and 20 paid places.')+'</p>';
    if(holder.dataset)delete holder.dataset.placeCount;return;
  }
  const values=Array.from({length:count},(_,i)=>
    String(doublesDraftPercentages?.[i]??state.config.pairsPlacePercentages?.[i]??''));
  holder.innerHTML=values.map((value,i)=>'<label>'+(state.language==='es'?'Lugar ':'Place ')+(i+1)+(state.language==='es'?' (% de la bolsa total de Parejas)':' (% of total Doubles purse)')+
    '<input id="pairsPlacePercent_'+i+'" data-doubles-percent="'+i+'" type="number" min="0.01" max="100" step="0.01" value="'+safe(value)+'"></label>').join('');
  if(holder.dataset){
    holder.dataset.placeCount=String(count);
    holder.dataset.language=state.language;
  }
}
function render() {
  const isPortal=portalSignupOnly();
  // Unsaved draws have no official charges, even when the local bracket preview
  // can already calculate potential amounts. Never offer payment or scoring yet.
  const pendingDraw=isPortal&&state.generated&&!globalThis.MonsterPortal?.bracketsVerified?.(state);
  document.getElementById('legacyBowlerRegistrationCard').classList.toggle('hidden',isPortal);
  document.getElementById('modernRosterGuidance').classList.toggle('hidden',!isPortal);
  const currentReport=reportSummary(state);
  const dueByBowler=new Map(currentReport.rows.map(row=>[String(row.id),row]));
  CONFIG_IDS.forEach(id=>{
    const el=document.getElementById(id);
    if(id==='pairsPaidPlaces'){
      el.value=doublesDraftCount!==null?doublesDraftCount:state.config[id];return;
    }
    if(el.type==='checkbox')el.checked=!!state.config[id];
    else if(document.activeElement!==el)el.value=state.config[id];
  });
  renderDoublesPlaces();
  const currency=state.config.currency==='USD'?'USD':'MXN';
  for(const [id,en,es] of [
    ['hdcpBuyin','Buy-in','Inscripción'],['scratchBuyin','Buy-in','Inscripción'],
    ['highBuyin','Buy-in','Inscripción'],['pairsBuyin','Buy-in per team entry, per bowler','Inscripción por equipo, por jugador'],
    ['hdcpFirstAmount','1st place fixed','1.er lugar fijo'],['scratchFirstAmount','1st place fixed','1.er lugar fijo'],
    ['hdcpSecondAmount','2nd place fixed','2.º lugar fijo'],['scratchSecondAmount','2nd place fixed','2.º lugar fijo']
  ]) {
    const label=document.getElementById(id)?.closest?.('label');
    if(label?.firstChild?.nodeType===3)label.firstChild.textContent=(state.language==='es'?es:en)+' ('+currency+')';
  }
  const highEntries=state.bowlers.reduce((total,b)=>total+highTicketCount(b),0);
  const projectedEntries=Math.max(8,highEntries);
  const highPurse=projectedEntries*cents(state.config.highBuyin);
  const perGame=Math.floor(highPurse*90/100/3);
  const rounded=floorPrize(perGame,state.config);
  const moneyLabel=amount=>(currency==='USD'?'US$':'MX$')+(amount/100).toFixed(2);
  document.getElementById('payoutPreview').textContent=state.language==='es'
    ?'Vista previa de Línea Alta ('+projectedEntries+' inscripciones; '+(highEntries<8?'ejemplo con ocho participantes':'inscripciones actuales')+'): bolsa '+moneyLabel(highPurse)+', presupuesto por juego '+moneyLabel(perGame)+', premio sin empate '+moneyLabel(rounded)+'. Los empates pueden reducir el premio individual.'
    :'High Game payout preview ('+projectedEntries+' entries; '+(highEntries<8?'eight-entry illustration':'current registration count')+'): purse '+moneyLabel(highPurse)+', per-game budget '+moneyLabel(perGame)+', untied prize '+moneyLabel(rounded)+'. Ties may reduce each winner\'s prize.';
  const zeroAtEight=floorPrize(Math.floor(8*cents(state.config.highBuyin)*90/100/3),state.config)===0;
  document.getElementById('zeroPrizeAcknowledgmentWrap').classList.toggle('hidden',!zeroAtEight);
  document.getElementById('zeroPrizeAcknowledgmentText').textContent=state.language==='es'
    ?'Entiendo que con ocho participantes de Línea Alta, el premio por juego se redondearía a cero. Más participantes pueden cambiar el premio.'
    :'I understand that with eight High Game entrants, each game prize rounds down to zero. More entrants may change the prize.';
  const rounding=state.config.currency==='USD'?'$5 USD':'$50 MXN';
  document.getElementById('highRoundingHint').textContent=state.language==='es'
    ?'El 90% de la bolsa de Línea Alta se divide en tres premios, uno por juego. Cada ganador recibe un múltiplo de '+rounding+' redondeado hacia abajo; los empates dividen el premio antes del redondeo.'
    :'90% of the High Game purse is split into three game prizes. Each winner gets a multiple of '+rounding+', rounded down; tied winners split the game prize before rounding.';
  document.getElementById('doublesRoundingHint').textContent=state.language==='es'
    ?'Los premios de Parejas se redondean hacia abajo a múltiplos de '+rounding+' por equipo, antes de dividirlos entre sus dos jugadores. Los porcentajes deben sumar como máximo 100%.'
    :'Doubles team prizes round DOWN to multiples of '+rounding+' per team before being split between partners. Percentages must total no more than 100%.';
  document.getElementById('language').value=state.language;
  document.getElementById('rosterRows').innerHTML=alphabetical(state.bowlers).map(b=>{
    const invoice=dueByBowler.get(String(b.id)),due=invoice?.due||0;
    const payment=pendingDraw&&due>0
      ?'<span class="hint">Save brackets before payment</span>'
      :(!isPortal||due>0)
        ?'<label class="paid-toggle"><input type="checkbox" data-paid="'+safe(b.id)+'" '+(invoice?.paid?'checked':'')+'> Paid</label>'
        :'<span class="hint">No current charge</span>';
    const actions=isPortal?'<span class="hint">Use Session Sign-Up</span>':
      '<button class="secondary" data-edit="'+safe(b.id)+'">Edit</button> <button class="danger" data-remove="'+safe(b.id)+'">Remove</button>';
    return '<tr><td>'+safe(b.name)+(b.membershipNumber?'<br><small>ID: '+safe(b.membershipNumber)+'</small>':'')+(b.email?'<br><small>'+safe(b.email)+'</small>':'')+'</td><td>'+b.handicap+'</td><td>'+b.hdcpCount+'</td><td>'+b.scratchCount+'</td><td>'+(b.high?'Yes':'No')+'</td><td>'+pairCount(state,b.id)+'</td><td>'+payment+'</td><td>'+actions+'</td></tr>';
  }).join('') || '<tr><td colspan="8">No bowlers have entry charges or winnings for this session.</td></tr>';
  for(const type of ['hdcp','scratch']) {
    document.getElementById(type+'Brackets').innerHTML=state.brackets[type].map((ids,i)=>'<div class="bracket"><div class="bracket-head"><strong>'+(type==='hdcp'?'Handicap':'Scratch')+' bracket #'+(i+1)+'</strong><button class="secondary no-print" data-download="'+type+':'+i+'">Download SVG image</button></div><div class="bracket-scroll">'+bracketGraphic(ids,type,state.bowlers,i)+'</div></div>').join('') || '<p class="hint">No brackets generated. At least eight different bowlers must select this event.</p>';
  }
  const unused=alphabetical(state.bowlers).flatMap(b=>['hdcp','scratch'].map(t=>{const n=b[t+'Count']-assignedCount(t,b.id);return n>0?b.name+': '+n+' unused '+t+' '+(n===1?'spot':'spots'):null;})).filter(Boolean);
  document.getElementById('bracketNotice').innerHTML=state.generated&&unused.length?'<p class="notice">Willingness above the available full brackets: '+safe(unused.join(' · '))+'</p>':'';
  const scoringIds=new Set([...state.brackets.hdcp.flat(),...state.brackets.scratch.flat(),...state.pairs.flat()].filter(Boolean)),scoringBowlers=state.bowlers.filter(b=>scoringIds.has(b.id)||b.high);
  document.getElementById('scoreRows').innerHTML=alphabetical(scoringBowlers).map(b=>'<tr><td>'+safe(b.name)+' (+'+b.handicap+')</td>'+[1,2,3].map(g=>'<td><input aria-label="'+safe(b.name)+' game '+g+'" data-score="'+safe(b.id)+'" data-game="g'+g+'" type="number" min="0" max="300" step="1" value="'+(b.scores['g'+g]??'')+'"></td>').join('')+'<td>'+(complete(b)?series(b):'—')+'</td><td>'+(complete(b)?series(b,true):'—')+'</td></tr>').join('')||'<tr><td colspan="6">No event participants.</td></tr>';
  const checklist=preScoreChecklistLocal(state);
  const alreadyScored=state.bowlers.some(b=>Object.entries(b.scores||{}).some(([k,v])=>
    /^g[1-3]$/.test(k)&&v!==null&&v!==undefined&&v!==''));
  const mustPrepare=pendingDraw||(!alreadyScored&&!checklist.ready);
  const tasks=checklist.checks.filter(c=>c.required||c.entries>0);
  const underMinimum=tasks.filter(c=>!c.required);
  const spanish=state.language==='es';
  const names={hdcp:spanish?'Brackets con hándicap':'Handicap brackets',
    scratch:spanish?'Brackets scratch':'Scratch brackets',
    high:spanish?'Línea Alta':'High Game',
    pairs:spanish?'Parejas Virtuales':'Virtual Doubles'};
  const displayName=c=>names[{brackets:'hdcp','high-game':'high',pairs:'pairs'}[c.tab]]&&c.tab!=='brackets'
    ?names[{brackets:'hdcp','high-game':'high',pairs:'pairs'}[c.tab]]
    :c.name==='Handicap brackets'?names.hdcp:c.name==='Scratch brackets'?names.scratch:c.name;
  const helpButton=c=>'<button type="button" class="secondary" data-readiness-tab="'+c.tab+'">'+
    (spanish?'Abrir ':'Open ')+safe(displayName(c))+'</button>';
  document.getElementById('scoreReadiness').innerHTML=pendingDraw
    ?'<p class="notice"><strong>'+(spanish?'Brackets sin guardar.':'Brackets not saved.')+'</strong> '+(spanish?'Guarda y verifica los brackets en Neon antes de capturar puntuaciones o pagos. Las puntuaciones pendientes se conservan en este equipo.':'Click Save Brackets and verify the draw in Neon before entering scores or recording payments. Existing unsaved scores are preserved on this device.')+'</p>'
    :mustPrepare
      ?'<p class="notice"><strong>'+(spanish?'Antes del primer juego — prepara los eventos:':'Before first score — prepare your events:')+'</strong> '+
      (spanish?'Todos los eventos clasificados deben generarse y guardarse en Neon antes de registrar puntuaciones. Se requieren 8 jugadores o 8 parejas distintas.':
        'All qualifying events must be generated and saved in Neon first. Only events with 8 bowlers (or 8 distinct Doubles teams) qualify.')+'</p>'+
      '<ul>'+tasks.map(c=>'<li>'+safe(displayName(c))+' ('+c.entries+'): '+
        (c.required?(c.done?(spanish?'Preparado — verifica que esté guardado en Neon':'Prepared — verify saved in Neon'):
          (spanish?'PENDIENTE — generar o verificar':'NOT READY — generate or verify')):
          (spanish?'No alcanza el mínimo — no clasifica':'Below minimum — does not qualify'))+
        (c.required&&!c.done?' '+helpButton(c):'')+'</li>').join('')+'</ul>'+
      (checklist.checks.some(c=>c.required)?'':'<p>'+(spanish?'Por lo menos un evento debe clasificar. Revisa las inscripciones.':
        'At least one event must qualify. Review the Session Sign-Up registrations.')+'</p>')+
      '<button type="button" class="secondary" data-readiness-tab="session-signup">'+
        (spanish?'Revisar inscripciones de la sesión':'Review Session Sign-Up')+'</button>'
    :(!alreadyScored?'<p class="hint">'+(spanish?
        'Eventos preparados. Confirma que estén guardados en Neon antes del primer juego oficial.':
        'Events prepared. Confirm they are saved in Neon before the first official score.')+'</p>'+
      (underMinimum.length?'<p class="notice">'+
        (spanish?'Aviso: estos eventos tienen inscripciones, pero no alcanzan el mínimo y no deben generar premios: ':
          'Warning: these events have entries but are below the minimum and must not produce payouts: ')+
        underMinimum.map(c=>safe(displayName(c))).join(', ')+'.</p>':''):'');
  document.querySelectorAll('[data-score]').forEach(input=>input.disabled=!!state.scoresLocked||mustPrepare);
  document.getElementById('lockScores').classList.toggle('hidden',!!state.scoresLocked);
  document.getElementById('editScores').classList.toggle('hidden',!state.scoresLocked);
  document.getElementById('generate').disabled=!!state.scoresLocked;
  document.getElementById('scoreLockStatus').textContent=state.scoresLocked?'Scores are locked. Use Edit Scores to make a correction.':'Scores save automatically. Upload Scores checks that all entered scores reached the database.';
  for(const id of ['saveScores','uploadScoresBottom','lockScores'])document.getElementById(id).disabled=mustPrepare;
  document.getElementById('scorePairsRows').innerHTML=alphabeticalTeams(pairedTeams(state)).map(({team,index:i})=>'<tr><td>Team #'+(i+1)+' — '+safe(team.map(b=>b.name).join(' & '))+'</td>'+[1,2,3].map(g=>'<td>'+(team.every(b=>hasGame(b,g))?pairGame(team,g):'—')+'</td>').join('')+'<td>'+(team.every(complete)?pairBest(team):'—')+'</td><td>'+(team.every(complete)?pairSeries(team):'—')+'</td></tr>').join('')||'<tr><td colspan="6">No Doubles teams added yet.</td></tr>';
  renderHighGame();
  renderPairs();
  const report=currentReport;
  const notes=[
    ...(pendingDraw?['Bracket draw is not saved in Neon. Charges and payouts shown here are provisional until Save Brackets is verified.']:[]),
    ...(!state.generated&&state.bowlers.some(b=>b.hdcpCount||b.scratchCount)?['Generate brackets to determine actual bracket charges.']:[]),
    ...(state.generated&&unused.length?['Unused bracket willingness is not charged: '+unused.join(' · ')]:[]),
    ...(state.bowlers.some(b=>b.pairs&&!state.pairs.flat().includes(b.id))?['Doubles bowlers without a team are not charged.']:[]),
    ...report.pending
  ];
  document.getElementById('reportNotice').innerHTML=notes.length?'<p class="notice">'+safe(notes.join(' · '))+(report.pending.length?' Balances may change when pending results are entered.':'')+'</p>':'';
  const moneyReport=amount=>competitionMoney(amount,state.config);
  const balanceReport=amount=>(amount<0?'−':amount>0?'+':'')+moneyReport(Math.abs(amount));
  const list=(items,label,showAmount=true)=>items.length?'<ul class="breakdown">'+items.map(x=>'<li>'+safe(x.label||x.description)+(showAmount?' <span class="detail-amount">'+moneyReport(x.amount)+'</span>':'')+'</li>').join('')+'</ul>':'<span class="hint">'+label+'</span>';
  document.getElementById('reportRows').innerHTML=report.rows.filter(r=>r.due>0||r.won>0).map(r=>'<tr><th scope="row" class="report-bowler">'+safe(r.name)+'</th><td>'+list(r.charges,'No entries',false)+'</td><td class="money">'+moneyReport(r.due)+'</td><td>'+(r.paid?'Yes':'No')+'</td><td class="money '+(r.outstanding>0?'balance-negative':'balance-zero')+'">'+moneyReport(r.outstanding)+'</td><td>'+list(summarizedWinnings(r.winnings),'No winnings')+'</td><td class="money">'+moneyReport(r.won)+'</td>'+['hdcp','scratch','high','pairs'].map(t=>'<td class="money '+balanceClass(r.eventNet[t])+'">'+balanceReport(r.eventNet[t])+'</td>').join('')+'<td class="money '+balanceClass(r.settlement)+'">'+balanceReport(r.settlement)+'</td></tr>').join('')||'<tr><td colspan="12">No bowlers registered yet.</td></tr>';
  document.getElementById('reportTotals').innerHTML='<div>Total charges<strong>'+moneyReport(report.collected)+'</strong></div><div>Charges marked paid<strong>'+moneyReport(report.received)+'</strong></div><div>Outstanding<strong>'+moneyReport(report.outstanding)+'</strong></div><div>Total winnings<strong>'+moneyReport(report.awarded)+'</strong></div><div>Net settlement with bowlers<strong class="'+balanceClass(report.settlement)+'">'+balanceReport(report.settlement)+'</strong><small>Positive = payable to bowlers; negative = collectible from bowlers. Not tournament profit.</small></div>';
  const summary=competitionSummary(state);
  document.getElementById('competitionSummaryCards').innerHTML=summaryCards(summary);
  const warning=document.getElementById('competitionFinanceNotice');
  if(warning)warning.textContent=summary.totalProfit<0
    ?'Prize commitments exceed all entry charges by '+moneyReport(-summary.totalProfit)+'. Review bracket fixed prizes and entry costs. This projected margin assumes all entry charges are collected and does not represent cash received.'
    :summary.payoutsPending
      ?'Prize calculations are pending complete scores. Projected margin may change as results are finalized.'
      :'Projected margin is based on all entry charges, including unpaid balances; payments received are tracked separately.';
  translateUI();
}
function resetForm() {
  editingId=null;document.getElementById('bowlerForm').reset();document.getElementById('handicap').value=0;document.getElementById('membershipNumber').value='';
  document.getElementById('hdcpCount').value=1;document.getElementById('scratchCount').value=1;
  document.getElementById('saveBowler').textContent='Add bowler';document.getElementById('cancelEdit').classList.add('hidden');toggleCounts();
}
function toggleCounts() {
  for(const t of ['Hdcp','Scratch']) {
    const on=document.getElementById('join'+t).checked;
    document.getElementById(t.toLowerCase()+'CountWrap').classList.toggle('hidden',!on);
    document.getElementById(t.toLowerCase()+'Count').required=on;
  }
}
function backupPackage(data) {
  return {format:'monster-bowling-backup',version:3,exportedAt:new Date().toISOString(),competition:data};
}
function validBackup(packageData) {
  const data=packageData?.competition;
  if(packageData?.format!=='monster-bowling-backup'||!data?.config||!configured(data.config)||!Array.isArray(data.bowlers)||!Array.isArray(data.pairs)||!Array.isArray(data.brackets?.hdcp)||!Array.isArray(data.brackets?.scratch)) return false;
  const ids=new Set();
  for(const b of data.bowlers) {
    if(typeof b.id!=='string'||typeof b.name!=='string'||!b.name.trim()||ids.has(b.id)||!Number.isInteger(b.handicap)||b.handicap<0||b.handicap>300||!b.scores) return false;
    if(!['g1','g2','g3'].every(g=>b.scores[g]===null||(Number.isInteger(b.scores[g])&&b.scores[g]>=0&&b.scores[g]<=300))) return false;
    ids.add(b.id);
  }
  return [...data.brackets.hdcp,...data.brackets.scratch].every(bracket=>Array.isArray(bracket)&&bracket.length===8&&bracket.every(id=>id===null||ids.has(id)))&&
    data.pairs.every(pair=>Array.isArray(pair)&&pair.length===2&&pair[0]!==pair[1]&&pair.every(id=>ids.has(id)));
}
async function downloadBackup(forceDownload=false) {
  const json=JSON.stringify(backupPackage(state),null,2),name='monster-bowling-backup-'+new Date().toISOString().slice(0,10)+'.json';
  if(window.showSaveFilePicker&&!forceDownload) {
    const handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'JSON backup',accept:{'application/json':['.json']}}]});
    const writer=await handle.createWritable();await writer.write(json);await writer.close();
    return true;
  }
  const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  return false;
}
async function printPayoutsSummary() {
  const report=reportSummary(state),sheet=document.getElementById('payoutPrintSheet');
  const text=value=>safe(translateText(value)),competition=document.getElementById('currentCompetition')?.textContent.trim()||translateText('Competition');
  const reasons=items=>items.length?items.map(item=>text(item.label)).join('<br>'):'—';
  const winnings=items=>{const rows=summarizedWinnings(items);return rows.length?rows.map(item=>text(item.label)+' '+money(item.amount)).join('<br>'):'—';};
  const rows=report.rows.filter(row=>row.due>0||row.won>0).map(row=>'<tr><td><strong>'+safe(row.name)+'</strong></td><td>'+reasons(row.charges)+'</td><td class="money">'+money(row.due)+'</td><td>'+text(row.paid?'Yes':'No')+'</td><td class="money">'+money(row.outstanding)+'</td><td>'+winnings(row.winnings)+'</td><td class="money '+balanceClass(row.settlement)+'">'+balanceText(row.settlement)+'</td></tr>').join('');
  const printed=new Intl.DateTimeFormat(state.language==='es'?'es-MX':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date());
  sheet.innerHTML='<div class="print-brand"><img class="print-badge" src="assets/app-icon.svg" alt="ProDrillOS championship badge"><img class="print-main-logo" src="assets/brackets-logo.png?v=20260922" alt="Brackets by ProDrillOS"><div class="print-title"><h1>'+text('Payout Summary')+'</h1><p><strong>'+safe(competition)+'</strong></p><p>'+text('Printed')+': '+safe(printed)+'</p></div></div><table class="print-payout-table"><thead><tr><th>'+text('Bowler')+'</th><th>'+text('Why they pay')+'</th><th class="money">'+text('Total due')+'</th><th>'+text('Paid')+'</th><th class="money">'+text('Outstanding')+'</th><th>'+text('Winnings')+'</th><th class="money">'+text('Settle now')+'</th></tr></thead><tbody>'+(rows||'<tr><td colspan="7">'+text('No bowlers registered yet.')+'</td></tr>')+'</tbody></table><div class="print-payout-totals"><div>'+text('Total charges')+'<strong>'+money(report.collected)+'</strong></div><div>'+text('Charges marked paid')+'<strong>'+money(report.received)+'</strong></div><div>'+text('Outstanding')+'<strong>'+money(report.outstanding)+'</strong></div><div>'+text('Total winnings')+'<strong>'+money(report.awarded)+'</strong></div><div>'+text('Total to settle now')+'<strong class="'+balanceClass(report.settlement)+'">'+balanceText(report.settlement)+'</strong></div></div>'+(report.pending.length?'<p class="print-pending">'+report.pending.map(text).join(' · ')+'</p>':'')+'<footer class="print-footer">Brackets by ProDrillOS · brackets.prodrillos.com</footer>';
  await Promise.all([...sheet.querySelectorAll('img')].map(image=>image.complete?image.decode?.().catch(()=>{}):new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});})));
  if(document.fonts?.ready)await document.fonts.ready;
  const cleanup=()=>document.body.classList.remove('print-payouts');
  document.body.classList.add('print-payouts');
  window.addEventListener('afterprint',cleanup,{once:true});
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  window.print();
  setTimeout(cleanup,60000);
}
let highPayoutTermsChanged=false;
function setup() {
  document.getElementById('language').addEventListener('change',e=>{state.language=e.target.value==='es'?'es':'en';try{localStorage.setItem(LANGUAGE_KEY,state.language);}catch{}persist();render();});
  document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===btn));
    document.querySelectorAll('.panel').forEach(x=>x.classList.toggle('active',x.id===btn.dataset.tab));render();
  }));
  // The number of paid Doubles places is edited as an unsaved draft.
  // Validating against the PREVIOUS percentage array here would reset a
  // newly selected count back to one before the manager could fill it.
  CONFIG_IDS.filter(id=>id!=='pairsPaidPlaces').forEach(id=>document.getElementById(id).addEventListener('change',e=>{
    const value=id==='currency'?e.target.value:e.target.type==='checkbox'?e.target.checked:num(e.target.value,NaN);
    const candidate={...state.config,[id]:value};
    if((e.target.type!=='checkbox'&&!e.target.value)||!configured(candidate)){status('Check the buy-ins and fixed payout amounts.');if(e.target.type==='checkbox')e.target.checked=state.config[id];else e.target.value=state.config[id];return;}
    if((id==='highBuyin'||id==='currency')&&value!==state.config[id])highPayoutTermsChanged=true;
    state.config=candidate;render();
    document.getElementById('configSaveState').textContent='Changes not saved yet.';
    status('Configuration changed. Select Save payout configuration to keep it.');
  }));
  document.getElementById('saveConfig').addEventListener('click',async()=>{
    const candidate={...state.config};
    for(const id of CONFIG_IDS) {
      const el=document.getElementById(id);
      candidate[id]=id==='currency'?el.value:el.type==='checkbox'?el.checked:num(el.value,NaN);
    }
    candidate.pairsPlacePercentages=Array.from({length:Math.max(0,Math.min(20,candidate.pairsPaidPlaces||0))},
      (_,i)=>Number(document.getElementById('pairsPlacePercent_'+i)?.value));
    const saveState=document.getElementById('configSaveState');
    if(!configured(candidate)){saveState.textContent='Enter a positive percentage for every paid Doubles place; the total cannot exceed 100%.';status('Check the payout configuration.');return;}
    const zeroAtEight=floorPrize(Math.floor(8*cents(candidate.highBuyin)*90/100/3),candidate)===0;
    if(zeroAtEight&&highPayoutTermsChanged&&!document.getElementById('zeroPrizeAcknowledgment').checked){
      saveState.textContent=state.language==='es'?'Confirma el riesgo de premio cero antes de guardar.':'Acknowledge the zero-prize risk before saving.';
      status('High Game payout needs manager acknowledgment.');return;
    }
    saveState.textContent='Saving…';
    try {
      if(globalThis.MONSTER_PORTAL_MODE) await globalThis.MonsterPortal.saveConfiguration(candidate);
      state.config=candidate;
      if(!globalThis.MONSTER_PORTAL_MODE)localStorage.setItem(KEY,JSON.stringify(state));
      doublesDraftPercentages=null;
      doublesDraftCount=null;
      highPayoutTermsChanged=false;
      document.getElementById('zeroPrizeAcknowledgment').checked=false;
      saveState.textContent=globalThis.MONSTER_PORTAL_MODE?'Saved to Neon.':'Payout configuration saved locally.';
      status('Payout configuration saved.');
    } catch(error) {
      saveState.textContent='Could not save. '+(error.message||'Try again.');status('Payout configuration was not saved.');
    }
  });
  document.getElementById('pairsPaidPlaces').addEventListener('input',event=>{
    doublesDraftCount=event.target.value;
    renderDoublesPlaces();
  });
  document.getElementById('pairsPaidPlaces').addEventListener('change',renderDoublesPlaces);
  ['Hdcp','Scratch'].forEach(t=>document.getElementById('join'+t).addEventListener('change',toggleCounts));
  document.getElementById('bowlerForm').addEventListener('submit',e=>{
    e.preventDefault();
    if(portalSignupOnly()){status('Use Session Sign-Up for digital or admin-assisted registration and approved maximum buy-ins.');return;}
    const name=document.getElementById('name').value.trim(),email=document.getElementById('bowlerEmail').value.trim().toLowerCase(),handicap=Number(document.getElementById('handicap').value),profile=window.MonsterPortal?.profileForName?.(name),membershipNumber=document.getElementById('membershipNumber').value.trim()||profile?.membership_number||'';
    const hdcpCount=document.getElementById('joinHdcp').checked?Number(document.getElementById('hdcpCount').value):0;
    const scratchCount=document.getElementById('joinScratch').checked?Number(document.getElementById('scratchCount').value):0;
    if(!name || !Number.isInteger(handicap)||handicap<0||handicap>300||![hdcpCount,scratchCount].every(n=>Number.isInteger(n)&&n>=0)||
      (document.getElementById('joinHdcp').checked&&hdcpCount<1)||(document.getElementById('joinScratch').checked&&scratchCount<1)){status('Check the name, handicap and bracket counts.');return;}
    if(!editingId && state.bowlers.some(b=>b.name.toLowerCase()===name.toLowerCase())){status('A bowler with that name is already registered.');return;}
    if(editingId && state.bowlers.some(b=>b.id!==editingId&&b.name.toLowerCase()===name.toLowerCase())){status('A bowler with that name is already registered.');return;}
    const prior=state.bowlers.find(b=>b.id===editingId);
    const onTeam=editingId&&pairCount(state,editingId)>0;
    if(email&&state.bowlers.some(b=>b.id!==editingId&&b.email===email)){status('That login email is already linked to another bowler.');return;}
    const bowler={id:editingId||profile?.id||String(Date.now())+Math.random().toString(36).slice(2),membershipNumber,name,email:email||profile?.email||'',handicap,hdcpCount,scratchCount,high:document.getElementById('joinHigh').checked,highEntries:document.getElementById('joinHigh').checked?1:0,pairs:document.getElementById('joinPairs').checked||!!onTeam,scores:prior?.scores||blankScores(),paid:prior?.paid||false};
    if(prior) state.bowlers[state.bowlers.indexOf(prior)]=bowler;else state.bowlers.push(bowler);
    // Registration changes invalidate the bracket draw; manually added teams keep their member IDs.
    state.brackets={hdcp:[],scratch:[]};state.generated=false;
    persist();resetForm();render();status('Bowler saved. Generate brackets again after roster changes.');
  });
  document.getElementById('cancelEdit').addEventListener('click',resetForm);
  document.getElementById('rosterRows').addEventListener('click',e=>{
    const edit=e.target.closest('[data-edit]'),remove=e.target.closest('[data-remove]'),paid=e.target.closest('[data-paid]');
    if(portalSignupOnly()&&(edit||remove)){
      status('Session registrations must be managed through Session Sign-Up; use Permanent roster for identity corrections.');return;
    }
    if(paid){
      const b=state.bowlers.find(x=>x.id===paid.dataset.paid);if(!b)return;
      const row=reportSummary(state).rows.find(r=>r.id===b.id);
      if(portalSignupOnly()&&(!row||row.due<=0||(state.generated&&!globalThis.MonsterPortal?.bracketsVerified?.(state)))){
        status('No current session charge exists for this bowler. Review confirmed entries in Session Sign-Up first.');render();return;
      }
      const previous={paid:!!b.paid,paidSessionId:b.paidSessionId,paidChargeCents:b.paidChargeCents};
      b.paid=paid.checked;
      b.paidSessionId=paid.checked?state._sessionId:null;
      b.paidChargeCents=paid.checked?row?.due:null;
      render();status('Saving payment status…');
      void (async()=>{try{if(globalThis.MONSTER_PORTAL_MODE)await globalThis.MonsterPortal.savePayment(b.id,b.paid);else localStorage.setItem(KEY,JSON.stringify(state));status(b.name+(b.paid?' marked paid. Full winnings are now payable.':' marked unpaid. Entry charges will be deducted from winnings.'));}catch(error){Object.assign(b,previous);render();status('Payment status was not saved: '+(error.message||'Try again.'));}})();return;}
    if(edit){const b=state.bowlers.find(x=>x.id===edit.dataset.edit);if(!b)return;editingId=b.id;document.getElementById('name').value=b.name;document.getElementById('membershipNumber').value=b.membershipNumber||'';document.getElementById('bowlerEmail').value=b.email||'';document.getElementById('handicap').value=b.handicap;document.getElementById('joinHdcp').checked=b.hdcpCount>0;document.getElementById('joinScratch').checked=b.scratchCount>0;document.getElementById('joinHigh').checked=b.high;document.getElementById('joinPairs').checked=b.pairs;document.getElementById('hdcpCount').value=b.hdcpCount||1;document.getElementById('scratchCount').value=b.scratchCount||1;document.getElementById('saveBowler').textContent='Save changes';document.getElementById('cancelEdit').classList.remove('hidden');toggleCounts();document.getElementById('name').focus();}
    if(remove){const b=state.bowlers.find(x=>x.id===remove.dataset.remove);if(!b||!confirm('Remove '+b.name+' and their Doubles teams?'))return;state.bowlers=state.bowlers.filter(x=>x.id!==b.id);state.brackets={hdcp:[],scratch:[]};state.generated=false;state.pairs=state.pairs.filter(ids=>!ids.includes(b.id));persist();render();status('Bowler and their Doubles teams removed. Generate brackets again.');}
  });
  document.getElementById('generate').addEventListener('click',()=>{
    state.brackets={hdcp:buildBrackets(state.bowlers,'hdcp'),scratch:buildBrackets(state.bowlers,'scratch')};state.generated=state.brackets.hdcp.length+state.brackets.scratch.length>0;
    // Portal draws must be explicitly saved and verified BEFORE enabling scores
    // or payment. Nonportal standalone editing retains its previous autosave.
    if(portalSignupOnly()){state._replaceBracketDraw=true;globalThis.MonsterPortal?.preserveBracketDraft?.(state);}
    else {state._replaceBracketDraw=true;persist();delete state._replaceBracketDraw;}
    render();
    const total=state.brackets.hdcp.length+state.brackets.scratch.length;
    status(total?(portalSignupOnly()?'Generated '+total+' bracket'+(total===1?'':'s')+' locally. Click Save Brackets to verify them in Neon before recording scores or payments.':total+' bracket'+(total===1?'':'s')+' generated with new pairings.'):'No brackets generated. At least eight different bowlers must join an event.');
  });
  const saveSection=async(section)=>{
    const brackets=section==='brackets',button=document.getElementById(brackets?'saveBrackets':'saveScores'),saveState=document.getElementById(brackets?'bracketSaveState':'scoreSaveState');
    button.disabled=true;saveState.textContent=brackets?'Saving brackets…':'Saving scores…';status(saveState.textContent);
    try {
      // Save Brackets stages only the draw. Do not autosave unsaved game scores
      // before the backend has accepted the first bracket draw.
      if(!globalThis.MONSTER_PORTAL_MODE)persist();
      if(globalThis.MONSTER_PORTAL_MODE)await globalThis.MonsterPortal.saveNow(section);
      else localStorage.setItem(KEY,JSON.stringify(state));
      saveState.textContent=brackets?'Brackets saved and verified in Neon.':'Scores saved and verified in Neon.';status(saveState.textContent);
    } catch(error) {
      const prefix=brackets?'The brackets were not saved.':'The scores were not saved.';
      saveState.textContent=prefix+' '+(error.message||'Try again.');status(saveState.textContent);
    } finally {button.disabled=false;translateUI();}
  };
  document.getElementById('saveBrackets').addEventListener('click',()=>void saveSection('brackets'));
  document.getElementById('scoreReadiness').addEventListener('click',e=>{
    const button=e.target.closest('[data-readiness-tab]');if(!button)return;
    document.querySelector('[data-tab="'+button.dataset.readinessTab+'"]')?.click();
  });
  document.getElementById('saveScores').addEventListener('click',()=>void saveSection('scores'));
  document.getElementById('uploadScoresBottom').addEventListener('click',()=>void saveSection('scores'));
  // Manager-only screen + exact staging hostname. Deliberately unavailable
  // on production, in standalone/local mode, and to bowler accounts.
  const scoreTestButton=document.getElementById('generateTestScores');
  scoreTestButton.classList.toggle('hidden',!isStagingScoreTool());
  scoreTestButton.addEventListener('click',async()=>{
    if(!isStagingScoreTool()||!globalThis.MonsterPortal?.saveNow){
      status('Test score generation is available only to staging managers.');
      return;
    }
    const message=document.getElementById('scoreSaveState');
    let preview;
    try{preview=buildStagingTestScores(state);}
    catch(error){message.textContent=error.message;status(error.message);return;}
    const question=state.language==='es'
      ?'¿Generar puntuaciones aleatorias de prueba para '+preview.participants+' jugadores ('+preview.games+' juegos) y guardarlas en Neon? Úsalo solamente en sesiones de prueba. No se reemplazará ninguna puntuación existente.'
      :'Generate random TEST scores for all '+preview.participants+' participating bowlers ('+preview.games+' games) and save them to Neon? Only use this in a disposable staging session. Existing scores will not be overwritten.';
    if(!confirm(question))return;
    scoreTestButton.disabled=true;
    try{
      // Resolve pending manager edits before creating a fresh snapshot.
      await globalThis.MonsterPortal.flush();
      // Check consent and team eligibility against the saved nightly ledger
      // before generating any scores. This must fail closed on API errors.
      await globalThis.MonsterPortal.checkNightlyScoreReadiness();
      const filled=buildStagingTestScores(state);
      state=filled.state;render();
      message.textContent='Saving test scores to Neon…';status(message.textContent);
      await globalThis.MonsterPortal.saveNow('scores');
      message.textContent=state.language==='es'?'Se generaron '+filled.games+' puntuaciones de prueba y se verificaron en Neon.':'Generated '+filled.games+' test game scores and verified them in Neon.';
      status(message.textContent);
    }catch(error){
      message.textContent='Test scores could not be verified in Neon. Do not start a new session. '+(error.message||'');
      status(message.textContent);
    }finally{scoreTestButton.disabled=false;translateUI();}
  });
  for(const [id,locked] of [['lockScores',true],['editScores',false]])document.getElementById(id).addEventListener('click',async()=>{
    const button=document.getElementById(id);button.disabled=true;
    try{if(globalThis.MONSTER_PORTAL_MODE)await globalThis.MonsterPortal.setScoresLocked(locked);else{state.scoresLocked=locked;persist();render();}}
    catch(error){document.getElementById('scoreLockStatus').textContent=error.message;status(error.message);}
    finally{button.disabled=false;}
  });
  document.getElementById('generateHigh').addEventListener('click',()=>{state.highGenerated=true;persist();render();status('High Game standings updated.');});
  const pairMessage=(id)=>{
    const input=document.getElementById('pairName'+id),help=document.getElementById('pairHelp'+id),value=input.value.trim().toLocaleLowerCase();
    help.textContent=value&&!state.bowlers.some(b=>b.name.toLocaleLowerCase().startsWith(value))?'Please register bowler.':'';
    translateUI();
  };
  [1,2].forEach(i=>{
    document.getElementById('pairName'+i).addEventListener('input',()=>pairMessage(i));
    document.getElementById('pairName'+i).addEventListener('blur',e=>{
      const value=e.target.value.trim();
      if(value&&!state.bowlers.some(b=>b.name.toLocaleLowerCase()===value.toLocaleLowerCase())){document.getElementById('pairHelp'+i).textContent='Please register bowler.';translateUI();}
    });
  });
  document.getElementById('addPairForm').addEventListener('submit',e=>{
    e.preventDefault();
    const result=addTeamByNames(state,document.getElementById('pairName1').value,document.getElementById('pairName2').value);
    if(result==='not_registered'){
      [1,2].forEach(i=>{
        const value=document.getElementById('pairName'+i).value.trim().toLocaleLowerCase();
        document.getElementById('pairHelp'+i).textContent=state.bowlers.some(b=>b.name.toLocaleLowerCase()===value)?'':'Please register bowler.';
      });
      status('Please register bowler.');return;
    }
    if(result==='same_bowler'){status('A Doubles team needs two different bowlers.');return;}
    if(result==='duplicate_team'){status('This Doubles team is already registered.');return;}
    persist();e.target.reset();document.getElementById('pairHelp1').textContent='';document.getElementById('pairHelp2').textContent='';render();status('Doubles team added. Both partners must review and confirm their updated team counts and buy-ins in Session Sign-Up before scoring.');
  });
  document.getElementById('pairsRows').addEventListener('click',e=>{
    const button=e.target.closest('[data-remove-pair]');if(!button)return;
    const index=Number(button.dataset.removePair),ids=state.pairs[index];
    if(!ids||!confirm('Remove this Doubles team?'))return;
    state.pairs.splice(index,1);persist();render();status('Doubles team removed.');
  });
  document.getElementById('brackets').addEventListener('click',e=>{
    const button=e.target.closest('[data-download]');if(!button)return;
    const svg=button.closest('.bracket').querySelector('svg');
    const file=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml;charset=utf-8'});
    const link=document.createElement('a');link.href=URL.createObjectURL(file);
    link.download='monster-bowling-'+button.dataset.download.replace(':','-')+'.svg';link.click();
    setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  });
  document.getElementById('scoreRows').addEventListener('change',e=>{
    const id=e.target.dataset.score;if(!id||state.scoresLocked)return;const b=state.bowlers.find(x=>x.id===id);if(!b)return;
    const raw=e.target.value;
    if(raw!==''&&(!Number.isInteger(Number(raw))||Number(raw)<0||Number(raw)>300)){status('Enter a whole game score from 0 to 300.');render();return;}
    b.scores[e.target.dataset.game]=raw===''?null:Number(raw);persist();render();status(globalThis.MONSTER_PORTAL_MODE?'Saving score…':'Score saved.');
  });
  document.getElementById('printPayouts').addEventListener('click',()=>void printPayoutsSummary().catch(error=>status(error.message||'Could not prepare the payout printout.')));
  document.getElementById('saveSession').addEventListener('click',async()=>{
    if(globalThis.MONSTER_PORTAL_MODE){
      const button=document.getElementById('saveSession'),saveState=document.getElementById('sessionSaveState');
      button.disabled=true;button.textContent='Downloading backup…';saveState.textContent='Preparing a local JSON backup…';status('Preparing a local session backup…');
      try{await globalThis.MonsterPortal?.saveSession();saveState.textContent='Local session backup downloaded. The active database session was not changed.';}
      catch(error){const message=error.message||'Could not download the local backup.';saveState.textContent=message;status(message);}
      finally{button.disabled=false;button.textContent='Download local backup';translateUI();}
      return;
    }
    try{await downloadBackup(true);status('Session backup downloaded.');}catch{status('Backup was not saved. Competition data was kept.');}
  });
  document.getElementById('startFresh').addEventListener('click',async()=>{
    const archiveLabel=document.getElementById('sessionLabel').value.trim();
    const archiveDate=document.getElementById('sessionDate').value;
    const prompt='Start a new session? The completed session, including scores, bracket draws, payments and winnings, will be archived in Neon before the next session begins. Your roster and handicaps stay in place. If the database archive fails, the current session will not be reset.';
    const archiveDetails=archiveLabel?'\n\nArchive the COMPLETED session as: '+archiveLabel+
      (archiveDate?' ('+archiveDate+')':''):archiveDate?'\n\nArchive date: '+archiveDate:'';
    if(!confirm((state.language==='es'?translateText(prompt):prompt)+archiveDetails))return;
    const button=document.getElementById('startFresh'),saveState=document.getElementById('sessionSaveState');button.disabled=true;saveState.textContent='Starting a new session…';
    try {
      if(globalThis.MONSTER_PORTAL_MODE)await globalThis.MonsterPortal?.startFresh({archiveLabel,archiveDate});
      else {const config={...state.config},language=state.language;state=fresh();state.config=config;state.language=language;persist();render();document.querySelector('[data-tab="registration"]').click();}
      saveState.textContent='A new session is ready with the roster and handicaps preserved.';
    } catch(error){const message=error.message||'Could not start a new session.';saveState.textContent=message;status(message);}
    finally{button.disabled=false;translateUI();}
  });
  document.getElementById('restoreBackup').addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try {
      const packageData=JSON.parse(await file.text());
      if(!validBackup(packageData)){status('This is not a valid Monster Bowling backup.');return;}
      if(!confirm('Replace the current competition with this backup?'))return;
      if(globalThis.MONSTER_PORTAL_MODE){state=packageData.competition;persist();}
      else {localStorage.setItem(KEY,JSON.stringify(packageData.competition));state=load();}
      resetForm();document.getElementById('addPairForm').reset();render();status('Backup restored.');
    } catch { status('Could not read the JSON backup.'); }
    finally { e.target.value=''; }
  });
  toggleCounts();render();
}
function matchupSummary(data) {
  const names=Object.fromEntries(data.bowlers.map(b=>[b.id,b.name]));
  const rounds=[new Map(),new Map(),new Map()];
  const add=(round,a,b)=>{if(!a||!b)return;for(const [x,y] of [[a,b],[b,a]]){if(!rounds[round].has(x))rounds[round].set(x,[]);rounds[round].get(x).push(names[y]);}};
  for(const type of ['hdcp','scratch']) for(const ids of data.brackets[type]||[]) {
    for(let i=0;i<8;i+=2)add(0,ids[i],ids[i+1]);
    const first=[];for(let i=0;i<8;i+=2){const r=match([ids[i],ids[i+1]],1,type==='hdcp',data.bowlers);first.push(r.winners.length===1?r.winners[0].id:null);}
    add(1,first[0],first[1]);add(1,first[2],first[3]);
    const second=[match(first.slice(0,2),2,type==='hdcp',data.bowlers),match(first.slice(2,4),2,type==='hdcp',data.bowlers)].map(r=>r.winners.length===1?r.winners[0].id:null);add(2,second[0],second[1]);
  }
  return rounds.map(map=>[...map].map(([id,opponents])=>({id,name:names[id],opponents})).sort((a,b)=>a.name.localeCompare(b.name)));
}
if(typeof window!=='undefined') window.BowlingApp={
  fresh,alphabetical,
  setState(data){
    if(!data||!Array.isArray(data.bowlers)||!data.config) throw new Error('Invalid competition data');
    const language=state.language;state={...fresh(),...data,language,config:{...DEFAULT_CONFIG,...data.config}};
    doublesDraftPercentages=null;
    doublesDraftCount=null;
    const holder=typeof document!=='undefined'?document.getElementById('pairsPlaceInputs'):null;
    if(holder){
      holder.innerHTML='';
      delete holder.dataset.placeCount;
    }
    resetForm();render();
  },
  getState(){return structuredClone(state);},
  refresh(){render();},
  setSessionId(value){state._sessionId=value;delete state._startNewSession;delete state._replaceBracketDraw;},
  setServerRevision(value){state._serverUpdatedAt=value;},
  exportBackup:downloadBackup,
  bracketGraphic,
  snapshot(data=state){
    const report=reportSummary(data),awards=calculate(data).awards;
    const names=Object.fromEntries(data.bowlers.map(b=>[b.id,b.name]));
    const publicData={
      updatedAt:new Date().toISOString(),
      bowlers:data.bowlers.map(({id,name,handicap,scores,high,highEntries})=>({id,name,handicap,scores,high,highEntries:high?highTicketCount({high,highEntries}):0})),
      brackets:data.brackets,
      pairs:data.pairs,
      awards:awards.map(({id,category,description,amount})=>({name:names[id]||'Bowler',category,description,amount})),
      pending:report.pending,
      matchups:matchupSummary(data),
      standings:[1,2,3].map(g=>data.bowlers.filter(b=>hasGame(b,g)).map(b=>({name:b.name,score:game(b,g,true)})).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)))
      ,summary:competitionSummary(data)
    };
    const personal=data.bowlers.filter(b=>b.email).map(b=>({
      email:b.email.trim().toLowerCase(),
      data:report.rows.find(r=>r.id===b.id)
    }));
    return {publicData,personal};
  },
  translateUI,
  translateText,
  language:()=>state.language
};
if(typeof document!=='undefined') setup();
if(typeof module!=='undefined') module.exports={alphabetical,fresh,buildBrackets,addTeamByNames,pairCount,bracketGraphic,match,matchupSummary,calculate,reportSummary,competitionSummary,backupPackage,validBackup,rankAwards,configured,complete,assignedCount,buildStagingTestScores,highTicketAwards,highTicketCount,pairedTeams,placeMedal,paidDoublesPlaces};
