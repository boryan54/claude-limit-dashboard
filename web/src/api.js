export async function fetchLimits() {
  const r = await fetch('/api/limits');
  if (!r.ok) throw new Error('limits ' + r.status);
  return r.json();
}

export async function fetchUsage({ from, to } = {}) {
  const p = new URLSearchParams();
  if (from) p.set('from', from);
  if (to) p.set('to', to);
  const r = await fetch('/api/usage?' + p.toString());
  if (!r.ok) throw new Error('usage ' + r.status);
  return r.json();
}
