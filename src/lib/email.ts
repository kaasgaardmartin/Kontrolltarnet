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

// ─── Basisfunksjon ──────────────────────────────────────────────────

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
