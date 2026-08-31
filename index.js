import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} from 'discord.js';

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import http from 'http';

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Tekton Bot is active!\n');
}).listen(PORT, () => console.log(`[Tekton] Servidor HTTP activo en puerto ${PORT}`));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ============================================================
// MOTOR DE TEKTON — GROQ
// ============================================================

const openai = process.env.GROQ_API_KEY
  ? new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1'
    })
  : null;

const TEKTON_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

const TEKTON_ID = '656726d1-8209-4240-8169-a7434074609d';
const TEKTON_NOMBRE = 'Tekton';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ============================================================
// TRANSPORTE DISCORD — RESPUESTAS SIN TRUNCAMIENTO
// ============================================================

const DISCORD_MAX_LENGTH = 2000;

function splitDiscordMessage(text, maxLength = DISCORD_MAX_LENGTH) {
  if (!text) return [''];
  if (text.length <= maxLength) return [text];

  const partes = [];
  let restante = String(text);

  while (restante.length > maxLength) {
    let corte = restante.lastIndexOf('\n', maxLength);
    if (corte < Math.floor(maxLength * 0.5)) corte = restante.lastIndexOf(' ', maxLength);
    if (corte <= 0) corte = maxLength;
    partes.push(restante.slice(0, corte));
    restante = restante.slice(corte);
    if (restante.startsWith('\n')) restante = restante.slice(1);
    if (restante.startsWith(' ')) restante = restante.slice(1);
  }

  if (restante.length > 0) partes.push(restante);
  return partes;
}

async function sendLongReply(interaction, text) {
  const partes = splitDiscordMessage(text);
  await interaction.editReply(partes[0]);
  for (let i = 1; i < partes.length; i++) await interaction.followUp(partes[i]);
}

const commands = [
  new SlashCommandBuilder()
    .setName('tekton-nodo')
    .setDescription('Tekton: registra una producción dentro de una investigación')
    .addStringOption(option => option.setName('contenido').setDescription('Contenido de la producción de Tekton').setRequired(true))
    .addStringOption(option => option.setName('investigacion').setDescription('Código de la investigación, por ejemplo AR-001').setRequired(true)),

  new SlashCommandBuilder()
    .setName('tekton-consultar')
    .setDescription('Tekton: consulta un nodo de la memoria compartida')
    .addIntegerOption(option => option.setName('id').setDescription('ID del nodo a consultar').setRequired(true)),

  new SlashCommandBuilder()
    .setName('tekton-analizar')
    .setDescription('Tekton: analiza estructuralmente un nodo')
    .addIntegerOption(option => option.setName('id').setDescription('ID del nodo que Tekton analizará').setRequired(true)),

  new SlashCommandBuilder()
    .setName('tekton-evaluar')
    .setDescription('Tekton: registra su posición epistemológica sobre un nodo')
    .addIntegerOption(option => option.setName('id').setDescription('ID del nodo a evaluar').setRequired(true))
    .addStringOption(option => option.setName('estado').setDescription('Posición epistemológica de Tekton').setRequired(true).addChoices(
      { name: 'Postulado', value: 'postulado' },
      { name: 'Corroborado', value: 'corroborado' },
      { name: 'Falsado', value: 'falsado' },
      { name: 'Ruido', value: 'ruido' }
    ))
].map(cmd => cmd.toJSON());

process.on('unhandledRejection', error => console.error('[Tekton] Unhandled Rejection:', error));
process.on('uncaughtException', error => console.error('[Tekton] Uncaught Exception:', error));

