(() => {
  const $ = (s) => document.querySelector(s);
  const CONFIG_KEY = 'entre-lacos-supabase-config';
  const ROOMS_KEY = 'entre-lacos-managed-rooms-v2';
  const savedConfig = load(CONFIG_KEY, null);
  const config = savedConfig?.url && savedConfig?.key ? savedConfig : {
    url: window.ENTRE_LACOS_SUPABASE?.url || '',
    key: window.ENTRE_LACOS_SUPABASE?.anonKey || '',
  };
  let rooms = load(ROOMS_KEY, []);
  let toastTimer;
  const inviteToken = new URLSearchParams(location.search).get('invite');

  function load(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } }
  function persistRooms() { localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800); }
  function clientReady() { return !!(config?.url && config?.key); }
  async function api(body) {
    if (!clientReady()) throw new Error('Configure a conexão com o Supabase antes de continuar.');
    let response;
    try { response = await fetch(`${config.url.replace(/\/$/, '')}/functions/v1/secret-room`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.key, Authorization: `Bearer ${config.key}` }, body: JSON.stringify(body) }); }
    catch { throw new Error('Não foi possível conectar ao Supabase. Confira a URL e sua conexão.'); }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'O Supabase não conseguiu concluir esta operação.');
    return result;
  }
  function showError(target, message) { target.textContent = message; target.classList.remove('hidden'); }
  function renderRooms() {
    $('#room-count').textContent = rooms.length;
    $('#room-list').innerHTML = rooms.map((room, i) => `<button class="room-item ${i === 0 ? 'active' : ''}" data-index="${i}"><span><span class="room-icon">✳</span>${esc(room.name)}</span><span class="room-status">${room.invites.length} pessoas</span></button>`).join('');
    if (rooms.length) openRoom(0);
  }
  function openRoom(index) {
    const room = rooms[index]; if (!room) return;
    document.querySelectorAll('.room-item').forEach((el, i) => el.classList.toggle('active', i === index));
    $('#empty-state').classList.add('hidden'); $('#room-content').classList.remove('hidden');
    $('#room-title').textContent = room.name; $('#room-subtitle').textContent = 'Sala criada. Compartilhe os convites em particular.';
    $('#participant-count').textContent = `${room.invites.length} pessoas`;
    $('#invite-list').innerHTML = room.invites.map((person) => {
      const link = new URL('./', location.href); link.searchParams.set('invite', person.token);
      return `<div class="invite-row"><span class="person-label"><span class="avatar">${esc(person.name.charAt(0).toUpperCase())}</span><span><strong>${esc(person.name)}</strong><small>Convite pessoal</small></span></span><button class="copy-invite" data-link="${esc(link.href)}">Copiar convite</button></div>`;
    }).join('');
    $('#copy-room-link').onclick = () => copyText(location.origin + location.pathname, 'Link da aplicação copiado. Envie também o convite pessoal de cada pessoa.');
  }
  async function copyText(text, message) { try { await navigator.clipboard.writeText(text); toast(message); } catch { window.prompt('Copie o link:', text); } }
  $('#room-list').addEventListener('click', (event) => { const button = event.target.closest('[data-index]'); if (button) openRoom(Number(button.dataset.index)); });
  $('#invite-list').addEventListener('click', (event) => { const button = event.target.closest('[data-link]'); if (button) copyText(button.dataset.link, 'Convite copiado. Envie-o somente para essa pessoa.'); });
  function openCreate() {
    if (!clientReady()) { $('#settings-dialog').showModal(); return; }
    $('#create-error').classList.add('hidden'); $('#create-form').reset(); $('#create-dialog').showModal();
  }
  $('#create-room').addEventListener('click', openCreate); $('#empty-create').addEventListener('click', openCreate);
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
  $('#settings-button').addEventListener('click', () => {
    $('#settings-error').classList.add('hidden'); if (config) { $('#supabase-url').value = config.url; $('#supabase-key').value = config.key; }
    $('#settings-dialog').showModal();
  });
  $('#settings-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const url = $('#supabase-url').value.trim().replace(/\/$/, ''); const key = $('#supabase-key').value.trim();
    if (!/^https:\/\/[\w.-]+\.supabase\.co$/.test(url) || !key) return showError($('#settings-error'), 'Informe uma Project URL válida e uma chave pública.');
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ url, key })); location.reload();
  });
  $('#create-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const names = $('#new-room-people').value.split('\n').map((n) => n.trim()).filter(Boolean); const name = $('#new-room-name').value.trim();
    const normalized = names.map((n) => n.toLocaleLowerCase('pt-BR'));
    if (names.length < 3) return showError($('#create-error'), 'Adicione pelo menos 3 participantes.');
    if (new Set(normalized).size !== names.length) return showError($('#create-error'), 'Há nomes repetidos. Cada participante precisa ter um nome único.');
    const submit = $('#create-submit'); submit.disabled = true; submit.textContent = 'Criando o sorteio…'; $('#create-error').classList.add('hidden');
    try {
      const created = await api({ action: 'create', room_name: name, participants: names });
      const room = { name, room_id: created.room_id, invites: created.invites };
      rooms.unshift(room); persistRooms(); $('#create-dialog').close(); $('#empty-state').classList.add('hidden'); renderRooms(); toast('Sala criada! Envie cada convite em particular.');
    } catch (error) { showError($('#create-error'), error.message); }
    finally { submit.disabled = false; submit.textContent = 'Criar e sortear'; }
  });

  async function initInvite() {
    document.querySelector('.page-shell').classList.add('hidden'); $('#reveal-view').classList.remove('hidden');
    if (!inviteToken) { $('#reveal-loading').classList.add('hidden'); $('#reveal-error').classList.remove('hidden'); return; }
    $('#reveal-button').addEventListener('click', async () => {
      const button = $('#reveal-button'); button.disabled = true; button.textContent = 'Abrindo seu segredo…';
      try { const result = await api({ action: 'reveal', invite_token: inviteToken }); $('#recipient-name').textContent = result.recipient; $('#reveal-loading').classList.add('hidden'); $('#reveal-result').classList.remove('hidden'); }
      catch (error) { $('#reveal-loading').classList.add('hidden'); $('#reveal-error').classList.remove('hidden'); $('#reveal-error-message').textContent = error.message; }
    });
  }
  if (inviteToken) initInvite();
  else { $('#setup-hint').classList.toggle('hidden', clientReady()); if (clientReady()) $('#panel-subtitle')?.classList.add('hidden'); renderRooms(); }
})();
