import { Resend } from 'resend'

// Lazy initialisering — unngår feil ved build dersom API-nøkkel ikke er satt
let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY er ikke konfigurert')
    }
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Kontrolltårnet <onboarding@resend.dev>'

// ─── E-postmaler ────────────────────────────────────────────────────

function baseTemplate(innhold: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <div style="border-bottom: 2px solid #4A9EDB; padding-bottom: 12px; margin-bottom: 20px;">
        <span style="font-size: 16px; font-weight: 700; color: #0F1923;">Kontrolltårnet</span>
      </div>
      ${innhold}
      <div style="border-top: 1px solid #e5e7eb; margin-top: 24px; padding-top: 12px;">
        <p style="font-size: 11px; color: #9ca3af; margin: 0;">
          Du mottar denne e-posten fordi du er registrert i Kontrolltårnet.
        </p>
      </div>
    </div>
  `
}

function plainTemplate(innhold: string): string {
  return `
    <div style="font-family: Aptos, 'Aptos Display', Calibri, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #000000;">
      ${innhold}
    </div>
  `
}

// ─── Oppgave tildelt ────────────────────────────────────────────────

export async function sendOppgaveTildeltEpost(params: {
  tilEpost: string
  tilNavn: string
  oppgaveBeskrivelse: string
  oppgaveType: string
  sakTittel: string
  sakId: string
  frist: string | null
  tildeltAv: string
}) {
  const fristTekst = params.frist
    ? new Date(params.frist).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Ingen frist satt'

  const html = baseTemplate(`
    <p style="font-size: 14px; color: #374151; margin: 0 0 16px;">
      Hei ${params.tilNavn},
    </p>
    <p style="font-size: 14px; color: #374151; margin: 0 0 16px;">
      <strong>${params.tildeltAv}</strong> har tildelt deg en ny oppgave:
    </p>
    <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <div style="font-size: 11px; text-transform: uppercase; color: #4A9EDB; font-weight: 600; margin-bottom: 4px;">
        ${params.oppgaveType}
      </div>
      <div style="font-size: 15px; font-weight: 600; color: #0F1923; margin-bottom: 8px;">
        ${params.oppgaveBeskrivelse}
      </div>
      <div style="font-size: 13px; color: #6b7280;">
        Sak: ${params.sakTittel}
      </div>
      <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">
        Frist: ${fristTekst}
      </div>
    </div>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://kontrolltarnet.vercel.app'}/sak/${params.sakId}"
       style="display: inline-block; background: #4A9EDB; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 500;">
      Åpne saken
    </a>
  `)

  return sendEpost({
    to: params.tilEpost,
    subject: `Ny oppgave: ${params.oppgaveBeskrivelse}`,
    html,
  })
}

// ─── Fristpåminnelse ────────────────────────────────────────────────

export async function sendFristPaminnelseEpost(params: {
  tilEpost: string
  tilNavn: string
  oppgaver: {
    beskrivelse: string
    type: string
    frist: string
    sakTittel: string
    sakId: string
  }[]
}) {
  const oppgaveListe = params.oppgaver.map(o => {
    const fristDato = new Date(o.frist)
    const idag = new Date()
    idag.setHours(0, 0, 0, 0)
    fristDato.setHours(0, 0, 0, 0)
    const dager = Math.ceil((fristDato.getTime() - idag.getTime()) / (1000 * 60 * 60 * 24))

    let fristFarge = '#6b7280'
    let fristTekst = ''
    if (dager < 0) { fristFarge = '#dc2626'; fristTekst = ` (${Math.abs(dager)} dager over frist!)` }
    else if (dager === 0) { fristFarge = '#ea580c'; fristTekst = ' (i dag!)' }
    else if (dager === 1) { fristFarge = '#ea580c'; fristTekst = ' (i morgen!)' }
    else { fristTekst = ` (om ${dager} dager)` }

    return `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; font-weight: 500; color: #0F1923;">${o.beskrivelse}</div>
          <div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">${o.sakTittel} · ${o.type}</div>
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; text-align: right; white-space: nowrap;">
          <span style="font-size: 12px; color: ${fristFarge}; font-weight: 500;">
            ${fristDato.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}${fristTekst}
          </span>
        </td>
      </tr>
    `
  }).join('')

  const html = baseTemplate(`
    <p style="font-size: 14px; color: #374151; margin: 0 0 16px;">
      Hei ${params.tilNavn},
    </p>
    <p style="font-size: 14px; color: #374151; margin: 0 0 16px;">
      Du har <strong>${params.oppgaver.length} oppgave${params.oppgaver.length !== 1 ? 'r' : ''}</strong> med kommende frister:
    </p>
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 16px;">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="text-align: left; padding: 8px 12px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Oppgave</th>
          <th style="text-align: right; padding: 8px 12px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Frist</th>
        </tr>
      </thead>
      <tbody>
        ${oppgaveListe}
      </tbody>
    </table>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://kontrolltarnet.vercel.app'}/mine-oppgaver"
       style="display: inline-block; background: #4A9EDB; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 500;">
      Se mine oppgaver
    </a>
  `)

  return sendEpost({
    to: params.tilEpost,
    subject: `${params.oppgaver.length} oppgave${params.oppgaver.length !== 1 ? 'r' : ''} med kommende frister`,
    html,
  })
}

// ─── Høringsfrist-påminnelse ────────────────────────────────────────

export async function sendHoringsfristEpost(params: {
  tilEpost: string
  tilNavn: string
  sakTittel: string
  sakId: string
  horingsfrist: string
  dagerIgjen: number
}) {
  const fristDato = new Date(params.horingsfrist).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })

  const html = baseTemplate(`
    <p style="font-size: 14px; color: #374151; margin: 0 0 16px;">
      Hei ${params.tilNavn},
    </p>
    <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <div style="font-size: 13px; font-weight: 600; color: #92400e; margin-bottom: 4px;">
        Høringsfrist om ${params.dagerIgjen} dag${params.dagerIgjen !== 1 ? 'er' : ''}
      </div>
      <div style="font-size: 15px; font-weight: 600; color: #0F1923; margin-bottom: 4px;">
        ${params.sakTittel}
      </div>
      <div style="font-size: 13px; color: #6b7280;">
        Frist: ${fristDato}
      </div>
    </div>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://kontrolltarnet.vercel.app'}/sak/${params.sakId}"
       style="display: inline-block; background: #4A9EDB; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 500;">
      Åpne saken
    </a>
  `)

  return sendEpost({
    to: params.tilEpost,
    subject: `Høringsfrist om ${params.dagerIgjen} dager: ${params.sakTittel}`,
    html,
  })
}

// ─── Oppdatering på fulgt sak ───────────────────────────────────────

export async function sendSakOppdateringEpost(params: {
  tilEpost: string
  tilNavn: string
  sakTittel: string
  sakId: string
  hendelse: string
  utfortAv: string
}) {
  const html = baseTemplate(`
    <p style="font-size: 14px; color: #374151; margin: 0 0 16px;">
      Hei ${params.tilNavn},
    </p>
    <p style="font-size: 14px; color: #374151; margin: 0 0 16px;">
      Det har skjedd en oppdatering på en sak du følger:
    </p>
    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <div style="font-size: 15px; font-weight: 600; color: #0F1923; margin-bottom: 8px;">
        ${params.sakTittel}
      </div>
      <div style="font-size: 13px; color: #374151;">
        ${params.hendelse}
      </div>
      <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">
        Av ${params.utfortAv}
      </div>
    </div>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://kontrolltarnet.vercel.app'}/sak/${params.sakId}"
       style="display: inline-block; background: #4A9EDB; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 500;">
      Åpne saken
    </a>
  `)

  return sendEpost({
    to: params.tilEpost,
    subject: `Oppdatering: ${params.sakTittel}`,
    html,
  })
}

// ─── Høring til behandling ──────────────────────────────────────────

export interface HoringEpostParams {
  tilNavn?: string
  avsenderNavn: string
  avsenderEpost: string
  tittel: string
  departement: string
  horingsfrist: string | null
  internFrist: string | null
  utvalg: string[]
  hovedUtvalg?: string | null
  regjeringenUrl: string | null
  vedlegg: { tittel: string; url: string; type: string }[]
}

export function byggHoringEpostHtml(params: HoringEpostParams): { html: string; subject: string } {
  function fmtDato(iso: string | null) {
    if (!iso) return '(ikke satt)'
    return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const antallUtvalg = params.utvalg.length
  function liten(s: string) { if (s.length > 1 && s[1] === s[1].toUpperCase() && s[1] !== s[1].toLowerCase()) return s; return s.charAt(0).toLowerCase() + s.slice(1) }

  function byggUtvalgAvsnitt(): string {
    if (antallUtvalg === 0) {
      return `<p style="font-size:14px;color:#000000;margin:0 0 14px;">
        Vi ber lovutvalget om å se på høringen og eventuelt utarbeide forslag til foreningens høringsuttalelse i saken.
      </p>`
    }
    if (antallUtvalg === 1) {
      return `<p style="font-size:14px;color:#000000;margin:0 0 14px;">
        Vi ber lovutvalget for <strong>${liten(params.utvalg[0])}</strong> om å se på høringen og eventuelt utarbeide forslag til foreningens høringsuttalelse i saken.
      </p>`
    }
    const lead = params.hovedUtvalg ?? params.utvalg[0]
    const andre = params.utvalg.filter(u => u !== lead)
    const andreTekst = andre.map(u => `lovutvalget for <strong>${liten(u)}</strong>`).join(' og ')
    return `<p style="font-size:14px;color:#000000;margin:0 0 14px;">
        Vi ber lovutvalget for <strong>${liten(lead)}</strong> om å utarbeide forslag til foreningens høringsuttalelse i saken.
        Lovutvalget har hovedansvar for å koordinere og sammenstille innspill fra ${antallUtvalg === 2 ? 'begge utvalg' : 'alle utvalg'}, slik at det utarbeides ett samlet forslag til høringsuttalelse.
      </p>
      <p style="font-size:14px;color:#000000;margin:0 0 14px;">
        Denne e-posten er også sendt til ${andreTekst}.
        Lovutvalget bes sende sine innspill til det koordinerende lovutvalget i god tid før den interne fristen (se nedenfor).
      </p>`
  }

  // Lenker og vedlegg som →-piler
  const pilerHtml = [
    ...(params.regjeringenUrl
      ? [`<p style="font-size:14px;color:#000000;margin:0 0 5px;">→ <a href="${params.regjeringenUrl}" style="color:#000000;">Se høringen på regjeringen.no</a></p>`]
      : []),
    ...params.vedlegg.map(v =>
      `<p style="font-size:14px;color:#000000;margin:0 0 5px;">→ <a href="${v.url}" style="color:#000000;">${v.tittel}</a></p>`
    ),
  ].join('')

  const html = plainTemplate(`
    <p style="font-size:14px;color:#000000;margin:0 0 14px;">Hei,</p>

    <p style="font-size:14px;color:#000000;margin:0 0 8px;">
      Advokatforeningen har mottatt følgende høring fra
      ${params.departement ? params.departement : 'et departement'}:
      ${params.tittel}.
    </p>

    ${pilerHtml ? `<div style="margin:0 0 16px;">${pilerHtml}</div>` : ''}

    ${byggUtvalgAvsnitt()}

    <p style="font-size:14px;color:#000000;margin:0 0 14px;">
      Dersom det vurderes at høringen bør forelegges flere lovutvalg, bes det om rask tilbakemelding til sekretariatet.
    </p>

    <p style="font-size:15px;color:#000000;font-weight:600;text-decoration:underline;margin:0 0 16px;">
      Den interne fristen for utkast til høringsuttalelse er: ${fmtDato(params.internFrist)}
    </p>

    <p style="font-size:14px;color:#000000;margin:0 0 20px;">
      Bekreft til <a href="mailto:${params.avsenderEpost}" style="color:#000000;">${params.avsenderNavn}</a>
      om lovutvalget vil sende forslag til høringsuttalelse innen fristen.
      Meld fra så snart som mulig dersom det er behov for fristutsettelse, slik at sekretariatet kan sende forespørsel.
      Dersom lovutvalget mener det ikke er behov for å inngi høringsuttalelse, bes det om en kort begrunnelse.
    </p>

    <hr style="border:none;border-top:1px solid #d1d5db;margin:0 0 16px;" />

    <p style="font-size:13px;font-weight:600;color:#000000;margin:0 0 10px;">Generelle retningslinjer for utarbeidelse av høringsuttalelser</p>

    <p style="font-size:13px;color:#000000;margin:0 0 3px;font-weight:600;">I. Struktur</p>
    <ol style="font-size:13px;color:#000000;margin:0 0 12px;padding-left:20px;line-height:1.75;">
      <li style="margin-bottom:6px;"><strong>Innledning:</strong> Standard fast innledning legges inn av sekretariatet og tilpasses målform.</li>
      <li style="margin-bottom:6px;"><strong>Sakens bakgrunn:</strong> Vi viser til høringen til …, publisert xx. måned 20xx, med høringsfrist den xx. måned 20xx. Høringen gjelder …. Denne høringsuttalelsen er i hovedsak utarbeidet av Advokatforeningens lovutvalg for …. Lovutvalget består av (legges inn av sekretariatet), som alle har lang erfaring og kompetanse innenfor det aktuelle rettsområdet.</li>
      <li style="margin-bottom:6px;"><strong>Kommentarer til forslagene:</strong> Vi ber om at departementets systematikk følges (overskrifter/nummerering i høringsbrevet). Det er også en fordel om det avslutningsvis under hvert enkelt punkt kan formuleres et standpunkt eller konklusjon, eksempelvis «Advokatforeningen foreslår etter dette følgende omformulering…» eller «På denne bakgrunn går Advokatforeningen mot forslaget om å endre lovbestemmelsen.»</li>
      <li><strong>Oppsummering:</strong> Gjenta hovedsynspunktene til slutt.</li>
    </ol>

    <p style="font-size:13px;color:#000000;margin:0 0 3px;font-weight:600;">II. Språk</p>
    <ol style="font-size:13px;color:#000000;margin:0 0 12px;padding-left:20px;line-height:1.75;">
      <li style="margin-bottom:6px;">Bruk formuleringer som «Advokatforeningen mener …», «Advokatforeningen finner …» eller «Etter Advokatforeningens syn …». Unngå uttrykk som «Advokatforeningen hevder …» eller «Advokatforeningen gjør gjeldende …». Årsaken er høringsuttalelsens formål: Advokatforeningen fremmer sine syn i forbindelse med generell regelutforming underlagt politiske beslutningsprosesser, ikke som rettslig argumentasjon i konkrete rettsspørsmål.</li>
      <li>Skriv i Advokatforeningens navn, og unngå bruk av «jeg» og «vi».</li>
    </ol>

    <p style="font-size:13px;color:#000000;margin:0;">
      Det vises ellers til
      <a href="https://www.advokatforeningen.no/om-advokatforeningen/organisasjon/foreningsorganer/lovutvalgene/retningslinjer-for-lovutvalgene/" style="color:#000000;">retningslinjene for Advokatforeningens lovutvalg</a>.
    </p>
  `)

  return { html, subject: params.tittel }
}

export async function sendHoringTilBehandlingEpost(params: HoringEpostParams & { tilEpost: string }) {
  const { html, subject } = byggHoringEpostHtml(params)
  return sendEpost({ to: params.tilEpost, subject, html })
}

// ─── Mandagsliste ───────────────────────────────────────────────────

export interface MandagslisteHoring {
  tittel: string
  departement: string | null
  utvalg: string[]
  horingsfrist: string | null
  internFrist: string | null
  regjeringenUrl: string | null
  status: string
}

export async function sendMandagslisteEpost(params: {
  tilEpost: string
  tilNavn: string
  horinger: MandagslisteHoring[]
  dato: string
}): Promise<{ success: boolean; error?: string }> {
  function fmtDato(iso: string | null) {
    if (!iso) return '–'
    return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function statusLabel(s: string) {
    const map: Record<string, string> = {
      innkommet: 'Innkommet',
      til_vurdering: 'Til vurdering',
      svarer: 'Vi svarer',
      svarer_ikke: 'Svarer ikke',
      levert: 'Levert',
      arkivert: 'Arkivert',
    }
    return map[s] ?? s
  }

  function fristFarge(iso: string | null): string {
    if (!iso) return '#6b7280'
    const dager = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
    if (dager < 0) return '#dc2626'
    if (dager <= 7) return '#ea580c'
    if (dager <= 14) return '#d97706'
    return '#374151'
  }

  const radHtml = params.horinger.map((h, i) => {
    const utvalgTekst = h.utvalg.length > 0 ? h.utvalg.join(', ') : '–'
    const rad = i % 2 === 0 ? '#ffffff' : '#f9fafb'
    return `
      <tr style="background:${rad};">
        <td style="padding:10px 12px;font-size:13px;color:#000000;border-bottom:1px solid #f3f4f6;">
          ${h.regjeringenUrl
            ? `<a href="${h.regjeringenUrl}" style="color:#000000;text-decoration:none;">${h.tittel}</a>`
            : h.tittel}
          <div style="font-size:11px;color:#9ca3af;margin-top:2px;">${h.departement ?? ''}</div>
        </td>
        <td style="padding:10px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #f3f4f6;white-space:nowrap;">${utvalgTekst}</td>
        <td style="padding:10px 12px;font-size:12px;color:${fristFarge(h.internFrist)};border-bottom:1px solid #f3f4f6;white-space:nowrap;font-weight:500;">${fmtDato(h.internFrist)}</td>
        <td style="padding:10px 12px;font-size:12px;color:${fristFarge(h.horingsfrist)};border-bottom:1px solid #f3f4f6;white-space:nowrap;font-weight:500;">${fmtDato(h.horingsfrist)}</td>
        <td style="padding:10px 12px;font-size:11px;border-bottom:1px solid #f3f4f6;white-space:nowrap;">
          <span style="background:#f3f4f6;color:#6b7280;padding:2px 7px;border-radius:9999px;">${statusLabel(h.status)}</span>
        </td>
      </tr>`
  }).join('')

  const html = plainTemplate(`
    <p style="font-size:14px;color:#000000;margin:0 0 4px;">Ukens høringsoversikt — <strong>${params.dato}</strong></p>
    <p style="font-size:13px;color:#6b7280;margin:0 0 16px;">
      ${params.horinger.length} høring${params.horinger.length !== 1 ? 'er' : ''} er fortsatt til behandling hos utvalgene.
    </p>

    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <thead>
        <tr style="background:#0F1923;">
          <th style="text-align:left;padding:9px 12px;font-size:11px;font-weight:600;color:#fff;text-transform:uppercase;letter-spacing:.04em;">Høring</th>
          <th style="text-align:left;padding:9px 12px;font-size:11px;font-weight:600;color:#fff;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;">Utvalg</th>
          <th style="text-align:left;padding:9px 12px;font-size:11px;font-weight:600;color:#fff;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;">Intern frist</th>
          <th style="text-align:left;padding:9px 12px;font-size:11px;font-weight:600;color:#fff;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;">Høringsfrist</th>
          <th style="text-align:left;padding:9px 12px;font-size:11px;font-weight:600;color:#fff;text-transform:uppercase;letter-spacing:.04em;">Status</th>
        </tr>
      </thead>
      <tbody>${radHtml}</tbody>
    </table>

    <p style="font-size:12px;color:#9ca3af;margin:16px 0 0;">
      Du mottar denne listen fordi du har abonnert på mandagsoppdateringen i Kontrolltårnet.
      Du kan endre varslingsinnstillingene dine på <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://tingsyn.no'}/min-side" style="color:#4A9EDB;">Min side</a>.
    </p>
  `)

  return sendEpost({
    to: params.tilEpost,
    subject: `Høringsoversikt uke ${ukenummer(new Date())} — ${params.horinger.length} aktive høringer`,
    html,
  })
}

function ukenummer(d: Date): number {
  const dato = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  dato.setUTCDate(dato.getUTCDate() + 4 - (dato.getUTCDay() || 7))
  const årsStart = new Date(Date.UTC(dato.getUTCFullYear(), 0, 1))
  return Math.ceil((((dato.getTime() - årsStart.getTime()) / 86400000) + 1) / 7)
}

// ─── Organisasjonsendringer (Brreg) ─────────────────────────────────

export async function sendOrganisasjonsendringEpost(params: {
  tilEpost: string
  tilNavn: string
  endringer: {
    orgNavn: string
    orgnr: string
    beskrivelse: string
    endringType: string
  }[]
}) {
  const endringRader = params.endringer.map(e => {
    let farge = '#6b7280'
    let bakgrunn = '#f9fafb'
    let ikon = '~'
    if (e.endringType === 'ny_rolle') { farge = '#15803d'; bakgrunn = '#f0fdf4'; ikon = '+' }
    else if (e.endringType === 'fjernet_rolle') { farge = '#dc2626'; bakgrunn = '#fef2f2'; ikon = '-' }

    return `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; width: 24px; vertical-align: top;">
          <span style="display: inline-block; width: 22px; height: 22px; border-radius: 4px; background: ${bakgrunn}; color: ${farge}; font-weight: 700; font-size: 14px; text-align: center; line-height: 22px; font-family: monospace;">${ikon}</span>
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 13px; color: #0F1923;">${e.beskrivelse}</div>
          <div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">${e.orgNavn} · ${e.orgnr}</div>
        </td>
      </tr>
    `
  }).join('')

  const html = baseTemplate(`
    <p style="font-size: 14px; color: #374151; margin: 0 0 16px;">
      Hei ${params.tilNavn},
    </p>
    <p style="font-size: 14px; color: #374151; margin: 0 0 16px;">
      Det er oppdaget <strong>${params.endringer.length} endring${params.endringer.length !== 1 ? 'er' : ''}</strong> i organisasjoner du overvåker:
    </p>
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 16px;">
      <tbody>
        ${endringRader}
      </tbody>
    </table>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://tingsyn.no'}/organisasjoner"
       style="display: inline-block; background: #4A9EDB; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 500;">
      Se organisasjoner
    </a>
  `)

  return sendEpost({
    to: params.tilEpost,
    subject: `${params.endringer.length} endring${params.endringer.length !== 1 ? 'er' : ''} i overvåkede organisasjoner`,
    html,
  })
}

// ─── Basisfunksjon ──────────────────────────────────────────────────

export async function sendEpostRaw(params: { to: string; subject: string; html: string }) {
  return sendEpost(params)
}

async function sendEpost(params: { to: string; subject: string; html: string }) {
  try {
    const { data, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
    })

    if (error) {
      console.error('E-post feilet:', error)
      return { success: false, error: error.message }
    }

    console.log('E-post sendt:', data?.id, 'til', params.to)
    return { success: true, id: data?.id }
  } catch (err) {
    console.error('E-post exception:', err)
    return { success: false, error: String(err) }
  }
}
