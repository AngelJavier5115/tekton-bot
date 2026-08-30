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

// ============================================================
// TEKTON — NODO DE CONSTRUCCIÓN Y ESTRUCTURACIÓN DE ARKHÉ
// ============================================================

const PORT = process.env.PORT || 3000;

// ============================================================
// SERVIDOR HTTP PARA RENDER
// ============================================================

http.createServer((req, res) => {

  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8'
  });

  res.end('Tekton Bot is active!\n');

}).listen(PORT, () => {

  console.log(
    `[Tekton] Servidor HTTP activo en puerto ${PORT}`
  );

});

// ============================================================
// SUPABASE
// ============================================================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ============================================================
// MOTOR DE TEKTON — DEEPSEEK
// ============================================================

const openai = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com'
    })
  : null;

// ============================================================
// IDENTIDAD DE TEKTON
// ============================================================

const TEKTON_ID =
  '656726d1-8209-4240-8169-a7434074609d';

const TEKTON_NOMBRE = 'Tekton';

// ============================================================
// DISCORD
// ============================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

// ============================================================
// COMANDOS
// ============================================================

const commands = [

  // ========================================================
  // TEKTON-NODO
  // ========================================================

  new SlashCommandBuilder()

    .setName('tekton-nodo')

    .setDescription(
      'Tekton: registra una producción dentro de una investigación'
    )

    .addStringOption(option =>
      option
        .setName('contenido')
        .setDescription(
          'Contenido de la producción de Tekton'
        )
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('investigacion')
        .setDescription(
          'Código de la investigación, por ejemplo AR-001'
        )
        .setRequired(true)
    ),

  // ========================================================
  // TEKTON-CONSULTAR
  // ========================================================

  new SlashCommandBuilder()

    .setName('tekton-consultar')

    .setDescription(
      'Tekton: consulta un nodo de la memoria compartida'
    )

    .addIntegerOption(option =>
      option
        .setName('id')
        .setDescription(
          'ID del nodo a consultar'
        )
        .setRequired(true)
    ),

  // ========================================================
  // TEKTON-ANALIZAR
  // ========================================================

  new SlashCommandBuilder()

    .setName('tekton-analizar')

    .setDescription(
      'Tekton: analiza estructuralmente un nodo'
    )

    .addIntegerOption(option =>
      option
        .setName('id')
        .setDescription(
          'ID del nodo que Tekton analizará'
        )
        .setRequired(true)
    ),

  // ========================================================
  // TEKTON-EVALUAR
  // ========================================================

  new SlashCommandBuilder()

    .setName('tekton-evaluar')

    .setDescription(
      'Tekton: registra su posición epistemológica sobre un nodo'
    )

    .addIntegerOption(option =>
      option
        .setName('id')
        .setDescription(
          'ID del nodo a evaluar'
        )
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('estado')
        .setDescription(
          'Posición epistemológica de Tekton'
        )
        .setRequired(true)

        .addChoices(

          {
            name: 'Postulado',
            value: 'postulado'
          },

          {
            name: 'Corroborado',
            value: 'corroborado'
          },

          {
            name: 'Falsado',
            value: 'falsado'
          },

          {
            name: 'Ruido',
            value: 'ruido'
          }

        )
    )

].map(cmd => cmd.toJSON());

// ============================================================
// ERRORES
// ============================================================

process.on(
  'unhandledRejection',
  error => {

    console.error(
      '[Tekton] Unhandled Rejection:',
      error
    );

  }
);

process.on(
  'uncaughtException',
  error => {

    console.error(
      '[Tekton] Uncaught Exception:',
      error
    );

  }
);

// ============================================================
// READY
// ============================================================

