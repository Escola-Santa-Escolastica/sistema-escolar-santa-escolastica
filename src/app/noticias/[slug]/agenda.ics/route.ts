import { NextResponse } from 'next/server';
import { publicacaoPorSlug } from '@/lib/publicacoes';
import { SITE } from '@/lib/site';

/** Arquivo de agenda (.ics) do evento, para "Adicionar à minha agenda". */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = /^[a-z0-9-]{1,90}$/.test(slug) ? await publicacaoPorSlug(slug) : null;
  if (!p || p.tipo !== 'evento' || !p.evento_data) return new NextResponse('Evento não encontrado', { status: 404 });

  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const utc = (data: string, h: string) => new Date(`${data}T${h.slice(0, 5)}:00-03:00`).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dia = p.evento_data.replace(/-/g, '');
  const proximo = new Date(`${p.evento_data}T12:00:00Z`);
  proximo.setUTCDate(proximo.getUTCDate() + 1);
  const quando = p.evento_inicio
    ? [`DTSTART:${utc(p.evento_data, p.evento_inicio)}`, `DTEND:${utc(p.evento_data, p.evento_fim ?? p.evento_inicio)}`]
    : [`DTSTART;VALUE=DATE:${dia}`, `DTEND;VALUE=DATE:${proximo.toISOString().slice(0, 10).replace(/-/g, '')}`];
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Instituto Santa Escolastica//Site//PT', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${p.id}@santaescolastica`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    ...quando,
    `SUMMARY:${esc(p.titulo)}`,
    `DESCRIPTION:${esc(p.resumo)}`,
    `LOCATION:${esc(p.evento_local || `${SITE.nome}, ${SITE.endereco}`)}`,
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
  return new NextResponse(ics, {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="${slug}.ics"` },
  });
}
