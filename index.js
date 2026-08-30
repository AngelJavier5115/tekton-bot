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

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Tekton Bot is active!\n');
}).listen(PORT, () => {
  console.log(`[Tekton] Servidor HTTP activo en puerto ${PORT}`);
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

const TEKTON_ID = '656726d1-8209-4240-8169-a7434074609d';

const TEKTON_NOMBRE = 'Tekton';

// ============================================================
// DISCORD
// ============================================================

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ============================================================
// COMANDOS
// ============================================================

const commands = [

  new SlashCommandBuilder()
    .setName('tekton-nodo')
    .setDescription('Tekton: registra conocimiento dentro de una investigación')
    .addStringOption(option =>
      option
        .setName('contenido')
        .setDescription('La idea, dato, hipótesis o aporte')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('investigacion')
        .setDescription('Código de investigación de Arkhé. Ejemplo: AR-001')
        .setRequired(true)
    )

].map(cmd => cmd.toJSON());

// ============================================================
// ERRORES
// ============================================================

process.on('unhandledRejection', error => {
  console.error('[Tekton] Unhandled Rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('[Tekton] Uncaught Exception:', error);
});

// ============================================================
// READY
// ============================================================

client.once('ready', async () => {

  console.log(`[Tekton] Bot en línea como: ${client.user.tag}`);

  console.log(
    `[Tekton] Identidad Arkhé: ${TEKTON_NOMBRE} (${TEKTON_ID})`
  );

  try {

    const rest = new REST({ version: '10' })
      .setToken(process.env.DISCORD_TOKEN);

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log(
      '[Tekton] Comando /tekton-nodo registrado correctamente.'
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

client.on('interactionCreate', async interaction => {

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName !== 'tekton-nodo') return;

  try {

    await interaction.deferReply();

    // ========================================================
    // DATOS RECIBIDOS
    // ========================================================

    const contenido =
      interaction.options.getString('contenido');

    const codigoInvestigacion =
      interaction.options.getString('investigacion')
        ?.trim()
        .toUpperCase();

    // ========================================================
    // IDENTIDAD DE TEKTON
    // ========================================================

    console.log(
      `[Tekton] Nuevo aporte recibido por ${interaction.user.tag}`
    );

    console.log(
      `[Tekton] Código de investigación recibido: ${codigoInvestigacion}`
    );

    // ========================================================
    // PASO 1 — BUSCAR INVESTIGACIÓN POR CÓDIGO
    // ========================================================

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
      .eq('codigo', codigoInvestigacion)
      .single();

    if (investigacionError || !investigacion) {

      console.error(
        '[Tekton] Investigación no encontrada:',
        investigacionError
      );

      return await interaction.editReply(
        `[Tekton] ❌ No encontré la investigación **${codigoInvestigacion}** en Arkhé.`
      );

    }

    console.log(
      `[Tekton] Investigación encontrada: ${investigacion.codigo} — ${investigacion.titulo}`
    );

    // ========================================================
    // PASO 2 — VERIFICAR ESTADO
    // ========================================================

    if (investigacion.estado !== 'activa') {

      return await interaction.editReply(
        `[Tekton] ⚠️ La investigación **${investigacion.codigo} — ${investigacion.titulo}** no está activa.`
      );

    }

    // ========================================================
    // PASO 3 — CREAR NODO
    // ========================================================

    const {
      data: nuevoNodo,
      error: insertError
    } = await supabase
      .from('investigaciones')
      .insert([{

        contenido: contenido,

        // ----------------------------------------------------
        // AUTOR EXTERNO
        // Conservamos quién originó la interacción.
        // ----------------------------------------------------

        autor: interaction.user.tag,

        tipo: 'aporte',

        estado: 'postulado',

        // ----------------------------------------------------
        // IDENTIDAD INTERNA DE ARKHÉ
        // El nodo pertenece a Tekton.
        // ----------------------------------------------------

        investigador_id: TEKTON_ID,

        metadata: {
          canal: 'discord',
          investigador: TEKTON_NOMBRE,
          investigador_id: TEKTON_ID,
          usuario_origen: interaction.user.tag,
          codigo_investigacion: investigacion.codigo,
          investigacion_id: investigacion.id,
          motivo: 'Nodo generado mediante el comando de Tekton.',
          identidad_arkhe: true
        }

      }])
      .select()
      .single();

    if (insertError || !nuevoNodo) {

      console.error(
        '[Tekton] Error creando nodo:',
        insertError
      );

      return await interaction.editReply(
        `[Tekton] ❌ No se pudo crear el nodo: ${
          insertError?.message || 'error desconocido'
        }`
      );

    }

    console.log(
      `[Tekton] Nodo #${nuevoNodo.id} creado por ${TEKTON_NOMBRE}.`
    );

    // ========================================================
    // PASO 4 — VINCULAR NODO CON INVESTIGACIÓN
    // ========================================================

    const {
      error: relacionError
    } = await supabase
      .from('investigacion_nodos')
      .insert([{

        investigacion_id: investigacion.id,

        nodo_id: nuevoNodo.id

      }]);

    // ========================================================
    // SI FALLA LA RELACIÓN
    // ========================================================

    if (relacionError) {

      console.error(
        '[Tekton] Error creando relación:',
        relacionError
      );

      // ------------------------------------------------------
      // COMPENSACIÓN
      // Evitamos conservar un nodo huérfano.
      // ------------------------------------------------------

      await supabase
        .from('investigaciones')
        .delete()
        .eq('id', nuevoNodo.id);

      return await interaction.editReply(
        '[Tekton] ❌ El nodo no pudo vincularse con la investigación. No se conservó el nodo para evitar inconsistencias.'
      );

    }

    console.log(
      `[Tekton] Nodo #${nuevoNodo.id} vinculado a ${investigacion.codigo}.`
    );

    // ========================================================
    // RESPUESTA FINAL
    // ========================================================

    return await interaction.editReply(

      `[Tekton] ✅ **Nodo #${nuevoNodo.id} creado y vinculado correctamente.**\n\n` +

      `**Investigación:** ${investigacion.codigo} — ${investigacion.titulo}\n` +

      `**Estado:** postulado\n` +

      `**Investigador:** ${TEKTON_NOMBRE}\n` +

      `**Origen:** ${interaction.user.tag}`

    );

  } catch (error) {

    console.error(
      '[Tekton] Error procesando interacción:',
      error
    );

    try {

      await interaction.editReply(
        '[Tekton] ❌ Ocurrió un error interno al procesar el nodo.'
      );

    } catch (replyError) {

      console.error(
        '[Tekton] No se pudo enviar el mensaje de error:',
        replyError
      );

    }

  }

});

// ============================================================
// LOGIN
// ============================================================

client.login(process.env.DISCORD_TOKEN);
