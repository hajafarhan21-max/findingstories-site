const DAY_MS = 86_400_000;

export function temperatureForScore(score) {
  return score >= 75 ? 'Hot' : score >= 45 ? 'Warm' : 'Cold';
}

export function followUpDate(temperature, capturedAt = new Date()) {
  const captured = new Date(capturedAt);
  if (Number.isNaN(captured.getTime())) throw new Error('Invalid lead capture date');
  const days = temperature === 'Hot' ? 0 : temperature === 'Warm' ? 1 : 3;
  const start = Date.UTC(captured.getUTCFullYear(), captured.getUTCMonth(), captured.getUTCDate());
  return new Date(start + days * DAY_MS).toISOString().slice(0, 10);
}

export function finaliseQualification(qualification, capturedAt) {
  const score = Math.max(0, Math.min(100, Math.round(Number(qualification.lead_score) || 0)));
  const temperature = temperatureForScore(score);
  return { ...qualification, lead_score: score, temperature, suggested_follow_up_date: followUpDate(temperature, capturedAt) };
}

export async function persistAndSchedule({ lead, persist, schedule, background }) {
  const saved = await persist(lead);
  if (!saved.id) throw new Error('Lead persistence did not return an identifier');
  if (!saved.duplicate) schedule(background(saved));
  return saved;
}

export async function qualifySavedLead({ id, lead, capturedAt, qualify, fallback, start = async () => {}, update }) {
  await start(id);
  let qualification;
  let source = 'openai';
  try {
    qualification = await qualify(lead);
  } catch (error) {
    console.error('Qualification unavailable:', error instanceof Error ? error.message : 'unknown');
    qualification = fallback(lead);
    source = 'deterministic_fallback';
  }
  const result = finaliseQualification(qualification, capturedAt);
  await update(id, { ...result, qualification_status: 'completed', qualification_source: source });
  return result;
}
