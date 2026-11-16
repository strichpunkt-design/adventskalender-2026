// Shared wall storage. Uses Supabase when config.js has the anon key, otherwise this browser only.
const cfg = window.SP_CONFIG || {};
export const isShared = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
const uuid = () => crypto.randomUUID ? crypto.randomUUID() : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
const token = localStorage.sp_token || (localStorage.sp_token = uuid());
const mine = new Set(JSON.parse(localStorage.sp_mine || '[]'));
const subs = new Map();
const local = () => JSON.parse(localStorage.sp_wall || '[]');
const notify = door => (subs.get(door) || []).forEach(cb => cb());
export const isMine = id => mine.has(id);

let sb;
async function client() {
  if (!sb) {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  }
  return sb;
}

export async function list(door) {
  if (!isShared) return local().filter(p => p.door === door);
  const c = await client();
  const { data, error } = await c.from('posts').select('id,door,name,kind,body,url,image,created_at').eq('door', door).order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  return data;
}

// How many posts each door has (votes not counted).
export async function counts() {
  let rows = local();
  if (isShared) { const c = await client(); const { data, error } = await c.from('posts').select('door,kind').limit(5000); if (error) throw error; rows = data; }
  const out = {};
  for (const r of rows) if (r.kind !== 'vote' && r.kind !== 'open') out[r.door] = (out[r.door] || 0) + 1;
  return out;
}

// Who opened which door today: { door: [names] }.
export async function presence() {
  const since = new Date(); since.setHours(0, 0, 0, 0);
  let rows;
  if (!isShared) rows = local().filter(p => p.kind === 'open' && new Date(p.created_at) >= since);
  else {
    const c = await client();
    const { data, error } = await c.from('posts').select('door,name').eq('kind', 'open').gte('created_at', since.toISOString()).limit(2000);
    if (error) throw error; rows = data;
  }
  const out = {};
  for (const r of rows) { const l = out[r.door] || (out[r.door] = []); if (!l.includes(r.name)) l.push(r.name); }
  return out;
}

export async function add(door, { kind = 'text', body = '', url = '', image = null }) {
  const name = (localStorage.sp_name || 'Anonym').slice(0, 24);
  const id = uuid();
  if (!isShared) {
    localStorage.sp_wall = JSON.stringify([{ id, door, name, kind, body, url, image, created_at: new Date().toISOString() }, ...local()]);
  } else {
    const c = await client();
    let img = null;
    if (image) {
      const blob = await (await fetch(image)).blob();
      const path = `${door}/${id}.jpg`;
      const up = await c.storage.from('wall').upload(path, blob, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      img = c.storage.from('wall').getPublicUrl(path).data.publicUrl;
    }
    const { error } = await c.from('posts').insert({ id, door, name, kind, body, url, image: img, token });
    if (error) throw error;
  }
  mine.add(id);
  localStorage.sp_mine = JSON.stringify([...mine]);
  notify(door);
  return id;
}

export async function remove(door, id) {
  if (!isShared) localStorage.sp_wall = JSON.stringify(local().filter(p => p.id !== id));
  else {
    const c = await client();
    const { error } = await c.rpc('delete_post', { p_id: id, p_token: token });
    if (error) throw error;
  }
  notify(door);
}

export function subscribe(door, cb) {
  if (!subs.has(door)) subs.set(door, new Set());
  subs.get(door).add(cb);
  let ch;
  if (isShared) client().then(c => {
    ch = c.channel('door-' + door).on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: 'door=eq.' + door }, cb).subscribe();
  }).catch(() => {});
  return () => { subs.get(door).delete(cb); if (ch) sb.removeChannel(ch); };
}

// Shrinks a picked image in the browser before it is stored.
export async function shrink(file, max = isShared ? 1000 : 480) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  g.drawImage(bmp, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.8);
}
