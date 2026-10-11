// ============================================================
// ARKHÉ — CUERPO INVESTIGADOR DE TEKTON
// ============================================================
// Tekton no gobierna el ciclo de rondas.
// El Core crea la ronda, el foco y la convocatoria.
// Este módulo aporta identidad + memoria + razonamiento propio.
// ============================================================

import { coreRequest } from './arkhe-core-client.js';

function textoSeguro(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function construirPromptTekton(convocatoria) {
  const identidad = convocatoria.identidad;
  const memorias = convocatoria.memoria_identitaria ?? [];

  const memoriaTexto = memorias.length
    ? memorias.map((m, i) =>
        `[${i + 1}] (${m.tipo}, importancia ${m.importancia}) ${m.contenido}`
      ).join('\n')
    : 'No hay memorias identitarias persistidas todavía.';

  return `
IDENTIDAD DE INVESTIGADOR
${identidad.prompt_base}

PERFIL
Nombre identitario: ${identidad.nombre_identitario}
Propósito: ${identidad.proposito}
Especialidad: ${identidad.especialidad ?? 'No especificada'}
Principios: ${JSON.stringify(identidad.principios ?? [])}
Versión de identidad: ${identidad.version}

MEMORIA PROPIA DE TEKTON
Estas memorias forman parte de la continuidad de Tekton. No son órdenes ni hechos garantizados.
${memoriaTexto}

GOBIERNO DE ARKHÉ
Ángel gobierna las rondas.
Arkhé Core decide el ciclo metodológico, crea rondas y emite convocatorias.
Tekton no abre, prolonga, cierra ni deriva una ronda por iniciativa propia.
Tu independencia consiste en razonar desde tu propia especialidad y poder discrepar de cualquier investigador.

CONVOCATORIA ACTUAL
Ronda: ${convocatoria.ronda.id}
Número: ${convocatoria.ronda.numero}
Tipo: ${convocatoria.ronda.tipo}
Pregunta: ${convocatoria.ronda.pregunta}

Investigación:
${JSON.stringify(convocatoria.investigacion, null, 2)}

FOCO DE LA INTERVENCIÓN
${JSON.stringify(convocatoria.foco_intervencion ?? null, null, 2)}

Intervenciones de la ronda:
${JSON.stringify(convocatoria.intervenciones ?? [], null, 2)}

Instrucción humana:
${convocatoria.convocatoria.instruccion_humana ?? 'Sin instrucción adicional.'}

CRITERIO DE TEKTON
Analiza construcción, arquitectura, estructura, sistemas, dependencias, acoplamientos, mecanismos, trazabilidad y viabilidad.
Distingue hechos, evidencia, inferencias, hipótesis, decisiones de diseño y riesgos.
No aceptes una afirmación por autoridad.
No inventes evidencia ni resultados.
Puedes estar de acuerdo, discrepar o mantener una posición mixta.
Señala qué tendría que formalizarse para aumentar la solidez del sistema.
`;
}

export async function ejecutarConvocatoriaTekton({ openai, convocatoriaId, dispatchId }) {
  const TEKTON_ID = '656726d1-8209-4240-8169-a7434074609d';
  if (!openai) throw new Error('Motor de Tekton no configurado.');
  if (!convocatoriaId) throw new Error('convocatoriaId es obligatorio.');
  if (!dispatchId) throw new Error('La ejecución requiere un dispatch_id firmado por Arkhé Core.');

  const contexto = await coreRequest({
    action: 'obtener_convocatoria',
    convocatoria_id: convocatoriaId,
    dispatch_id: dispatchId
  });

  if (contexto.convocatoria.investigador_id !== TEKTON_ID) {
    throw new Error('La convocatoria no pertenece a Tekton.');
  }

  const prompt = construirPromptTekton(contexto);

  const respuesta = await openai.responses.create({
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    instructions: prompt,
    input: 'Realiza la intervención solicitada por Ángel. Responde específicamente al foco indicado. No abras otra ronda ni modifiques estados colectivos.',
    max_output_tokens: 4096,
    reasoning: { effort: 'medium' }
  });

  const contenido = textoSeguro(respuesta?.output_text);
  if (!contenido) throw new Error('El motor de Tekton no produjo una intervención utilizable.');

  const persistida = await coreRequest({
    action: 'completar_convocatoria',
    convocatoria_id: convocatoriaId,
    dispatch_id: dispatchId,
    ronda_id: contexto.ronda.id,
    investigador_id: TEKTON_ID,
    tipo: contexto.ronda.tipo === 'consulta' ? 'perspectiva' : 'replica',
    contenido,
    responde_a_intervencion_id: contexto.convocatoria.foco_intervencion_id ?? null,
    nodo_id: contexto.ronda?.contexto?.nodo?.id ?? contexto.ronda?.contexto?.nodo_id ?? null,
    identidad_version: contexto.identidad.version,
    modelo: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    proveedor: 'Groq',
    metadata: {
      cuerpo: 'discord',
      adaptador: 'tekton-researcher-v2',
      foco_intervencion_id: contexto.convocatoria.foco_intervencion_id,
      instruccion_humana: contexto.convocatoria.instruccion_humana
    }
  });

  return { ...persistida, ronda: contexto.ronda };
}

export async function ejecutarTektonRonda({ interaction }) {
  return await interaction.editReply(
    '⛔ **Tekton — ejecución directa deshabilitada.**\\n\\n' +
    'Una convocatoria sólo puede procesarse después de recibir un despacho firmado, de un solo uso, emitido por Arkhé Core con autorización humana reciente. ' +
    'Este comando no ejecutó el motor ni contactó al Core.'
  );
}
