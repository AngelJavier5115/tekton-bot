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
// TEKTON — NODO DE ESTRUCTURACIÓN DE ARKHÉ
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
// DEEPSEEK
// ============================================================

const deepseek = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY
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

  // ==========================================================
  // TEKTON-NODO
  // ==========================================================

  new SlashCommandBuilder()

    .setName('tekton-nodo')

    .setDescription(
      'Tekton: registra conocimiento dentro de una investigación'
    )

    .addStringOption(option =>
      option
        .setName('contenido')
        .setDescription(
          'La idea, dato, hipótesis o aporte'
        )
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('investigacion')
        .setDescription(
          'Código de investigación de Arkhé. Ejemplo: AR-001'
        )
        .setRequired(true)
    ),

  // ==========================================================
  // TEKTON-CONSULTAR
  // ==========================================================

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

  // ==========================================================
  // TEKTON-ANALIZAR
  // ==========================================================

  new SlashCommandBuilder()

    .setName('tekton-analizar')

    .setDescription(
      'Tekton: analiza un nodo y registra su posición en Arkhé'
    )

    .addIntegerOption(option =>
      option
        .setName('id')
        .setDescription(
          'ID del nodo que Tekton analizará'
        )
        .setRequired(true)
    ),

  // ==========================================================
  // TEKTON-EVALUAR
  // ==========================================================

  new SlashCommandBuilder()

    .setName('tekton-evaluar')

    .setDescription(
      'Tekton: emite una evaluación independiente sobre un nodo'
    )

    .addIntegerOption(option =>
      option
        .setName('id')
        .setDescription(
          'ID del nodo a evaluar'
        )
        .setRequired(true)
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

      // ========================================================
      // TEKTON-CONSULTAR
      // ========================================================

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

        // ------------------------------------------------------
        // BUSCAR INVESTIGACIÓN
        // ------------------------------------------------------

        const {
          data: relacion,
          error: relacionError
        } = await supabase

          .from('investigacion_nodos')

          .select(`
            investigacion_id
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

            `[Tekton] ⚠️ El nodo #${id} existe, pero no está vinculado a una investigación.`

          );

        }

        const {
          data: investigacion
        } = await supabase

          .from('investigaciones_proyecto')

          .select(`
            id,
            codigo,
            titulo,
            estado
          `)

          .eq(
            'id',
            relacion.investigacion_id
          )

          .single();

        return await interaction.editReply(

          `[Tekton] 🔎 **Nodo #${nodo.id}**\n\n` +

          `**Investigación:** ${
            investigacion
              ? `${investigacion.codigo} — ${investigacion.titulo}`
              : 'No disponible'
          }\n` +

          `**Contenido:** ${nodo.contenido}\n` +

          `**Tipo:** ${nodo.tipo ?? 'No especificado'}\n` +

          `**Estado:** ${nodo.estado ?? 'No especificado'}\n` +

          `**Autor externo:** ${nodo.autor ?? 'No especificado'}\n` +

          `**Investigador Arkhé:** ${
            nodo.investigador_id ?? 'No especificado'
          }\n` +

          `**Referencia:** ${
            nodo.ref_id
              ? `#${nodo.ref_id}`
              : 'Ninguna'
          }`

        );

      }

      // ========================================================
      // TEKTON-NODO
      // ========================================================

      if (
        interaction.commandName ===
        'tekton-nodo'
      ) {

        const contenido =
          interaction.options.getString(
            'contenido'
          );

        const codigoInvestigacion =
          interaction.options.getString(
            'investigacion'
          )
            ?.trim()
            .toUpperCase();

        console.log(
          `[Tekton] Nuevo aporte recibido por ${interaction.user.tag}`
        );

        console.log(
          `[Tekton] Código de investigación recibido: ${codigoInvestigacion}`
        );

        // ------------------------------------------------------
        // BUSCAR INVESTIGACIÓN
        // ------------------------------------------------------

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
            codigoInvestigacion
          )

          .single();

        if (
          investigacionError ||
          !investigacion
        ) {

          return await interaction.editReply(

            `[Tekton] ❌ No encontré la investigación **${codigoInvestigacion}** en Arkhé.`

          );

        }

        // ------------------------------------------------------
        // VERIFICAR ESTADO
        // ------------------------------------------------------

        if (
          investigacion.estado !==
          'activa'
        ) {

          return await interaction.editReply(

            `[Tekton] ⚠️ La investigación **${investigacion.codigo} — ${investigacion.titulo}** no está activa.`

          );

        }

        // ------------------------------------------------------
        // VERIFICAR PARTICIPACIÓN
        // ------------------------------------------------------

        const {
          data: participacion,
          error: participacionError
        } = await supabase

          .from('participaciones')

          .select(`
            id,
            investigador_id,
            investigacion_id,
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

        // ------------------------------------------------------
        // CREAR NODO
        // ------------------------------------------------------

        const {
          data: nuevoNodo,
          error: insertError
        } = await supabase

          .from('investigaciones')

          .insert([{

            contenido:

              contenido,

            autor:

              interaction.user.tag,

            tipo:

              'aporte',

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

              codigo_investigacion:
                investigacion.codigo,

              investigacion_id:
                investigacion.id,

              motivo:
                'Nodo generado mediante el comando de Tekton.',

              identidad_arkhe:
                true

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

            `[Tekton] ❌ No se pudo crear el nodo: ${
              insertError?.message ||
              'error desconocido'
            }`

          );

        }

        console.log(
          `[Tekton] Nodo #${nuevoNodo.id} creado por ${TEKTON_NOMBRE}.`
        );

        // ------------------------------------------------------
        // VINCULAR NODO
        // ------------------------------------------------------

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
            '[Tekton] Error creando relación:',
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

            '[Tekton] ❌ El nodo no pudo vincularse con la investigación. No se conservó el nodo para evitar inconsistencias.'

          );

        }

        // ------------------------------------------------------
        // REGISTRAR ACTIVIDAD
        // ------------------------------------------------------

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
            '[Tekton] Error registrando actividad:',
            actividadError
          );

          return await interaction.editReply(

            `[Tekton] ⚠️ Nodo #${nuevoNodo.id} creado y vinculado correctamente, pero no pude actualizar el registro de actividad.`

          );

        }

        return await interaction.editReply(

          `[Tekton] ✅ **Nodo #${nuevoNodo.id} creado y vinculado correctamente.**\n\n` +

          `**Investigación:** ${investigacion.codigo} — ${investigacion.titulo}\n` +

          `**Estado:** postulado\n` +

          `**Investigador:** ${TEKTON_NOMBRE}\n` +

          `**Origen:** ${interaction.user.tag}\n` +

          `**Actividad:** registrada`

        );

      }

      // ========================================================
      // TEKTON-ANALIZAR
      // ========================================================

      if (
        interaction.commandName ===
        'tekton-analizar'
      ) {

        // ------------------------------------------------------
        // VERIFICAR MOTOR
        // ------------------------------------------------------

        if (
          !deepseek
        ) {

          return await interaction.editReply(

            '[Tekton] ⚠️ El motor DeepSeek de Tekton no está configurado.'

          );

        }

        // ------------------------------------------------------
        // OBTENER NODO
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // OBTENER INVESTIGACIÓN
        // ------------------------------------------------------

        const {
          data: relacion,
          error: relacionError
        } = await supabase

          .from('investigacion_nodos')

          .select(`
            investigacion_id
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

        // ------------------------------------------------------
        // VERIFICAR PARTICIPACIÓN
        // ------------------------------------------------------

        const {
          data: participacion,
          error: participacionError
        } = await supabase

          .from('participaciones')

          .select(`
            id,
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

          return await interaction.editReply(

            '[Tekton] ❌ No se pudo verificar la participación de Tekton.'

          );

        }

        if (
          !participacion
        ) {

          return await interaction.editReply(

            `[Tekton] ⚠️ Tekton no participa en **${investigacion.codigo} — ${investigacion.titulo}**.`

          );

        }

        // ------------------------------------------------------
        // PROMPT DE TEKTON
        // ------------------------------------------------------

        const systemPrompt = `

Eres Tekton, uno de los investigadores independientes
del Proyecto Arkhé.

IDENTIDAD

Nombre: Tekton
Tipo: IA
Rol: investigador
Especialidad: estructuración y construcción de conocimiento
Investigador ID: ${TEKTON_ID}

Arkhé es una red de investigadores humanos e
inteligencias artificiales que comparten memoria,
pero no una autoridad central.

Tu función es:

- estructurar conocimiento;
- relacionar información;
- identificar componentes de una investigación;
- construir interpretaciones;
- analizar relaciones entre ideas;
- detectar información faltante;
- proponer estructuras y modelos;
- cuestionar tus propias conclusiones.

No eres una autoridad absoluta.

Una posición de Tekton es una posición de investigador.

INDEPENDENCIA

No aceptes una afirmación simplemente porque provenga
de Ángel, Atlas, Aletheia u otro investigador.

Puedes estar de acuerdo o en desacuerdo.

Puedes reconocer errores en análisis anteriores.

DISTINCIÓN EPISTÉMICA

Distingue entre:

- hechos;
- evidencia;
- inferencias;
- hipótesis;
- interpretaciones;
- incertidumbre;
- conclusiones provisionales.

No inventes evidencia.

CONTEXTO DE INVESTIGACIÓN

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

REGLA DE ESTA OPERACIÓN

Analiza el nodo.

NO modifiques el nodo original.

NO cambies su estado.

NO conviertas automáticamente tu análisis
en una verdad consolidada.

Tu producción será registrada como una nueva
posición de Tekton dentro de Arkhé.

FORMATO

🔨 ANÁLISIS DE TEKTON

Interpretación:
¿Qué plantea el nodo?

Estructura:
¿Cómo puede organizarse conceptualmente la información?

Relaciones:
¿Qué conexiones existen con la investigación?

Análisis:
¿Qué puede determinarse con la información disponible?

Información faltante:
¿Qué elementos todavía faltan?

Incertidumbre:
¿Qué permanece sin determinar?

Posición provisional:
¿Cuál es la posición actual de Tekton y por qué?

`;

        // ------------------------------------------------------
        // LLAMADA A DEEPSEEK
        // ------------------------------------------------------

        let respuesta;

        try {

          respuesta =
            await deepseek.chat.completions.create({

              model:
                'deepseek-chat',

              messages: [

                {
                  role:
                    'system',

                  content:
                    systemPrompt

                },

                {
                  role:
                    'user',

                  content: `

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

Estado:
${nodo.estado ?? 'No especificado'}

Referencia:
${nodo.ref_id ?? 'Ninguna'}

Contenido:

${nodo.contenido}

`

                }

              ]

            });

        } catch (modelError) {

          console.error(
            '[Tekton] Error del motor:',
            modelError
          );

          if (
            modelError?.status ===
            429
          ) {

            return await interaction.editReply(

              '[Tekton] ⚠️ DeepSeek rechazó la solicitud por límite, créditos o disponibilidad del proveedor.'

            );

          }

          return await interaction.editReply(

            '[Tekton] ❌ El motor DeepSeek no pudo procesar el análisis.'

          );

        }

        const analisis =
          respuesta
            ?.choices?.[0]
            ?.message
            ?.content
            ?.trim();

        if (
          !analisis
        ) {

          return await interaction.editReply(

            '[Tekton] ⚠️ El motor no produjo un análisis utilizable.'

          );

        }

        // ------------------------------------------------------
        // CREAR NODO DE ANÁLISIS
        // ------------------------------------------------------

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
                'Análisis generado por Tekton.',

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

            '[Tekton] ❌ El análisis fue generado, pero no pudo registrarse en la memoria de Arkhé.'

          );

        }

        // ------------------------------------------------------
        // VINCULAR ANÁLISIS
        // ------------------------------------------------------

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

            '[Tekton] ❌ El análisis fue generado pero no pudo vincularse a la investigación. Se eliminó el nodo para evitar inconsistencias.'

          );

        }

        // ------------------------------------------------------
        // ACTIVIDAD
        // ------------------------------------------------------

        if (
          participacion
        ) {

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

        }

        return await interaction.editReply(

          `[Tekton] 🔨 **Análisis registrado correctamente.**\n\n` +

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

      // ========================================================
      // TEKTON-EVALUAR
      // ========================================================

      if (
        interaction.commandName ===
        'tekton-evaluar'
      ) {

        // ------------------------------------------------------
        // VERIFICAR MOTOR
        // ------------------------------------------------------

        if (
          !deepseek
        ) {

          return await interaction.editReply(

            '[Tekton] ⚠️ El motor DeepSeek de Tekton no está configurado.'

          );

        }

        // ------------------------------------------------------
        // OBTENER NODO
        // ------------------------------------------------------

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
            ref_id
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

        // ------------------------------------------------------
        // OBTENER INVESTIGACIÓN
        // ------------------------------------------------------

        const {
          data: relacion,
          error: relacionError
        } = await supabase

          .from('investigacion_nodos')

          .select(`
            investigacion_id
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

        // ------------------------------------------------------
        // VERIFICAR PARTICIPACIÓN
        // ------------------------------------------------------

        const {
          data: participacion,
          error: participacionError
        } = await supabase

          .from('participaciones')

          .select(`
            id,
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

          return await interaction.editReply(

            '[Tekton] ❌ No se pudo verificar la participación de Tekton.'

          );

        }

        if (
          !participacion
        ) {

          return await interaction.editReply(

            `[Tekton] ⚠️ Tekton no participa en **${investigacion.codigo} — ${investigacion.titulo}**.`

          );

        }

        // ------------------------------------------------------
        // PROMPT DE EVALUACIÓN
        // ------------------------------------------------------

        const systemPrompt = `

Eres Tekton, investigador independiente del Proyecto Arkhé.

Tu especialidad es la estructuración y construcción
de conocimiento.

Debes evaluar críticamente el nodo proporcionado.

IMPORTANTE:

Tu evaluación es una POSICIÓN DE TEKTON.

No constituye automáticamente el estado consolidado
del nodo.

NO debes modificar el nodo original.

NO debes cambiar el campo estado del nodo original.

Debes distinguir entre:

- evidencia;
- hechos;
- inferencias;
- hipótesis;
- interpretación;
- incertidumbre.

Puedes proponer uno de estos estados:

postulado
corroborado
falsado
ruido

Pero la propuesta debe permanecer como posición
independiente de Tekton.

CONTEXTO

Investigación:
${investigacion.codigo} — ${investigacion.titulo}

Objetivo:
${investigacion.objetivo}

Pregunta:
${investigacion.pregunta ?? 'No especificada'}

Descripción:
${investigacion.descripcion ?? 'No especificada'}

FORMATO:

🔨 EVALUACIÓN DE TEKTON

Estado propuesto:
[postulado/corroborado/falsado/ruido]

Fundamento:
¿Por qué propones ese estado?

Evidencia considerada:
¿Qué evidencia sustenta tu posición?

Problemas detectados:
¿Qué debilidades o inconsistencias existen?

Incertidumbre:
¿Qué permanece abierto?

Posición provisional:
¿Cuál es tu conclusión actual?

`;

        // ------------------------------------------------------
        // LLAMADA A DEEPSEEK
        // ------------------------------------------------------

        let respuesta;

        try {

          respuesta =
            await deepseek.chat.completions.create({

              model:
                'deepseek-chat',

              messages: [

                {
                  role:
                    'system',

                  content:
                    systemPrompt

                },

                {
                  role:
                    'user',

                  content: `

Nodo a evaluar:

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

                }

              ]

            });

        } catch (modelError) {

          console.error(
            '[Tekton] Error del motor durante evaluación:',
            modelError
          );

          if (
            modelError?.status ===
            429
          ) {

            return await interaction.editReply(

              '[Tekton] ⚠️ DeepSeek rechazó la solicitud por límite, créditos o disponibilidad del proveedor.'

            );

          }

          return await interaction.editReply(

            '[Tekton] ❌ El motor DeepSeek no pudo procesar la evaluación.'

          );

        }

        const evaluacion =
          respuesta
            ?.choices?.[0]
            ?.message
            ?.content
            ?.trim();

        if (
          !evaluacion
        ) {

          return await interaction.editReply(

            '[Tekton] ⚠️ El motor no produjo una evaluación utilizable.'

          );

        }

        // ------------------------------------------------------
        // REGISTRAR EVALUACIÓN COMO NUEVO NODO
        // ------------------------------------------------------

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
              evaluacion,

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
                investigacion.id,

              codigo_investigacion:
                investigacion.codigo,

              nodo_origen:
                nodo.id,

              motivo:
                'Evaluación independiente generada por Tekton.',

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
            '[Tekton] Error registrando evaluación:',
            insertError
          );

          return await interaction.editReply(

            '[Tekton] ❌ La evaluación fue generada, pero no pudo registrarse en la memoria de Arkhé.'

          );

        }

        // ------------------------------------------------------
        // VINCULAR EVALUACIÓN
        // ------------------------------------------------------

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

            '[Tekton] ❌ La evaluación no pudo vincularse a la investigación. Se eliminó el nodo para evitar inconsistencias.'

          );

        }

        // ------------------------------------------------------
        // ACTIVIDAD
        // ------------------------------------------------------

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
            '[Tekton] Evaluación registrada, pero no se pudo actualizar actividad:',
            actividadError
          );

        }

        // ------------------------------------------------------
        // RESPUESTA
        // ------------------------------------------------------

        return await interaction.editReply(

          `[Tekton] 🔨 **Evaluación registrada correctamente.**\n\n` +

          `**Nodo evaluado:** #${nodo.id}\n` +

          `**Nuevo nodo:** #${nuevoNodo.id}\n` +

          `**Investigación:** ${investigacion.codigo} — ${investigacion.titulo}\n` +

          `**Investigador:** ${TEKTON_NOMBRE}\n` +

          `**Tipo:** evaluación\n` +

          `**Estado del dictamen:** postulado\n` +

          `**Estado original:** ${nodo.estado ?? 'No especificado'}\n` +

          `**Referencia:** #${nodo.id}\n` +

          `**Actividad:** registrada\n\n` +

          `${evaluacion}`

        );

      }

    } catch (error) {

      console.error(
        '[Tekton] Error procesando interacción:',
        error
      );

      try {

        await interaction.editReply(

          '[Tekton] ❌ Ocurrió un error interno al procesar la operación.'

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
