import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const KEYWORDS = ['emission', 'ipo', 'nyemission', 'företrädesemission', 'listning'];

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
    // Hämta RSS från mfn.se
    const rssResponse = await fetch('https://mfn.se/all/s/rss', {
      headers: { 'User-Agent': 'IPO-Akuten/1.0' }
    });

    if (!rssResponse.ok) {
      return new Response(JSON.stringify({ error: 'Kunde inte hämta mfn.se RSS' }), { status: 502, headers });
    }

    const rssText = await rssResponse.text();

    // Plocka ut items från RSS
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(rssText)) !== null) {
      const item = match[1];
      const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/))?.[1] ?? '';
      const description = (item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || item.match(/<description>([\s\S]*?)<\/description>/))?.[1] ?? '';
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] ?? '';
      const guid = item.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] ?? link;

      // Kolla om titeln innehåller emissionsrelaterade ord
      const titleLower = title.toLowerCase();
      const isEmission = KEYWORDS.some(kw => titleLower.includes(kw));
      if (!isEmission) continue;

      items.push({ title, description, link, guid });
    }

    if (items.length === 0) {
      return new Response(JSON.stringify({ message: 'Inga nya emissioner hittades', checked: 0 }), { status: 200, headers });
    }

    let added = 0;
    let skipped = 0;

    for (const item of items.slice(0, 5)) { // Max 5 per körning
      // Dublettkoll via mfn_id
      const { data: existing } = await supabase
        .from('emissions')
        .select('id')
        .eq('mfn_id', item.guid)
        .single();

      if (existing) { skipped++; continue; }

      // Extrahera bolagsnamn från titel (första ordet/frasen)
      const companyName = item.title.split(/\s+(genomför|offentliggör|meddelar|planerar|ansöker)/i)[0].trim();

      // AI-analys
      const fullText = `${item.title}\n\n${item.description}`;
      const aiResult = await analyzeWithAI(fullText);
      if (!aiResult) { skipped++; continue; }

      // Spara bolag
      let { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('name', companyName)
        .single();

      if (!company) {
        const { data: newCompany } = await supabase
          .from('companies')
          .insert([{ name: companyName, ticker: null, sector: null }])
          .select('id')
          .single();
        company = newCompany;
      }

      if (!company) { skipped++; continue; }

      // Spara emission
      const { data: emission } = await supabase
        .from('emissions')
        .insert([{
          company_id: company.id,
          type: item.title.toLowerCase().includes('ipo') || item.title.toLowerCase().includes('listning') ? 'IPO' : 'Företrädesemission',
          status: 'active',
          source_url: item.link,
          avanza_url: 'https://www.avanza.se',
          nordnet_url: 'https://www.nordnet.se',
          mfn_id: item.guid,
        }])
        .select('id')
        .single();

      if (!emission) { skipped++; continue; }

      // Spara AI-analys
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
      added,
      skipped
    }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