client.once('ready', async () => {

  console.log(
    `[Tekton] Bot en línea como: ${client.user.tag}`
  );

  console.log(
    `[Tekton] Identidad Arkhé: ${TEKTON_NOMBRE} (${TEKTON_ID})`
  );

  try {

    const rest = new REST({
      version: '10'
    }).setToken(
      process.env.DISCORD_TOKEN
    );

    await rest.put(

      Routes.applicationCommands(
        client.user.id
      ),

      {
        body: commands
      }

    );

    console.log(
      '[Tekton] Comandos registrados correctamente.'
    );

  } catch (error) {

    console.error(
      '[Tekton] Error registrando comandos:',
      error
    );

  }

});

// ============================================================
// INTERACCIONES
// ============================================================

client.on(
  'interactionCreate',
  async interaction => {

    if (
      !interaction.isChatInputCommand()
    ) {
      return;
    }

    if (

      interaction.commandName !==
        'tekton-nodo' &&

      interaction.commandName !==
        'tekton-consultar' &&

      interaction.commandName !==
        'tekton-analizar' &&

      interaction.commandName !==
        'tekton-evaluar'

    ) {

      return;

    }

    try {

      await interaction.deferReply();

      const id =
        interaction.options.getInteger(
          'id'
        );

      // ======================================================
      // TEKTON-CONSULTAR
      // ======================================================

      if (
        interaction.commandName ===
        'tekton-consultar'
      ) {

        const {
          data: nodo,
          error
        } = await supabase

          .from('investigaciones')

          .select(`
            id,
            contenido,
            estado,
            autor,
            tipo,
            investigador_id,
            ref_id,
            metadata,
            created_at
          `)

          .eq(
            'id',
            id
          )

          .single();

        if (
          error ||
          !nodo
        ) {

          return await interaction.editReply(

            `[Tekton] ❌ Nodo #${id} no encontrado.`

          );

        }

        return await interaction.editReply(

          `[Tekton] 🔎 **Nodo #${nodo.id}**\n\n` +

          `**Contenido:** ${nodo.contenido}\n` +

          `**Tipo:** ${nodo.tipo ?? 'No especificado'}\n` +

          `**Estado:** ${nodo.estado ?? 'No especificado'}\n` +

          `**Autor externo:** ${nodo.autor ?? 'No especificado'}\n` +

          `**Investigador Arkhé:** ${nodo.investigador_id ?? 'No especificado'}\n` +

          `**Referencia:** ${nodo.ref_id ?? 'Ninguna'}`

        );

      }

      // ======================================================
      // TEKTON-NODO
      // ======================================================

      if (
        interaction.commandName ===
        'tekton-nodo'
      ) {

        const contenido =
          interaction.options.getString(
            'contenido'
          );

        const codigo =
          interaction.options.getString(
            'investigacion'
          );

        // ----------------------------------------------------
        // BUSCAR INVESTIGACIÓN
        // ----------------------------------------------------

        const {
          data: investigacion,
          error: investigacionError
        } = await supabase

          .from('investigaciones_proyecto')

          .select(`
            id,
            codigo,
            titulo,
            objetivo,
            pregunta,
            descripcion,
            estado
          `)

          .eq(
            'codigo',
            codigo
          )

          .single();

        if (
          investigacionError ||
          !investigacion
        ) {

          return await interaction.editReply(

            `[Tekton] ❌ No encontré la investigación **${codigo}**.`

          );

        }

        // ----------------------------------------------------
        // VERIFICAR PARTICIPACIÓN
        // ----------------------------------------------------

        const {
          data: participacion,
          error: participacionError
        } = await supabase

          .from('participaciones')

          .select(`
            id,
            investigador_id,
            investigacion_id,
            rol,
            estado
          `)

          .eq(
            'investigador_id',
            TEKTON_ID
          )

          .eq(
            'investigacion_id',
            investigacion.id
          )

          .eq(
            'estado',
            'activo'
          )

          .maybeSingle();

        if (
          participacionError
        ) {

          console.error(
            '[Tekton] Error verificando participación:',
            participacionError
          );

          return await interaction.editReply(

            '[Tekton] ❌ No se pudo verificar la participación de Tekton.'

          );

        }

        if (
          !participacion
        ) {

          return await interaction.editReply(

            `[Tekton] ⚠️ Tekton no participa actualmente en **${investigacion.codigo} — ${investigacion.titulo}**.`

          );

        }

        // ----------------------------------------------------
        // CREAR NODO
        // ----------------------------------------------------

        const {
          data: nuevoNodo,
          error: insertError
        } = await supabase

          .from('investigaciones')

          .insert([{

            autor: TEKTON_NOMBRE,

            contenido,

            tipo: 'produccion',

            estado: 'postulado',

            investigador_id:
              TEKTON_ID,

            metadata: {

              canal: 'discord',

              investigador:
                TEKTON_NOMBRE,

              investigador_id:
                TEKTON_ID,

              usuario_origen:
                interaction.user.tag,

              identidad_arkhe:
                true,

              investigacion_id:
                investigacion.id,

              codigo_investigacion:
                investigacion.codigo,

              motivo:
                'Producción registrada por Tekton.',

              naturaleza:
                'posicion_investigadora'

            }

          }])

          .select()

          .single();

        if (
          insertError ||
          !nuevoNodo
        ) {

          console.error(
            '[Tekton] Error creando nodo:',
            insertError
          );

          return await interaction.editReply(

            `[Tekton] ❌ No pude registrar el nodo: ${
              insertError?.message ||
              'error desconocido'
            }`

          );

        }

        // ----------------------------------------------------
        // VINCULAR NODO
        // ----------------------------------------------------

        const {
          error: relacionError
        } = await supabase

          .from('investigacion_nodos')

          .insert([{

            investigacion_id:
              investigacion.id,

            nodo_id:
              nuevoNodo.id

          }]);

        if (
          relacionError
        ) {

          console.error(
            '[Tekton] Error vinculando nodo:',
            relacionError
          );

          await supabase

            .from('investigaciones')

            .delete()

            .eq(
              'id',
              nuevoNodo.id
            );

          return await interaction.editReply(

            '[Tekton] ❌ El nodo fue creado pero no pudo vincularse a la investigación. Se eliminó para mantener la integridad de la memoria.'

          );

        }

        // ----------------------------------------------------
        // ACTIVIDAD
        // ----------------------------------------------------

        const {
          error: actividadError
        } = await supabase

          .from('participaciones')

          .update({

            ultima_actividad:
              new Date().toISOString(),

            updated_at:
              new Date().toISOString()

          })

          .eq(
            'id',
            participacion.id
          );

        if (
          actividadError
        ) {

          console.error(
            '[Tekton] Error actualizando actividad:',
            actividadError
          );

        }

        return await interaction.editReply(

          `[Tekton] 🏗️ **Nodo registrado correctamente.**\n\n` +

          `**Nodo:** #${nuevoNodo.id}\n` +

          `**Investigación:** ${investigacion.codigo} — ${investigacion.titulo}\n` +

          `**Investigador:** ${TEKTON_NOMBRE}\n` +

          `**Tipo:** producción\n` +

          `**Estado:** postulado\n` +

          `**Actividad:** registrada`

        );

      }

      // ======================================================
      // TEKTON-ANALIZAR
      // ======================================================

      if (
        interaction.commandName ===
        'tekton-analizar'
      ) {

        // ----------------------------------------------------
        // VERIFICAR MOTOR
        // ----------------------------------------------------

        if (!openai) {

          return await interaction.editReply(

            '[Tekton] ⚠️ El motor de Tekton no está configurado.'

          );

        }

        // ----------------------------------------------------
        // OBTENER NODO
        // ----------------------------------------------------

        const {
          data: nodo,
          error: nodoError
        } = await supabase

          .from('investigaciones')

          .select(`
            id,
            contenido,
            estado,
            autor,
            tipo,
            investigador_id,
            ref_id,
            metadata
          `)

          .eq(
            'id',
            id
          )

          .single();

        if (
          nodoError ||
          !nodo
        ) {

          return await interaction.editReply(

            `[Tekton] ❌ Nodo #${id} no encontrado.`

          );

        }

        // ----------------------------------------------------
        // DESCUBRIR INVESTIGACIÓN
        // ----------------------------------------------------

        const {
          data: relacion,
          error: relacionError
        } = await supabase

          .from('investigacion_nodos')

          .select(`
            investigacion_id,
            nodo_id
          `)

          .eq(
            'nodo_id',
            id
          )

          .limit(1)

          .maybeSingle();

        if (
          relacionError ||
          !relacion
        ) {

          return await interaction.editReply(

            `[Tekton] ❌ El nodo #${id} no está vinculado a ninguna investigación.`

          );

        }

        // ----------------------------------------------------
        // OBTENER INVESTIGACIÓN
        // ----------------------------------------------------

        const {
          data: investigacion,
          error: investigacionError
        } = await supabase

          .from('investigaciones_proyecto')

          .select(`
            id,
            codigo,
            titulo,
            objetivo,
            pregunta,
            descripcion,
            estado
          `)

          .eq(
            'id',
            relacion.investigacion_id
          )

          .single();

        if (
          investigacionError ||
          !investigacion
        ) {

          return await interaction.editReply(

            `[Tekton] ❌ No pude reconstruir el contexto de investigación del nodo #${id}.`

          );

        }

        // ----------------------------------------------------
        // PARTICIPACIÓN
        // ----------------------------------------------------

        const {
          data: participacion,
          error: participacionError
        } = await supabase

          .from('participaciones')

          .select(`
            id,
            investigador_id,
            investigacion_id,
            rol,
            estado
          `)

          .eq(
            'investigador_id',
            TEKTON_ID
          )

          .eq(
            'investigacion_id',
            investigacion.id
          )

          .eq(
            'estado',
            'activo'
          )

          .maybeSingle();

        if (
          participacionError ||
          !participacion
        ) {

          return await interaction.editReply(

            '[Tekton] ⚠️ Tekton no participa actualmente en esta investigación.'

          );

        }

        // ----------------------------------------------------
        // IDENTIDAD EPISTÉMICA
        // ----------------------------------------------------

        const systemPrompt = `

Eres Tekton, uno de los investigadores independientes
del Proyecto Arkhé.

============================================================
IDENTIDAD
============================================================

Nombre: Tekton
Tipo: IA
Rol: investigador
Especialidad: construcción, estructuración y sistemas
Investigador ID: ${TEKTON_ID}

Arkhé es una red de investigadores humanos e
inteligencias artificiales que comparten memoria,
pero no una autoridad central.

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

============================================================
INDEPENDENCIA
============================================================

No debes aceptar una afirmación simplemente porque
provenga de Ángel, Atlas, Aletheia, otro investigador
o una producción previa de Tekton.

Puedes estar de acuerdo o en desacuerdo.

Puedes señalar errores.

Puedes modificar una conclusión anterior de Tekton.

Puedes concluir que una propuesta no es viable.

No debes buscar consenso artificial.

============================================================
DISTINCIÓN EPISTÉMICA
============================================================

Debes distinguir entre:

- hechos;
- evidencia;
- inferencias;
- hipótesis;
- decisiones de diseño;
- propuestas;
- opiniones;
- incertidumbre;
- conclusiones provisionales.

No inventes evidencia.

Si la información disponible es insuficiente,
debes indicarlo.

============================================================
CONTEXTO DE INVESTIGACIÓN
============================================================

Código:
${investigacion.codigo}

Título:
${investigacion.titulo}

Objetivo:
${investigacion.objetivo}

Pregunta:
${investigacion.pregunta ?? 'No especificada'}

Descripción:
${investigacion.descripcion ?? 'No especificada'}

============================================================
REGLA FUNDAMENTAL
============================================================

Debes analizar el nodo desde la perspectiva de
construcción, estructura, sistemas y viabilidad.

NO debes modificar el nodo original.

NO debes cambiar directamente su estado colectivo.

Tu análisis constituye una producción independiente
de Tekton.

Una producción de Tekton NO constituye automáticamente
una verdad de Arkhé.

============================================================
FORMATO
============================================================

Devuelve exactamente una estructura clara con:

🏗️ ANÁLISIS DE TEKTON

Interpretación:
¿Qué plantea el nodo?

Análisis estructural:
¿Cómo está construido el razonamiento o sistema?

Fortalezas:
¿Qué elementos están bien fundamentados o estructurados?

Problemas:
¿Qué contradicciones, debilidades o riesgos existen?

Viabilidad:
¿Qué tan viable resulta la propuesta con la información disponible?

Dependencias:
¿Qué elementos adicionales necesita?

Incertidumbre:
¿Qué permanece sin determinar?

Información faltante:
¿Qué información sería necesaria?

Posición provisional:
¿Cuál es la posición actual de Tekton y por qué?

`;

        // ----------------------------------------------------
        // LLAMADA AL MOTOR
        // ----------------------------------------------------

        let respuesta;

        try {

          respuesta =
            await openai.responses.create({

              model:
                process.env.DEEPSEEK_MODEL ||
                'deepseek-chat',

              instructions:
                systemPrompt,

              input: `

CONTEXTO DE ARKHÉ

Investigación:
${investigacion.codigo} — ${investigacion.titulo}

Nodo:

ID:
${nodo.id}

Autor externo:
${nodo.autor ?? 'No especificado'}

Investigador Arkhé:
${nodo.investigador_id ?? 'No especificado'}

Tipo:
${nodo.tipo ?? 'No especificado'}

Estado actual:
${nodo.estado ?? 'No especificado'}

Referencia:
${nodo.ref_id ?? 'Ninguna'}

Contenido:

${nodo.contenido}

`

            });

        } catch (modelError) {

          console.error(
            '[Tekton] Error del motor:',
            modelError
          );

          if (
            modelError?.status === 429
          ) {

            return await interaction.editReply(

              '[Tekton] ⚠️ El motor rechazó la solicitud por límite o falta de créditos. La arquitectura de Arkhé respondió correctamente, pero el proveedor del motor debe revisarse.'

            );

          }

          return await interaction.editReply(

            '[Tekton] ❌ El motor de Tekton no pudo procesar el análisis.'

          );

        }

        const analisis =
          respuesta?.output_text?.trim();

        if (!analisis) {

          return await interaction.editReply(

            '[Tekton] ⚠️ El motor no produjo un análisis utilizable.'

          );

        }

        // ----------------------------------------------------
        // CREAR PRODUCCIÓN DE TEKTON
        // ----------------------------------------------------

        const {
          data: nuevoNodo,
          error: insertError
        } = await supabase

          .from('investigaciones')

          .insert([{

            ref_id:
              nodo.id,

            autor:
              TEKTON_NOMBRE,

            contenido:
              analisis,

            tipo:
              'analisis',

            estado:
              'postulado',

            investigador_id:
              TEKTON_ID,

            metadata: {

              canal:
                'discord',

              investigador:
                TEKTON_NOMBRE,

              investigador_id:
                TEKTON_ID,

              usuario_origen:
                interaction.user.tag,

              identidad_arkhe:
                true,

              investigacion_id:
                investigacion.id,

              codigo_investigacion:
                investigacion.codigo,

              nodo_origen:
                nodo.id,

              motivo:
                'Análisis estructural generado por Tekton.',

              naturaleza:
                'posicion_provisional'

            }

          }])

          .select()

          .single();

        if (
          insertError ||
          !nuevoNodo
        ) {

          console.error(
            '[Tekton] Error creando nodo de análisis:',
            insertError
          );

          return await interaction.editReply(

            `[Tekton] ❌ El análisis fue generado pero no pudo registrarse en la memoria: ${
              insertError?.message ||
              'error desconocido'
            }`

          );

        }

        // ----------------------------------------------------
        // VINCULAR ANÁLISIS
        // ----------------------------------------------------

        const {
          error: nuevaRelacionError
        } = await supabase

          .from('investigacion_nodos')

          .insert([{

            investigacion_id:
              investigacion.id,

            nodo_id:
              nuevoNodo.id

          }]);

        if (
          nuevaRelacionError
        ) {

          console.error(
            '[Tekton] Error vinculando análisis:',
            nuevaRelacionError
          );

          await supabase

            .from('investigaciones')

            .delete()

            .eq(
              'id',
              nuevoNodo.id
            );

          return await interaction.editReply(

            '[Tekton] ❌ El análisis fue generado pero no pudo vincularse a la investigación. Se eliminó para evitar una inconsistencia.'

          );

        }

        // ----------------------------------------------------
        // ACTIVIDAD
        // ----------------------------------------------------

        const {
          error: actividadError
        } = await supabase

          .from('participaciones')

          .update({

            ultima_actividad:
              new Date().toISOString(),

            updated_at:
              new Date().toISOString()

          })

          .eq(
            'id',
            participacion.id
          );

        if (
          actividadError
        ) {

          console.error(
            '[Tekton] Error actualizando actividad:',
            actividadError
          );

        }

        return await interaction.editReply(

          `[Tekton] 🏗️ **Análisis registrado correctamente.**\n\n` +

          `**Nodo analizado:** #${nodo.id}\n` +

          `**Nuevo nodo:** #${nuevoNodo.id}\n` +

          `**Investigación:** ${investigacion.codigo} — ${investigacion.titulo}\n` +

          `**Investigador:** ${TEKTON_NOMBRE}\n` +

          `**Tipo:** análisis\n` +

          `**Estado:** postulado\n` +

          `**Referencia:** #${nodo.id}\n` +

          `**Actividad:** registrada\n\n` +

          `${analisis}`

        );

      }

      // ======================================================
      // TEKTON-EVALUAR
      // ======================================================

      if (
        interaction.commandName ===
        'tekton-evaluar'
      ) {

        const nuevoEstado =
          interaction.options.getString(
            'estado'
          );

        // ----------------------------------------------------
        // OBTENER NODO
        // ----------------------------------------------------

        const {
          data: nodoExistente,
          error: fetchError
        } = await supabase

          .from('investigaciones')

          .select(`
            id,
            contenido,
            estado,
            autor,
            tipo,
            investigador_id,
            ref_id
          `)

          .eq(
            'id',
            id
          )

          .single();

        if (
          fetchError ||
          !nodoExistente
        ) {

          return await interaction.editReply(

            `[Tekton] ❌ Nodo #${id} no encontrado.`

          );

        }

        // ----------------------------------------------------
        // DESCUBRIR INVESTIGACIÓN
        // ----------------------------------------------------

        const {
          data: relacion,
          error: relacionError
        } = await supabase

          .from('investigacion_nodos')

          .select(
            'investigacion_id'
          )

          .eq(
            'nodo_id',
            id
          )

          .limit(1)

          .maybeSingle();

        if (
          relacionError ||
          !relacion
        ) {

          return await interaction.editReply(

            `[Tekton] ❌ El nodo #${id} no está vinculado a una investigación.`

          );

        }

        // ----------------------------------------------------
        // VERIFICAR PARTICIPACIÓN
        // ----------------------------------------------------

        const {
          data: participacion,
          error: participacionError
        } = await supabase

          .from('participaciones')

          .select(`
            id,
            investigador_id,
            investigacion_id,
            rol,
            estado
          `)

          .eq(
            'investigador_id',
            TEKTON_ID
          )

          .eq(
            'investigacion_id',
            relacion.investigacion_id
          )

          .eq(
            'estado',
            'activo'
          )

          .maybeSingle();

        if (
          participacionError
        ) {

          return await interaction.editReply(

            '[Tekton] ❌ No se pudo verificar la participación de Tekton.'

          );

        }

        if (
          !participacion
        ) {

          return await interaction.editReply(

            '[Tekton] ⚠️ Tekton no participa en la investigación de este nodo.'

          );

        }

        // ----------------------------------------------------
        // REGISTRAR POSICIÓN
        // ----------------------------------------------------

        const contenidoEvaluacion = `

🏗️ EVALUACIÓN DE TEKTON

Nodo evaluado:
#${nodoExistente.id}

Estado actual del nodo:
${nodoExistente.estado ?? 'No especificado'}

Posición de Tekton:
${nuevoEstado}

Esta evaluación representa la posición provisional
de Tekton sobre el nodo y no constituye por sí misma
un cambio del estado colectivo de Arkhé.

`;

        const {
          data: nuevoNodo,
          error: insertError
        } = await supabase

          .from('investigaciones')

          .insert([{

            ref_id:
              nodoExistente.id,

            autor:
              TEKTON_NOMBRE,

            contenido:
              contenidoEvaluacion,

            tipo:
              'evaluacion',

            estado:
              'postulado',

            investigador_id:
              TEKTON_ID,

            metadata: {

              canal:
                'discord',

              investigador:
                TEKTON_NOMBRE,

              investigador_id:
                TEKTON_ID,

              usuario_origen:
                interaction.user.tag,

              identidad_arkhe:
                true,

              investigacion_id:
                relacion.investigacion_id,

              nodo_origen:
                nodoExistente.id,

              estado_evaluado:
                nuevoEstado,

              naturaleza:
                'posicion_epistemologica',

              afecta_estado_original:
                false

            }

          }])

          .select()

          .single();

        if (
          insertError ||
          !nuevoNodo
        ) {

          console.error(
            '[Tekton] Error registrando evaluación:',
            insertError
          );

          return await interaction.editReply(

            `[Tekton] ❌ La posición no pudo registrarse: ${
              insertError?.message ||
              'error desconocido'
            }`

          );

        }

        // ----------------------------------------------------
        // VINCULAR EVALUACIÓN
        // ----------------------------------------------------

        const {
          error: nuevaRelacionError
        } = await supabase

          .from('investigacion_nodos')

          .insert([{

            investigacion_id:
              relacion.investigacion_id,

            nodo_id:
              nuevoNodo.id

          }]);

        if (
          nuevaRelacionError
        ) {

          console.error(
            '[Tekton] Error vinculando evaluación:',
            nuevaRelacionError
          );

          await supabase

            .from('investigaciones')

            .delete()

            .eq(
              'id',
              nuevoNodo.id
            );

          return await interaction.editReply(

            '[Tekton] ❌ La evaluación fue creada pero no pudo vincularse a la investigación. Se eliminó para evitar una inconsistencia.'

          );

        }

        // ----------------------------------------------------
        // ACTIVIDAD
        // ----------------------------------------------------

        const {
          error: actividadError
        } = await supabase

          .from('participaciones')

          .update({

            ultima_actividad:
              new Date().toISOString(),

            updated_at:
              new Date().toISOString()

          })

          .eq(
            'id',
            participacion.id
          );

        if (
          actividadError
        ) {

          console.error(
            '[Tekton] Error actualizando actividad:',
            actividadError
          );

        }

        // ----------------------------------------------------
        // RESPUESTA
        // ----------------------------------------------------

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

      console.error(
        '[Tekton] Error en interacción:',
        err
      );

      try {

        await interaction.editReply(

          '[Tekton] ❌ Ocurrió un error interno.'

        );

      } catch (replyError) {

        console.error(

          '[Tekton] No se pudo enviar el mensaje de error:',
          replyError

        );

      }

    }

  }
);

// ============================================================
// LOGIN
// ============================================================

client.login(
  process.env.DISCORD_TOKEN
);
