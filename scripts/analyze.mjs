import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const PROSPEKT_TEXT = `
Gold Town Games AB (publ) offentliggor memorandum avseende foretradesemission om cirka 6,57 MSEK.
Foretradesemissionen omfattas till cirka 3,3 MSEK, motsvarande cirka 51 procent av emissionsvolymen, av teckningsforbindelser fran Vision Invest, Effess Fastigheter, VD Par Hultgren och styrelseledamoterna Leif Rehnstrom och Tomas Alexandersson.
Emissionslikvidens anvandning: Forbattrad retention och forlangd anvandarllivscykel, Optimering av LTV och framtida skalbar anvandararforvarv, Vidareutveckling av multiplayer och sociala system, Expansion av live operations och eventstruktur, Forberedelse for framtida plattformsdistribution utanfor mobil, Amortering av konvertibellaan om cirka 1,2 MSEK.
Teckningskurs: 0,50 SEK per aktie. Teckningstid: 15 juni 2026 till och med 29 juni 2026. Aktieagare erhaller 4 teckningsratter per innehavd aktie. 5 teckningsratter berättigar till 4 nya aktier.
GOLD TOWN GAMES utvecklar en teknik och designplattform for mobila sportmanagerspel. Bolaget publicerar Pocket Hockey, World Hockey Manager och WXM-plattformsspel. Sate i Skelleftea, leds av VD Par Hultgren.
`;

const companyInfo = {
  name:   'Gold Town Games AB',
  ticker: 'GTG',
  sector: 'Gaming / Mobilspel',
};

const emissionInfo = {
  type:                'Foretradesemission',
  status:              'active',
  amount_msek:         6.57,
  subscription_price:  0.50,
  subscription_start:  '2026-06-15',
  subscription_end:    '2026-06-29',
  trading_start:       null,
  bta_conversion_info: 'BTA omvandlas till ordinarie aktier ca 3 veckor efter stangning.',
  source_url:          'https://news.cision.com/se/gold-town-games/r/gold-town-games-ab--publ--offentliggor-memorandum-avseende-foretradesemission-om-cirka-6-57-msek,c4361815',
  avanza_url:          'https://www.avanza.se',
  nordnet_url:         'https://www.nordnet.se',
  mfn_id:              null,
  media_links:         [],
};

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function runAnalysis() {
  console.log('Startar analys for ' + companyInfo.name + '...');

  const systemPrompt = `Du ar en stenhård finansiell analytiker expert pa skandinaviska nyemissioner. Svara med EXAKT denna JSON-struktur:
{
  "short_summary": "En mening om vad bolaget gor och varfor de soker pengar.",
  "emission_cost_percent": 0.00,
  "capital_allocation": [{"syfte": "Tillvaxt", "procent": 60}],
  "red_flags": ["Titel: Beskrivning"],
  "lock_up_analysis": "Analys av lock-up.",
  "lock_up_expiry_date": "2026-12-31",
  "lock_up_percentage": 45.0,
  "owner_exit_risk": {"sponsor_backed": false, "description": "Beskrivning"},
  "sector_thermometer": {"trend": "Stabil", "score": 7, "description": "Beskrivning"},
  "sentiment_score": 6,
  "options_calculation": {"has_options": false, "value_sek": 0, "explanation": "Inga optioner"},
  "valuation_analysis": {"discount_percent": 15, "explanation": "Beskrivning"},
  "dilution_calculation": {"dilution_percent": 35, "impact_text": "Beskrivning"}
}`;

  const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
        { role: 'user', content: 'Har ar prospektet:\n\n' + PROSPEKT_TEXT },
      ],
    }),
  });

  if (!openAiResponse.ok) {
    const err = await openAiResponse.json();
    console.error('OpenAI-fel:', err.error?.message);
    process.exit(1);
  }

  const openAiData = await openAiResponse.json();
  const aiResult = JSON.parse(openAiData.choices[0].message.content);
  console.log('AI-analys klar!');

  let { data: company } = await supabase.from('companies').select('id').eq('name', companyInfo.name).single();

  if (!company) {
    const { data: newCompany, error } = await supabase.from('companies').insert([{
      name: companyInfo.name, ticker: companyInfo.ticker, sector: companyInfo.sector,
    }]).select('id').single();
    if (error) { console.error('Kunde inte spara bolag:', error.message); process.exit(1); }
    company = newCompany;
  }

  const { data: emission, error: emissionError } = await supabase.from('emissions').insert([{
    company_id: company.id,
    type: emissionInfo.type,
    status: emissionInfo.status,
    amount_msek: emissionInfo.amount_msek,
    subscription_price: emissionInfo.subscription_price,
    subscription_start: emissionInfo.subscription_start,
    subscription_end: emissionInfo.subscription_end,
    trading_start: emissionInfo.trading_start,
    bta_conversion_info: emissionInfo.bta_conversion_info,
    source_url: emissionInfo.source_url,
    avanza_url: emissionInfo.avanza_url,
    nordnet_url: emissionInfo.nordnet_url,
    mfn_id: emissionInfo.mfn_id,
  }]).select('id').single();

  if (emissionError) { console.error('Kunde inte spara emission:', emissionError.message); process.exit(1); }

  const { error: analysisError } = await supabase.from('ai_analyses').insert([{
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
    media_links: emissionInfo.media_links ?? [],
  }]);

  if (analysisError) { console.error('Kunde inte spara analys:', analysisError.message); process.exit(1); }

  console.log('Klart! ' + companyInfo.name + ' ar nu live i databasen.');
}

runAnalysis().catch(console.error);
