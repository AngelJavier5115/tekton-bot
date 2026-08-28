import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import http from 'http';

// ============================================================
// SERVIDOR HTTP OBLIGATORIO PARA MANTENER VIVO EL BOT EN RENDER
// ============================================================
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Tekton Bot is active!\n');
}).listen(PORT, () => {
  console.log(`[Tekton] Servidor HTTP activo en puerto ${PORT}`);
});

// ============================================================
// CONEXIÓN A SUPABASE
// ============================================================
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ============================================================
// CONEXIÓN OPCIONAL A DEEPSEEK (EVITA CRASH SI NO HAY API KEY)
// ============================================================
const deepseek = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey: process.env.DEEPSEEK_API_KEY })
  : null;

// ============================================================
// INICIALIZACIÓN DEL CLIENTE DE DISCORD
// ============================================================
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ============================================================
// REGISTRO DE COMANDOS SLASH
// ============================================================
const commands = [
  new SlashCommandBuilder()
    .setName('tekton-nodo')
    .setDescription('Tekton: Registra y estructura un nuevo nodo en la red')
    .addStringOption(option =>
      option.setName('contenido')
        .setDescription('La idea o dato a estructurar')
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

// ============================================================
// MANEJO DE ERRORES GLOBALES
// ============================================================
process.on('unhandledRejection', error => {
  console.error('[Tekton] Unhandled Rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('[Tekton] Uncaught Exception:', error);
});

// ============================================================
// EVENTO READY
// ============================================================
client.once('ready', async () => {
  console.log(`[Tekton] Bot en línea como: ${client.user.tag}`);
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('[Tekton] Comando /tekton-nodo registrado exitosamente.');
  } catch (e) {
    console.error('[Tekton] Error al registrar comando:', e);
  }
});

// ============================================================
// LÓGICA PRINCIPAL: PROCESAR NUEVOS NODOS
// ============================================================
client.on('interactionCreate', async interaction => {
  // Verificar que sea un comando de chat
  if (!interaction.isChatInputCommand()) return;

  // Solo responder al comando /tekton-nodo
  if (interaction.commandName !== 'tekton-nodo') return;

  try {
    await interaction.deferReply();

    // Verificar que la API Key de DeepSeek esté configurada
    if (!deepseek) {
      return await interaction.editReply('[Tekton] ⚠️ La API Key de DeepSeek aún no ha sido configurada.');
    }

    // Obtener el contenido del nodo
    const contenido = interaction.options.getString('contenido');

    // --- PASO 1: Insertar el nuevo nodo en Supabase ---
    const { data: nuevoNodo, error: insertError } = await supabase
      .from('investigaciones')
      .insert([{
        contenido: contenido,
        autor: interaction.user.tag,
        tipo: 'aporte',
        estado: 'pendiente'
      }])
      .select();

    if (insertError) {
      console.error('[Tekton] Error al insertar nodo:', insertError);
      return await interaction.editReply(`[Tekton] ❌ Error en base de datos: ${insertError.message}`);
    }

    const nodoId = nuevoNodo[0].id;
    console.log(`[Tekton] Nodo #${nodoId} insertado. Buscando relaciones...`);

    // --- PASO 2: Buscar nodos previos para encontrar relaciones ---
    const { data: nodosPrevios, error: fetchError } = await supabase
      .from('investigaciones')
      .select('id, contenido')
      .lt('id', nodoId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (fetchError) {
      console.error('[Tekton] Error al buscar nodos previos:', fetchError);
      return await interaction.editReply(`[Tekton] ✅ Nodo #${nodoId} creado, pero no se pudo buscar relaciones.`);
    }

    // --- PASO 3: Identificar relación conceptual (palabras clave) ---
    let refId = null;
    const palabrasClave = contenido
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .split(/\s+/)
      .filter(p => p.length > 3);

    // Recorrer nodos previos buscando coincidencias
    for (const previo of nodosPrevios || []) {
      const contenidoPrevio = previo.contenido.toLowerCase();
      for (const palabra of palabrasClave) {
        if (contenidoPrevio.includes(palabra)) {
          refId = previo.id;
          console.log(`[Tekton] Relación encontrada: #${nodoId} → #${refId} (coincidencia: "${palabra}")`);
          break;
        }
      }
      if (refId) break;
    }

    // --- PASO 4: Actualizar ref_id si se encontró relación ---
    if (refId) {
      const { error: updateError } = await supabase
        .from('investigaciones')
        .update({ ref_id: refId })
        .eq('id', nodoId);

      if (updateError) {
        console.error('[Tekton] Error al actualizar ref_id:', updateError);
        await interaction.editReply(`[Tekton] ✅ Nodo #${nodoId} creado, pero no se pudo asignar la relación.`);
      } else {
        await interaction.editReply(`[Tekton] ✅ **Nodo #${nodoId} estructurado y relacionado con #${refId}.**`);
      }
    } else {
      await interaction.editReply(`[Tekton] ✅ **Nodo #${nodoId} creado. No se detectaron relaciones previas.**`);
    }

  } catch (err) {
    console.error('[Tekton] Error en interacción:', err);
    await interaction.editReply('[Tekton] ❌ Ocurrió un error interno.');
  }
});

// ============================================================
// INICIO DEL BOT
// ============================================================
client.login(process.env.DISCORD_TOKEN);