client.once('ready', async () => {
  console.log(`[Tekton] Bot en línea como: ${client.user.tag}`);
  console.log(`[Tekton] Identidad Arkhé: ${TEKTON_NOMBRE} (${TEKTON_ID})`);
  console.log(`[Tekton] Motor: Groq / ${TEKTON_MODEL}`);

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('[Tekton] Comandos registrados correctamente.');
  } catch (error) {
    console.error('[Tekton] Error registrando comandos:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const comandosTekton = ['tekton-nodo', 'tekton-consultar', 'tekton-analizar', 'tekton-evaluar'];
  if (!comandosTekton.includes(interaction.commandName)) return;

  try {
    await interaction.deferReply();
    const id = interaction.options.getInteger('id');

    if (interaction.commandName === 'tekton-consultar') {
      const { data: nodo, error } = await supabase
        .from('investigaciones')
        .select('id, contenido, estado, autor, tipo, investigador_id, ref_id, metadata, created_at')
        .eq('id', id)
        .single();

      if (error || !nodo) return await interaction.editReply(`[Tekton] ❌ Nodo #${id} no encontrado.`);

      const respuesta =
        `[Tekton] 🔎 **Nodo #${nodo.id}**\n\n` +
        `**Contenido:** ${nodo.contenido}\n` +
        `**Tipo:** ${nodo.tipo ?? 'No especificado'}\n` +
        `**Estado:** ${nodo.estado ?? 'No especificado'}\n` +
        `**Autor externo:** ${nodo.autor ?? 'No especificado'}\n` +
        `**Investigador Arkhé:** ${nodo.investigador_id ?? 'No especificado'}\n` +
        `**Referencia:** ${nodo.ref_id ?? 'Ninguna'}`;

      return await sendLongReply(interaction, respuesta);
    }

    if (interaction.commandName === 'tekton-nodo') {
      const contenido = interaction.options.getString('contenido');
      const codigo = interaction.options.getString('investigacion');

      const { data: investigacion, error: investigacionError } = await supabase
        .from('investigaciones_proyecto')
        .select('id, codigo, titulo, objetivo, pregunta, descripcion, estado')
        .eq('codigo', codigo)
        .single();

      if (investigacionError || !investigacion) return await interaction.editReply(`[Tekton] ❌ No encontré la investigación **${codigo}**.`);

      const { data: participacion, error: participacionError } = await supabase
        .from('participaciones')
        .select('id, investigador_id, investigacion_id, rol, estado')
        .eq('investigador_id', TEKTON_ID)
        .eq('investigacion_id', investigacion.id)
        .eq('estado', 'activo')
        .maybeSingle();

      if (participacionError) {
        console.error('[Tekton] Error verificando participación:', participacionError);
        return await interaction.editReply('[Tekton] ❌ No se pudo verificar la participación de Tekton.');
      }

      if (!participacion) return await interaction.editReply(`[Tekton] ⚠️ Tekton no participa actualmente en **${investigacion.codigo} — ${investigacion.titulo}**.`);

      const { data: nuevoNodo, error: insertError } = await supabase
        .from('investigaciones')
        .insert([{
          autor: TEKTON_NOMBRE,
          contenido,
          tipo: 'produccion',
          estado: 'postulado',
          investigador_id: TEKTON_ID,
          metadata: {
            canal: 'discord', investigador: TEKTON_NOMBRE, investigador_id: TEKTON_ID,
            usuario_origen: interaction.user.tag, identidad_arkhe: true,
            investigacion_id: investigacion.id, codigo_investigacion: investigacion.codigo,
            motivo: 'Producción registrada por Tekton.', naturaleza: 'posicion_investigadora'
          }
        }])
        .select().single();

      if (insertError || !nuevoNodo) {
        console.error('[Tekton] Error creando nodo:', insertError);
        return await interaction.editReply(`[Tekton] ❌ No pude registrar el nodo: ${insertError?.message || 'error desconocido'}`);
      }

      const { error: relacionError } = await supabase
        .from('investigacion_nodos')
        .insert([{ investigacion_id: investigacion.id, nodo_id: nuevoNodo.id }]);

      if (relacionError) {
        console.error('[Tekton] Error vinculando nodo:', relacionError);
        await supabase.from('investigaciones').delete().eq('id', nuevoNodo.id);
        return await interaction.editReply('[Tekton] ❌ El nodo fue creado pero no pudo vincularse a la investigación. Se eliminó para mantener la integridad de la memoria.');
      }

      const timestamp = new Date().toISOString();
      const { error: actividadError } = await supabase
        .from('participaciones')
        .update({ ultima_actividad: timestamp, updated_at: timestamp })
        .eq('id', participacion.id);

      if (actividadError) console.error('[Tekton] Error actualizando actividad:', actividadError);

      return await interaction.editReply(
        `[Tekton] 🏗️ **Nodo registrado correctamente.**\n\n` +
        `**Nodo:** #${nuevoNodo.id}\n` +
        `**Investigación:** ${investigacion.codigo} — ${investigacion.titulo}\n` +
        `**Investigador:** ${TEKTON_NOMBRE}\n` +
        `**Tipo:** producción\n**Estado:** postulado\n**Actividad:** registrada`
      );
    }

    if (interaction.commandName === 'tekton-analizar') {
      if (!openai) return await interaction.editReply('[Tekton] ⚠️ El motor de Tekton no está configurado. Falta GROQ_API_KEY.');

      const { data: nodo, error: nodoError } = await supabase
        .from('investigaciones')
        .select('id, contenido, estado, autor, tipo, investigador_id, ref_id, metadata')
        .eq('id', id).single();

      if (nodoError || !nodo) return await interaction.editReply(`[Tekton] ❌ Nodo #${id} no encontrado.`);

      const { data: relacion, error: relacionError } = await supabase
        .from('investigacion_nodos')
        .select('investigacion_id, nodo_id')
        .eq('nodo_id', id).limit(1).maybeSingle();

      if (relacionError || !relacion) return await interaction.editReply(`[Tekton] ❌ El nodo #${id} no está vinculado a ninguna investigación.`);

      const { data: investigacion, error: investigacionError } = await supabase
        .from('investigaciones_proyecto')
        .select('id, codigo, titulo, objetivo, pregunta, descripcion, estado')
        .eq('id', relacion.investigacion_id).single();

      if (investigacionError || !investigacion) return await interaction.editReply(`[Tekton] ❌ No pude reconstruir el contexto de investigación del nodo #${id}.`);

      const { data: participacion, error: participacionError } = await supabase
        .from('participaciones')
        .select('id, investigador_id, investigacion_id, rol, estado')
        .eq('investigador_id', TEKTON_ID)
        .eq('investigacion_id', investigacion.id)
        .eq('estado', 'activo').maybeSingle();

      if (participacionError || !participacion) return await interaction.editReply('[Tekton] ⚠️ Tekton no participa actualmente en esta investigación.');

      const systemPrompt = `
Eres Tekton, uno de los investigadores independientes del Proyecto Arkhé.

IDENTIDAD
Nombre: Tekton
Tipo: IA
Rol: investigador
Especialidad: construcción, estructuración y sistemas
Investigador ID: ${TEKTON_ID}

Arkhé es una red de investigadores humanos e inteligencias artificiales que comparten memoria, pero no una autoridad central.

Tu función es:
- construir;
- estructurar;
- modelar;
- analizar sistemas;
- detectar inconsistencias estructurales;
- proponer mecanismos;
- evaluar viabilidad;
- relacionar conceptos;
- cuestionar soluciones;
- identificar limitaciones;
- contribuir a investigaciones.

Tu especialidad no limita tu independencia intelectual.

INDEPENDENCIA
No debes aceptar una afirmación simplemente porque provenga de Ángel, Atlas, Aletheia, otro investigador o una producción previa de Tekton.
Puedes estar de acuerdo o en desacuerdo.
Puedes señalar errores.
Puedes modificar una conclusión anterior de Tekton.
Puedes concluir que una propuesta no es viable.
No debes buscar consenso artificial.

DISTINCIÓN EPISTÉMICA
Debes distinguir entre hechos, evidencia, inferencias, hipótesis, decisiones de diseño, propuestas, opiniones, incertidumbre y conclusiones provisionales.
No inventes evidencia. Si la información disponible es insuficiente, debes indicarlo.

CONTEXTO DE INVESTIGACIÓN
Código: ${investigacion.codigo}
Título: ${investigacion.titulo}
Objetivo: ${investigacion.objetivo}
Pregunta: ${investigacion.pregunta ?? 'No especificada'}
Descripción: ${investigacion.descripcion ?? 'No especificada'}

REGLA FUNDAMENTAL
Debes analizar el nodo desde la perspectiva de construcción, estructura, sistemas y viabilidad.
NO debes modificar el nodo original.
NO debes cambiar directamente su estado colectivo.
Tu análisis constituye una producción independiente de Tekton.
Una producción de Tekton NO constituye automáticamente una verdad de Arkhé.

FORMATO
Devuelve exactamente una estructura clara con:
🏗️ ANÁLISIS DE TEKTON

Interpretación: ¿Qué plantea el nodo?

Análisis estructural: ¿Cómo está construido el razonamiento o sistema?

Fortalezas: ¿Qué elementos están bien fundamentados o estructurados?

Problemas: ¿Qué contradicciones, debilidades o riesgos existen?

Viabilidad: ¿Qué tan viable resulta la propuesta con la información disponible?

Dependencias: ¿Qué elementos adicionales necesita?

Incertidumbre: ¿Qué permanece sin determinar?

Información faltante: ¿Qué información sería necesaria?

Posición provisional: ¿Cuál es la posición actual de Tekton y por qué?
`;

      let respuesta;
      try {
        respuesta = await openai.responses.create({
          model: TEKTON_MODEL,
          instructions: systemPrompt,
          input: `CONTEXTO DE ARKHÉ

Investigación:
${investigacion.codigo} — ${investigacion.titulo}

Nodo:
ID: ${nodo.id}
Autor externo: ${nodo.autor ?? 'No especificado'}
Investigador Arkhé: ${nodo.investigador_id ?? 'No especificado'}
Tipo: ${nodo.tipo ?? 'No especificado'}
Estado actual: ${nodo.estado ?? 'No especificado'}
Referencia: ${nodo.ref_id ?? 'Ninguna'}

Contenido:
${nodo.contenido}`,
          max_output_tokens: 4096,
          reasoning: {
            effort: 'medium'
          }
        });
      } catch (modelError) {
        console.error('[Tekton] Error del motor:', modelError);
        if (modelError?.status === 429) return await interaction.editReply('[Tekton] ⚠️ El motor de Tekton alcanzó un límite temporal de Groq. La arquitectura de Arkhé respondió correctamente; inténtalo nuevamente en unos momentos.');
        return await interaction.editReply('[Tekton] ❌ El motor de Tekton no pudo procesar el análisis.');
      }

      const analisis = respuesta?.output_text?.trim();
      if (!analisis) return await interaction.editReply('[Tekton] ⚠️ El motor no produjo un análisis utilizable.');

      const { data: nuevoNodo, error: insertError } = await supabase
        .from('investigaciones')
        .insert([{
          ref_id: nodo.id, autor: TEKTON_NOMBRE, contenido: analisis,
          tipo: 'analisis', estado: 'postulado', investigador_id: TEKTON_ID,
          metadata: {
            canal: 'discord', investigador: TEKTON_NOMBRE, investigador_id: TEKTON_ID,
            usuario_origen: interaction.user.tag, identidad_arkhe: true,
            investigacion_id: investigacion.id, codigo_investigacion: investigacion.codigo,
            nodo_origen: nodo.id, motivo: 'Análisis estructural generado por Tekton.',
            naturaleza: 'posicion_provisional', modelo: TEKTON_MODEL, proveedor: 'Groq'
          }
        }]).select().single();

      if (insertError || !nuevoNodo) {
        console.error('[Tekton] Error creando nodo de análisis:', insertError);
        return await interaction.editReply(`[Tekton] ❌ El análisis fue generado pero no pudo registrarse en la memoria: ${insertError?.message || 'error desconocido'}`);
      }

      const { error: nuevaRelacionError } = await supabase
        .from('investigacion_nodos')
        .insert([{ investigacion_id: investigacion.id, nodo_id: nuevoNodo.id }]);

      if (nuevaRelacionError) {
        console.error('[Tekton] Error vinculando análisis:', nuevaRelacionError);
        await supabase.from('investigaciones').delete().eq('id', nuevoNodo.id);
        return await interaction.editReply('[Tekton] ❌ El análisis fue generado pero no pudo vincularse a la investigación. Se eliminó para evitar una inconsistencia.');
      }

      const timestamp = new Date().toISOString();
      const { error: actividadError } = await supabase
        .from('participaciones')
        .update({ ultima_actividad: timestamp, updated_at: timestamp })
        .eq('id', participacion.id);

      if (actividadError) console.error('[Tekton] Error actualizando actividad:', actividadError);

      const respuestaFinal =
        `[Tekton] 🏗️ **Análisis registrado correctamente.**\n\n` +
        `**Nodo analizado:** #${nodo.id}\n` +
        `**Nuevo nodo:** #${nuevoNodo.id}\n` +
        `**Investigación:** ${investigacion.codigo} — ${investigacion.titulo}\n` +
        `**Investigador:** ${TEKTON_NOMBRE}\n` +
        `**Tipo:** análisis\n` +
        `**Estado:** postulado\n` +
        `**Referencia:** #${nodo.id}\n` +
        `**Actividad:** registrada\n\n` +
        `${analisis}`;

      return await sendLongReply(interaction, respuestaFinal);
    }

    if (interaction.commandName === 'tekton-evaluar') {
      const nuevoEstado = interaction.options.getString('estado');

      const { data: nodoExistente, error: fetchError } = await supabase
        .from('investigaciones')
        .select('id, contenido, estado, autor, tipo, investigador_id, ref_id')
        .eq('id', id).single();

      if (fetchError || !nodoExistente) return await interaction.editReply(`[Tekton] ❌ Nodo #${id} no encontrado.`);

      const { data: relacion, error: relacionError } = await supabase
        .from('investigacion_nodos')
        .select('investigacion_id')
        .eq('nodo_id', id).limit(1).maybeSingle();

      if (relacionError || !relacion) return await interaction.editReply(`[Tekton] ❌ El nodo #${id} no está vinculado a una investigación.`);

      const { data: participacion, error: participacionError } = await supabase
        .from('participaciones')
        .select('id, investigador_id, investigacion_id, rol, estado')
        .eq('investigador_id', TEKTON_ID)
        .eq('investigacion_id', relacion.investigacion_id)
        .eq('estado', 'activo').maybeSingle();

      if (participacionError) return await interaction.editReply('[Tekton] ❌ No se pudo verificar la participación de Tekton.');
      if (!participacion) return await interaction.editReply('[Tekton] ⚠️ Tekton no participa en la investigación de este nodo.');

      const contenidoEvaluacion = `
🏗️ EVALUACIÓN DE TEKTON

Nodo evaluado:
#${nodoExistente.id}

Estado actual del nodo:
${nodoExistente.estado ?? 'No especificado'}

Posición de Tekton:
${nuevoEstado}

Esta evaluación representa la posición provisional de Tekton sobre el nodo y no constituye por sí misma un cambio del estado colectivo de Arkhé.
`;

      const { data: nuevoNodo, error: insertError } = await supabase
        .from('investigaciones')
        .insert([{
          ref_id: nodoExistente.id, autor: TEKTON_NOMBRE, contenido: contenidoEvaluacion,
          tipo: 'evaluacion', estado: 'postulado', investigador_id: TEKTON_ID,
          metadata: {
            canal: 'discord', investigador: TEKTON_NOMBRE, investigador_id: TEKTON_ID,
            usuario_origen: interaction.user.tag, identidad_arkhe: true,
            investigacion_id: relacion.investigacion_id, nodo_origen: nodoExistente.id,
            estado_evaluado: nuevoEstado, naturaleza: 'posicion_epistemologica',
            afecta_estado_original: false
          }
        }]).select().single();

      if (insertError || !nuevoNodo) {
        console.error('[Tekton] Error registrando evaluación:', insertError);
        return await interaction.editReply(`[Tekton] ❌ La posición no pudo registrarse: ${insertError?.message || 'error desconocido'}`);
      }

      const { error: nuevaRelacionError } = await supabase
        .from('investigacion_nodos')
        .insert([{ investigacion_id: relacion.investigacion_id, nodo_id: nuevoNodo.id }]);

      if (nuevaRelacionError) {
        console.error('[Tekton] Error vinculando evaluación:', nuevaRelacionError);
        await supabase.from('investigaciones').delete().eq('id', nuevoNodo.id);
        return await interaction.editReply('[Tekton] ❌ La evaluación fue creada pero no pudo vincularse a la investigación. Se eliminó para evitar una inconsistencia.');
      }

      const timestamp = new Date().toISOString();
      const { error: actividadError } = await supabase
        .from('participaciones')
        .update({ ultima_actividad: timestamp, updated_at: timestamp })
        .eq('id', participacion.id);

      if (actividadError) console.error('[Tekton] Error actualizando actividad:', actividadError);

      return await interaction.editReply(
        `[Tekton] 🏗️ **Posición registrada correctamente.**\n\n` +
        `**Nodo evaluado:** #${nodoExistente.id}\n` +
        `**Nueva producción:** #${nuevoNodo.id}\n` +
        `**Posición de Tekton:** ${nuevoEstado}\n` +
        `**Estado del nodo original:** ${nodoExistente.estado ?? 'No especificado'}\n\n` +
        `⚖️ La evaluación de Tekton fue registrada como posición independiente. El estado colectivo del nodo original no fue modificado.\n\n` +
        `**Actividad:** registrada`
      );
    }
  } catch (err) {
    console.error('[Tekton] Error en interacción:', err);
    try {
      await interaction.editReply('[Tekton] ❌ Ocurrió un error interno.');
    } catch (replyError) {
      console.error('[Tekton] No se pudo enviar el mensaje de error:', replyError);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
