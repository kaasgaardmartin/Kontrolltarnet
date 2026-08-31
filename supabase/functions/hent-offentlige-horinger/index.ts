import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RSS_URL = "https://www.regjeringen.no/no/rss/Rss/2581966/?documentType=dokumenter/h%C3%B8ringer";

// --- Hjelpefunksjoner ---

function parseNorskDato(str: string): string | null {
  if (!str) return null;
  const m = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const MAANEDER: Record<string, string> = {
    januar: "01", februar: "02", mars: "03", april: "04",
    mai: "05", juni: "06", juli: "07", august: "08",
    september: "09", oktober: "10", november: "11", desember: "12",
  };
  const lm = str.toLowerCase().match(/(\d{1,2})\.\s*(januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)\s*(\d{4})/);
  if (lm) return `${lm[3]}-${MAANEDER[lm[2]]}-${lm[1].padStart(2, "0")}`;
  return null;
}

function dekod(str: string): string {
  return str
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&oslash;/gi, "ø").replace(/&aelig;/gi, "æ").replace(/&aring;/gi, "å")
    .replace(/&Oslash;/g, "Ø").replace(/&AElig;/g, "Æ").replace(/&Aring;/g, "Å");
}

function rensk(str: string): string {
  return dekod(str.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function xmlTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? rensk(m[1]) : null;
}

function trekkUtDepartement(beskrivelse: string | null): string | null {
  if (!beskrivelse) return null;
  const m = beskrivelse.match(/^([A-ZÆØÅ][a-zæøåA-ZÆØÅ\s-]+(?:departementet|direktoratet|tilsynet|rådet|Statsministerens kontor))/);
  return m ? m[1].trim() : null;
}

function trekkUtFrist(beskrivelse: string | null): string | null {
  if (!beskrivelse) return null;
  const m = beskrivelse.match(/[Hh]øringsfrist[^:]*[:\s]*(\d{1,2}\.\s*\d{1,2}\.\s*\d{4})/)
    ?? beskrivelse.match(/[Hh]øringsfrist[^:]*[:\s]*(\d{1,2}\.\s*(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)\s*\d{4})/i)
    ?? beskrivelse.match(/[Ff]rist[^:]*[:\s]*(\d{1,2}\.\s*\d{1,2}\.\s*\d{4})/i);
  return m ? parseNorskDato(m[1]) : null;
}

interface RssItem {
  tittel: string;
  regjeringen_url: string;
  beskrivelse: string | null;
  publisert_dato: string | null;
  departement: string | null;
  horingsfrist: string | null;
}

// --- Hent høringer fra RSS ---

async function hentHoringerFraRss(): Promise<RssItem[]> {
  const resp = await fetch(RSS_URL, {
    headers: { "Accept": "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fra RSS-feed`);
  const xml = await resp.text();

  const resultater: RssItem[] = [];
  const items = xml.split("<item>").slice(1);

  for (const item of items) {
    const tittel = xmlTag(item, "title");
    let link = xmlTag(item, "link");
    const beskrivelse = xmlTag(item, "description");
    const pubDate = xmlTag(item, "pubDate");

    if (!tittel || !link) continue;

    link = link.replace(/[?&]utm_[^&]*/g, "").replace(/\?$/, "");

    let publisert_dato: string | null = null;
    if (pubDate) {
      try {
        const d = new Date(pubDate);
        if (!isNaN(d.getTime())) {
          publisert_dato = d.toISOString().substring(0, 10);
        }
      } catch { /* ignorer */ }
    }

    const departement = trekkUtDepartement(beskrivelse);
    const horingsfrist = trekkUtFrist(beskrivelse);

    resultater.push({ tittel, regjeringen_url: link, beskrivelse, publisert_dato, departement, horingsfrist });
  }

  return resultater;
}

// --- Scrape regjeringen.no høringssider for detaljer ---

function erInstansJunk(tekst: string): boolean {
  const junk = [
    /^ansvarlig for/i, /^telefon:/i, /^e-?post:/i, /^organisasjonsnummer:/i,
    /^personvernerklæring/i, /^til toppen/i, /^postadresse:/i, /^besøksadresse:/i,
    /^kontakt oss/i, /^\d[\d\s]*$/,
  ];
  return junk.some(r => r.test(tekst.trim()));
}

function hentNavnFraBlokk(blokk: string): string[] {
  const anchors = [...blokk.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)];
  if (anchors.length > 0) {
    return anchors
      .map(([, t]) => rensk(t))
      .filter(n => n.length > 2 && !erInstansJunk(n));
  }
  const medLF = blokk.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
  return medLF.split("\n").map(l => rensk(l)).filter(l => l.length > 2 && !erInstansJunk(l));
}

interface ScrapeResultat {
  horingsfrist: string | null;
  departement: string | null;
  beskrivelse: string | null;
  horing_instanser: string[];
}

async function skrapHoringSide(url: string): Promise<ScrapeResultat> {
  const resp = await fetch(url, {
    headers: {
      "Accept-Language": "nb-NO,nb;q=0.9",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const html = dekod(await resp.text());

  // --- Departement ---
  const deptMatch =
    html.match(/class="[^"]*article-source[^"]*"[^>]*>([\s\S]*?)<\//)
    || html.match(/Publisert av:\s*<[^>]+>([\s\S]*?)<\//)
    || html.match(/([A-ZÆØÅ][a-zæøåA-ZÆØÅ\s-]+(?:departementet|direktoratet|tilsynet|rådet|Statsministerens kontor))\s+sender\s+med\s+dette/u)
    || html.match(/<meta[^>]*(?:name="author"|property="og:site_name")[^>]*content="([^"]+)"/);
  const departement = deptMatch ? rensk(deptMatch[1].replace(/<[^>]+>/g, "")) : null;

  // --- Høringsfrist ---
  let horingsfrist: string | null = null;

  // dl/dt/dd-struktur
  const metaBlock = html.match(/<dl[^>]*>([\s\S]*?)<\/dl>/g) || [];
  for (const block of metaBlock) {
    const pairs = [...block.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)];
    for (const [, label, value] of pairs) {
      const l = rensk(label.replace(/<[^>]+>/g, "")).toLowerCase();
      const v = rensk(value.replace(/<[^>]+>/g, ""));
      if (l.includes("høringsfrist") || l.includes("frist")) {
        horingsfrist = parseNorskDato(v);
      }
    }
  }

  if (!horingsfrist) {
    const f1 = html.match(/[Hh]øringsfrist(?:[:\s]|<[^>]+>)+(\d{1,2}\.\d{1,2}\.\d{4}|\d{1,2}\.\s*(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)\s*\d{4})/i);
    if (f1) horingsfrist = parseNorskDato(f1[1]);
  }
  if (!horingsfrist) {
    const f2 = html.match(/[Ff]rist\s+for\s+å\s+sende\s+inn\s+høringssvar\s+er\s+(\d{1,2}\.?\s*(?:\d{1,2}\.\d{4}|(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)\s*\d{4}))/i);
    if (f2) horingsfrist = parseNorskDato(f2[1]);
  }
  if (!horingsfrist) {
    const f3 = html.match(/[Hh]øringsfristen\s+er\s+(\d{1,2}\.\s*(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)\s*\d{4})/i);
    if (f3) horingsfrist = parseNorskDato(f3[1]);
  }

  // --- Beskrivelse (ingress) ---
  const ingressMatch = html.match(/<div[^>]*class="[^"]*article-ingress[^"]*"[^>]*>([\s\S]*?)<\/div>/);
  const beskrivelse = ingressMatch ? rensk(ingressMatch[1].replace(/<[^>]+>/g, "")) : null;

  // --- Høringsinstanser ---
  const instanser: string[] = [];
  const instansStart = html.indexOf('id="horingsinstanser"');
  if (instansStart !== -1) {
    const stopKandidater = [
      html.indexOf('<div class="factbox">', instansStart + 20),
      html.indexOf("</article>", instansStart + 20),
      html.indexOf("<footer", instansStart + 20),
      html.indexOf('id="article-footer"', instansStart + 20),
      html.indexOf('class="article__footer"', instansStart + 20),
    ].filter(i => i !== -1);
    const stopPos = stopKandidater.length > 0 ? Math.min(...stopKandidater) : instansStart + 15000;
    const instansHtml = html.substring(instansStart, stopPos);

    const pMatches = [...instansHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
    for (const [, p] of pMatches) {
      instanser.push(...hentNavnFraBlokk(p));
    }

    if (instanser.length === 0) {
      const liMatches = [...instansHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
      for (const [, li] of liMatches) {
        instanser.push(...hentNavnFraBlokk(li));
      }
    }
  } else {
    const h2Match = html.match(/<h2[^>]*>\s*[Hh]øringsinstans(?:er|ene)?\s*<\/h2>/i);
    if (h2Match && h2Match.index !== undefined) {
      const start = h2Match.index + h2Match[0].length;
      const stopKandidater = [
        html.indexOf("<h2", start + 1),
        html.indexOf("</article>", start),
        html.indexOf("<footer", start),
      ].filter(i => i !== -1);
      const stopPos = stopKandidater.length > 0 ? Math.min(...stopKandidater) : start + 15000;
      const blokk = html.substring(start, stopPos);

      const pMatches = [...blokk.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
      for (const [, p] of pMatches) {
        const navn = rensk(p);
        if (navn && navn.length > 2 && !erInstansJunk(navn)) instanser.push(navn);
      }

      if (instanser.length === 0) {
        const liMatches = [...blokk.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
        for (const [, li] of liMatches) {
          const navn = rensk(li);
          if (navn && navn.length > 2 && !erInstansJunk(navn)) instanser.push(navn);
        }
      }
    }
  }

  return { horingsfrist, departement, beskrivelse, horing_instanser: instanser };
}

// --- Hovedlogikk ---

Deno.serve(async (_req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: orgs, error: orgFeil } = await supabase
      .from("organisasjoner")
      .select("id")
      .eq("auto_import_horinger", true);

    if (orgFeil) throw new Error(`Org-henting feilet: ${orgFeil.message}`);
    if (!orgs?.length) {
      return Response.json({ melding: "Ingen organisasjoner", antall_nye: 0 });
    }

    const rssHoringer = await hentHoringerFraRss();
    if (!rssHoringer.length) {
      return Response.json({ melding: "Ingen høringer i RSS-feed", antall_nye: 0 });
    }

    // Samle alle nye høringer på tvers av orgs (dedupliser scraping)
    const alleEksisterende = new Set<string>();
    for (const org of orgs) {
      const { data: eksisterende } = await supabase
        .from("offentlige_horinger")
        .select("regjeringen_url")
        .eq("organisasjon_id", org.id)
        .not("regjeringen_url", "is", null);
      for (const h of eksisterende ?? []) {
        alleEksisterende.add(h.regjeringen_url);
      }
    }

    const nyeUrls = rssHoringer.filter(h => !alleEksisterende.has(h.regjeringen_url));
    if (!nyeUrls.length) {
      return Response.json({ melding: "Ingen nye høringer", antall_funnet: rssHoringer.length, antall_nye: 0 });
    }

    // Scrape hver ny hørings side for detaljer
    const berikede = new Map<string, ScrapeResultat>();
    let scrapet = 0;
    for (const h of nyeUrls) {
      if (!h.regjeringen_url.includes("regjeringen.no")) continue;
      try {
        if (scrapet > 0) await new Promise(r => setTimeout(r, 500));
        const detaljer = await skrapHoringSide(h.regjeringen_url);
        berikede.set(h.regjeringen_url, detaljer);
        scrapet++;
        console.log(`Scrapet ${h.regjeringen_url}: frist=${detaljer.horingsfrist}, dept=${detaljer.departement}, instanser=${detaljer.horing_instanser.length}`);
      } catch (err) {
        console.error(`Scrape feilet for ${h.regjeringen_url}:`, err instanceof Error ? err.message : err);
      }
    }

    // Sett inn for hver org
    let totaltNye = 0;
    for (const org of orgs) {
      const { data: eksisterende } = await supabase
        .from("offentlige_horinger")
        .select("regjeringen_url")
        .eq("organisasjon_id", org.id)
        .not("regjeringen_url", "is", null);

      const eksisterendeUrls = new Set(
        (eksisterende ?? []).map((h: { regjeringen_url: string }) => h.regjeringen_url),
      );

      const nye = rssHoringer.filter((h) => !eksisterendeUrls.has(h.regjeringen_url));
      if (!nye.length) continue;

      const rader = nye.map((h) => {
        const detaljer = berikede.get(h.regjeringen_url);
        return {
          organisasjon_id: org.id,
          tittel: h.tittel,
          departement: detaljer?.departement ?? h.departement,
          regjeringen_url: h.regjeringen_url,
          publisert_dato: h.publisert_dato,
          horingsfrist: detaljer?.horingsfrist ?? h.horingsfrist,
          beskrivelse: detaljer?.beskrivelse ?? h.beskrivelse,
          horing_instanser: detaljer?.horing_instanser ?? [],
          vedlegg: [],
          status: "innkommet" as const,
          utvalg: [] as string[],
        };
      });

      const { error: insertFeil } = await supabase
        .from("offentlige_horinger")
        .insert(rader);

      if (insertFeil) {
        console.error(`Insert feilet for org ${org.id}:`, insertFeil.message);
      } else {
        totaltNye += nye.length;
      }
    }

    return Response.json({
      melding: "Høringer oppdatert",
      antall_funnet: rssHoringer.length,
      antall_nye: totaltNye,
      antall_scrapet: scrapet,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Ukjent feil";
    console.error("hent-offentlige-horinger feil:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
});
