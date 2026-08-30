import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import http from 'http';

// ============================================================
// TEKTON — NODO DE ESTRUCTURACIÓN DE ARKHÉ
// ============================================================

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
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
        .setDescription('UUID de la investigación de Arkhé')
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

  try {

    const rest = new REST({ version: '10' })
      .setToken(process.env.DISCORD_TOKEN);

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log('[Tekton] Comando /tekton-nodo registrado correctamente.');

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

    const contenido =
      interaction.options.getString('contenido');

    const investigacionId =
      interaction.options.getString('investigacion');

    // ========================================================
    // IDENTIDAD DE TEKTON
    // ========================================================

    console.log(
      `[Tekton] Nuevo aporte recibido por ${interaction.user.tag}`
    );

    console.log(
      `[Tekton] Investigación objetivo: ${investigacionId}`
    );

    // ========================================================
    // PASO 1 — VERIFICAR INVESTIGACIÓN
    // ========================================================

    const {
      data: investigacion,
      error: investigacionError
    } = await supabase
      .from('investigaciones_proyecto')
      .select('id, titulo, objetivo, pregunta, estado')
      .eq('id', investigacionId)
      .single();

    if (investigacionError || !investigacion) {

      console.error(
        '[Tekton] Investigación no encontrada:',
        investigacionError
      );

      return await interaction.editReply(
        '[Tekton] ❌ La investigación indicada no existe.'
      );

    }

    // ========================================================
    // PASO 2 — VERIFICAR ESTADO DE INVESTIGACIÓN
    // ========================================================

    if (investigacion.estado !== 'activa') {

      return await interaction.editReply(
        `[Tekton] ⚠️ La investigación **${investigacion.titulo}** no está activa.`
      );

    }

    // ========================================================
    // PASO 3 — CREAR NODO DE CONOCIMIENTO
    // ========================================================

    const {
      data: nuevoNodo,
      error: insertError
    } = await supabase
      .from('investigaciones')
      .insert([{

        contenido: contenido,

        autor: interaction.user.tag,

        tipo: 'aporte',

        estado: 'postulado'

      }])
      .select()
      .single();

    if (insertError || !nuevoNodo) {

      console.error(
        '[Tekton] Error creando nodo:',
        insertError
      );

      return await interaction.editReply(
        `[Tekton] ❌ No se pudo crear el nodo: ${insertError?.message || 'error desconocido'}`
      );

    }

    console.log(
      `[Tekton] Nodo #${nuevoNodo.id} creado.`
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

    if (relacionError) {

      console.error(
        '[Tekton] Error creando relación:',
        relacionError
      );

      // ------------------------------------------------------
      // COMPENSACIÓN
      // Si el nodo se creó pero no pudo vincularse,
      // intentamos eliminarlo para evitar nodos huérfanos.
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
      `[Tekton] Nodo #${nuevoNodo.id} vinculado a investigación ${investigacion.id}.`
    );

    // ========================================================
    // RESPUESTA
    // ========================================================

    return await interaction.editReply(
      `[Tekton] ✅ **Nodo #${nuevoNodo.id} creado y vinculado correctamente.**\n\n` +
      `**Investigación:** ${investigacion.titulo}\n` +
      `**Estado:** postulado\n` +
      `**Autor:** ${interaction.user.tag}`
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
