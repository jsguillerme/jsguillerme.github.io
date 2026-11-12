import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const fail = (message: string, status = 400) => json({ error: message }, status);
const randomToken = () => { const bytes = crypto.getRandomValues(new Uint8Array(32)); return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join(''); };
async function hash(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function deranged<T>(input: T[]): T[] {
  const values = [...input];
  for (let i = values.length - 1; i > 0; i--) {
    // Sattolo shuffle produces one cycle, so no participant remains in place.
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % i;
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return fail('Método não permitido.', 405);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return fail('A função ainda não foi configurada pelo administrador.', 503);
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return fail('Corpo JSON inválido.'); }

  if (body.action === 'create') {
    const roomName = typeof body.room_name === 'string' ? body.room_name.trim() : '';
    const names = Array.isArray(body.participants) ? body.participants.map((name) => typeof name === 'string' ? name.trim() : '') : [];
    if (roomName.length < 1 || roomName.length > 80) return fail('O nome da sala deve ter entre 1 e 80 caracteres.');
    if (names.length < 3 || names.length > 100 || names.some((name) => !name || name.length > 80)) return fail('Informe de 3 a 100 nomes válidos.');
    if (new Set(names.map((name) => name.toLocaleLowerCase())).size !== names.length) return fail('Os nomes precisam ser únicos.');
    const { data: room, error: roomError } = await db.from('secret_rooms').insert({ name: roomName }).select('id').single();
    if (roomError || !room) return fail('Não foi possível criar a sala. Verifique se executou schema.sql.', 500);
    const participants = names.map((name) => ({ name, token: randomToken(), id: crypto.randomUUID() }));
    const recipients = deranged(participants);
    // Hashes are computed before insertion; the browser receives only the raw individual invite tokens.
    const rows = await Promise.all(participants.map(async (person, i) => ({
      id: person.id,
      room_id: room.id,
      name: person.name,
      invite_token_hash: await hash(person.token),
      assigned_to: recipients[i].id,
    })));
    const { error: participantError } = await db.from('secret_participants').insert(rows);
    if (participantError) { await db.from('secret_rooms').delete().eq('id', room.id); return fail('Não foi possível salvar os participantes. Tente novamente.', 500); }
    return json({ room_id: room.id, invites: participants.map(({ name, token }) => ({ name, token })) }, 201);
  }

  if (body.action === 'reveal') {
    const token = typeof body.invite_token === 'string' ? body.invite_token : '';
    if (!/^[a-f0-9]{64}$/.test(token)) return fail('Convite inválido.', 404);
    const { data: participant, error } = await db.from('secret_participants').select('id,assigned_to').eq('invite_token_hash', await hash(token)).maybeSingle();
    if (error || !participant) return fail('Convite inválido ou removido.', 404);
    const { data: assignment, error: assignmentError } = await db.from('secret_participants').select('name').eq('id', participant.assigned_to).single();
    if (assignmentError || !assignment) return fail('O sorteio desta sala ainda não está disponível.', 409);
    await db.from('secret_participants').update({ revealed_at: new Date().toISOString() }).eq('id', participant.id);
    return json({ recipient: assignment.name });
  }
  return fail('Ação desconhecida.');
});
