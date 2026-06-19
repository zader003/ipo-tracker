import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const KEYWORDS = ['emission', 'nyemission', 'företrädesemission', 'rights issue', 'subsequent offering', 'private placement', 'kapitalforhøjelse', 'rettet emission'];

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function analyzeWithAI(text) {
  const systemPrompt = `Du är en stenhård finansiell analytiker expert på skandinaviska nyemissioner. Svara med EXAKT denna JSON-struktur:
{
  "short_summary": "En mening om vad bolaget gör och varför de söker pengar.",
  "emission_cost_percent": 0.00,
  "capital_allocation": [{"syfte": "Tillväxt", "procent": 60}],
  "red_flags": ["Titel: Beskrivning"],
  "lock_up_analysis": "Analys av lock-up.",
  "lock_up_expiry_date": null,
  "lock_up_percentage": null,
  "owner_exit_risk": {"sponsor_backed": false, "description": "Beskrivning"},
  "sector_thermometer": {"trend": "Stabil", "score": 5, "description": "Beskrivning"},
  "sentiment_score": 5,
  "options_calculation": {"has_options": false, "value_sek": 0, "explanation": "Inga optioner"},
  "valuation_analysis": {"discount_percent": 0, "explanation": "Beskrivning"},
  "dilution_calculation": {"dilution_percent": 0, "impact_text": "Beskrivning"}
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analysera denna emission:\n\n${text}` },
      ],
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

export default async function handler(req) {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const mfnResponse = await fetch('https://www.mfn.se/all/s/nordic', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IPO-Akuten/1.0)' }
    });

    if (!mfnResponse.ok) {
      return new Response(JSON.stringify({ error: 'Kunde inte hämta mfn.se' }), { status: 502, headers });
    }

    const html = await mfnResponse.text();

    // Matcha mönster: datum, bolagslänk, titellänk
    const itemRegex = /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s*\[([^\]]+)\]\(https:\/\/www\.mfn\.se\/all\/a\/[^\)]+\)\s*\[([^\]]+)\]\(([^"]+?)\s*"[^"]*"\)/g;

    const items = [];
    let match;
    while ((match = itemRegex.exec(html)) !== null) {
      const [, date, company, title, link] = match;
      const titleLower = title.toLowerCase();
      const isEmission = KEYWORDS.some(kw => titleLower.includes(kw));
      if (isEmission) {
        items.push({ date, company: company.trim(), title: title.trim(), link: link.trim() });
      }
    }

    if (items.length === 0) {
      return new Response(JSON.stringify({ message: 'Inga nya emissioner hittades just nu', checked: 0 }), { status: 200, headers });
    }

    let added = 0;
    let skipped = 0;

    for (const item of items.slice(0, 3)) {
      const { data: existing } = await supabase
        .from('emissions')
        .select('id')
        .eq('mfn_id', item.link)
        .single();

      if (existing) { skipped++; continue; }

      let { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('name', item.company)
        .single();

      if (!company) {
        const { data: newCompany } = await supabase
          .from('companies')
          .insert([{ name: item.company, ticker: null, sector: null }])
          .select('id')
          .single();
        company = newCompany;
      }

      if (!company) { skipped++; continue; }

      const aiResult = await analyzeWithAI(item.title);
      if (!aiResult) { skipped++; continue; }

      const { data: emission } = await supabase
        .from('emissions')
        .insert([{
          company_id: company.id,
          type: 'Företrädesemission',
          status: 'active',
          source_url: item.link,
          avanza_url: 'https://www.avanza.se',
          nordnet_url: 'https://www.nordnet.se',
          mfn_id: item.link,
        }])
        .select('id')
        .single();

      if (!emission) { skipped++; continue; }

      await supabase.from('ai_analyses').insert([{
        emission_id: emission.id,
        short_summary: aiResult.short_summary,
        emission_cost_percent: aiResult.emission_cost_percent,
        capital_allocation: aiResult.capital_allocation,
        red_flags: aiResult.red_flags,
        lock_up_analysis: aiResult.lock_up_analysis,
        lock_up_expiry_date: aiResult.lock_up_expiry_date ?? null,
        lock_up_percentage: aiResult.lock_up_percentage ?? null,
        owner_exit_risk: aiResult.owner_exit_risk,
        sector_thermometer: aiResult.sector_thermometer,
        sentiment_score: aiResult.sentiment_score,
        options_calculation: aiResult.options_calculation,
        valuation_analysis: aiResult.valuation_analysis,
        dilution_calculation: aiResult.dilution_calculation,
        media_links: [],
      }]);

      added++;
    }

    return new Response(JSON.stringify({
      message: `Klar! ${added} nya emissioner tillagda, ${skipped} hoppades över.`,
      found: items.length,
      added,
      skipped
    }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
