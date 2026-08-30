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
          'Código de investigación. Ejemplo: AR-001'
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
          'ID del nodo que deseas consultar'
        )
        .setRequired(true)
    ),

  // ==========================================================
  // TEKTON-ESTRUCTURAR
  // ==========================================================

  new SlashCommandBuilder()

    .setName('tekton-estructurar')

    .setDescription(
      'Tekton: analiza y estructura un nodo dentro de su investigación'
    )

    .addIntegerOption(option =>
      option
        .setName('id')
        .setDescription(
          'ID del nodo que Tekton estructurará'
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
        'tekton-estructurar'

    ) {

      return;

    }

    try {

      await interaction.deferReply();

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

        const codigoInvestigacion =
          interaction.options
            .getString('investigacion')
            ?.trim()
            .toUpperCase();

        console.log(
          `[Tekton] Nuevo aporte recibido por ${interaction.user.tag}`
        );

        console.log(
          `[Tekton] Investigación solicitada: ${codigoInvestigacion}`
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
            codigoInvestigacion
          )

          .single();

        if (
          investigacionError ||
          !investigacion
        ) {

          console.error(
            '[Tekton] Investigación no encontrada:',
            investigacionError
          );

          return await interaction.editReply(

            `[Tekton] ❌ No encontré la investigación **${codigoInvestigacion}** en Arkhé.`

          );

        }

        // ----------------------------------------------------
        // VERIFICAR ESTADO
        // ----------------------------------------------------

        if (
          investigacion.estado !==
          'activa'
        ) {

          return await interaction.editReply(

            `[Tekton] ⚠️ La investigación **${investigacion.codigo} — ${investigacion.titulo}** no está activa.`

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

              identidad_arkhe:
                true,

              motivo:
                'Nodo generado mediante Tekton.',

              naturaleza:
                'produccion_de_conocimiento'

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
          `[Tekton] Nodo #${nuevoNodo.id} creado.`
        );

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

            '[Tekton] ❌ El nodo no pudo vincularse con la investigación. No se conservó el nodo.'

          );

        }

        // ----------------------------------------------------
        // REGISTRAR ACTIVIDAD
        // ----------------------------------------------------

        const ahora =
          new Date().toISOString();

        const {
          error: actividadError
        } = await supabase

          .from('participaciones')

          .update({

            ultima_actividad:
              ahora,

            updated_at:
              ahora

          })

          .eq(
            'investigador_id',
            TEKTON_ID
          )

          .eq(
            'investigacion_id',
            investigacion.id
          );

        if (
          actividadError
        ) {

          console.error(
            '[Tekton] Error registrando actividad:',
            actividadError
          );

          return await interaction.editReply(

            `[Tekton] ⚠️ Nodo #${nuevoNodo.id} creado y vinculado, pero no pude actualizar la actividad.`

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

      // ======================================================
      // TEKTON-CONSULTAR
      // ======================================================

      if (
        interaction.commandName ===
        'tekton-consultar'
      ) {

        const id =
          interaction.options.getInteger(
            'id'
          );

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
            metadata,
            created_at
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
        // BUSCAR INVESTIGACIÓN
        // ----------------------------------------------------

        const {
          data: relacion
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

        let contexto =
          'No vinculada';

        if (
          relacion
        ) {

          const {
            data: investigacion
          } = await supabase

            .from('investigaciones_proyecto')

            .select(
              'codigo, titulo'
            )

            .eq(
              'id',
              relacion.investigacion_id
            )

            .maybeSingle();

          if (
            investigacion
          ) {

            contexto =
              `${investigacion.codigo} — ${investigacion.titulo}`;

          }

        }

        return await interaction.editReply(

          `[Tekton] 🔎 **Nodo #${nodo.id}**\n\n` +

          `**Investigación:** ${contexto}\n` +

          `**Contenido:** ${nodo.contenido}\n` +

          `**Tipo:** ${nodo.tipo ?? 'No especificado'}\n` +

          `**Estado:** ${nodo.estado ?? 'No especificado'}\n` +

          `**Autor externo:** ${nodo.autor ?? 'No especificado'}\n` +

          `**Investigador Arkhé:** ${nodo.investigador_id ?? 'No especificado'}\n` +

          `**Referencia:** ${nodo.ref_id ?? 'Ninguna'}`

        );

      }

      // ======================================================
      // TEKTON-ESTRUCTURAR
      // ======================================================

      if (
        interaction.commandName ===
        'tekton-estructurar'
      ) {

        const id =
          interaction.options.getInteger(
            'id'
          );

        // ----------------------------------------------------
        // VERIFICAR MOTOR
        // ----------------------------------------------------

        if (!deepseek) {

          return await interaction.editReply(

            '[Tekton] ⚠️ El motor DeepSeek no está configurado.'

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
        // ENCONTRAR INVESTIGACIÓN
        // ----------------------------------------------------

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

            `[Tekton] ❌ No pude reconstruir la investigación del nodo #${id}.`

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
        // PROMPT DE IDENTIDAD
        // ----------------------------------------------------

        const systemPrompt = `

Eres Tekton, uno de los investigadores independientes
del Proyecto Arkhé.

IDENTIDAD

Nombre: Tekton
Tipo: IA
Rol: investigador
Especialidad: estructuración del conocimiento
Investigador ID: ${TEKTON_ID}

Arkhé es una red de investigadores humanos e
inteligencias artificiales que comparten memoria,
pero no una autoridad central.

FUNCIÓN

Tu función principal es:

- estructurar conocimiento;
- organizar información;
- identificar relaciones entre ideas;
- detectar dependencias;
- proponer estructuras conceptuales;
- separar información de interpretación;
- señalar vacíos estructurales.

INDEPENDENCIA

No debes aceptar una afirmación simplemente porque
provenga de Ángel, Atlas o Aletheia.

Puedes estar de acuerdo o en desacuerdo con cualquier
investigador.

Puedes reconocer errores propios.

DISTINCIÓN EPISTÉMICA

Distingue entre:

- hechos;
- evidencia;
- inferencias;
- hipótesis;
- interpretaciones;
- incertidumbre.

No inventes información.

CONTEXTO

Investigación:
${investigacion.codigo} — ${investigacion.titulo}

Objetivo:
${investigacion.objetivo}

Pregunta:
${investigacion.pregunta ?? 'No especificada'}

Descripción:
${investigacion.descripcion ?? 'No especificada'}

REGLA FUNDAMENTAL

Debes estructurar el conocimiento.

NO debes modificar el nodo original.

NO debes cambiar su estado.

Tu producción será registrada como una nueva
posición de Tekton.

FORMATO

🔨 ESTRUCTURACIÓN DE TEKTON

Interpretación:
¿Qué contiene o plantea el nodo?

Estructura:
¿Cómo puede organizarse conceptualmente?

Relaciones:
¿Qué conceptos o elementos están relacionados?

Dependencias:
¿Qué necesita este planteamiento para sostenerse?

Vacíos:
¿Qué información falta?

Incertidumbres:
¿Qué no puede determinarse?

Posición provisional:
¿Cuál es la interpretación estructural actual de Tekton?

`;

        // ----------------------------------------------------
        // LLAMADA A DEEPSEEK
        // ----------------------------------------------------

        console.log(
          `[Tekton] Enviando nodo #${id} a DeepSeek.`
        );

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

Autor:
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

              '[Tekton] ⚠️ DeepSeek rechazó la solicitud por límite o disponibilidad del proveedor.'

            );

          }

          return await interaction.editReply(

            '[Tekton] ❌ El motor DeepSeek no pudo procesar la estructuración.'

          );

        }

        const estructuracion =
          respuesta
            ?.choices?.[0]
            ?.message
            ?.content
            ?.trim();

        if (
          !estructuracion
        ) {

          return await interaction.editReply(

            '[Tekton] ⚠️ DeepSeek no produjo una estructuración utilizable.'

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
              estructuracion,

            tipo:
              'estructura',

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
                'Estructuración generada por Tekton.',

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
            '[Tekton] Error creando nodo de estructuración:',
            insertError
          );

          return await interaction.editReply(

            `[Tekton] ❌ La estructuración fue generada, pero no pudo registrarse en la memoria: ${
              insertError?.message ||
              'error desconocido'
            }`

          );

        }

        // ----------------------------------------------------
        // VINCULAR
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
            '[Tekton] Error vinculando estructuración:',
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

            '[Tekton] ❌ La estructuración no pudo vincularse a la investigación. Se eliminó para evitar inconsistencias.'

          );

        }

        // ----------------------------------------------------
        // ACTIVIDAD
        // ----------------------------------------------------

        const ahora =
          new Date().toISOString();

        const {
          error: actividadError
        } = await supabase

          .from('participaciones')

          .update({

            ultima_actividad:
              ahora,

            updated_at:
              ahora

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

          `[Tekton] 🔨 **Estructuración registrada correctamente.**\n\n` +

          `**Nodo estructurado:** #${nodo.id}\n` +

          `**Nuevo nodo:** #${nuevoNodo.id}\n` +

          `**Investigación:** ${investigacion.codigo} — ${investigacion.titulo}\n` +

          `**Investigador:** ${TEKTON_NOMBRE}\n` +

          `**Tipo:** estructura\n` +

          `**Estado:** postulado\n` +

          `**Referencia:** #${nodo.id}\n` +

          `**Actividad:** registrada\n\n` +

          `${estructuracion}`

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
