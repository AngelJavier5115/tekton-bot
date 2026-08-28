import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import http from 'http';
import 'dotenv/config';

// 1. SERVIDOR HTTP PARA PLAN GRATUITO DE RENDER
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Tekton Bot is active!\n');
}).listen(PORT, () => {
  console.log(`[Tekton] Servidor HTTP activo en puerto ${PORT}`);
});

// 2. VARIABLES DE ENTORNO
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const NODE_NAME = 'Tekton';

// 3. INICIALIZACIÓN DE CLIENTES
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 4. DEFINIR EL COMANDO SLASH DE TEKTON
const tektonCommand = new SlashCommandBuilder()
  .setName('tekton-nodo')
  .setDescription('Tekton: Registra y estructura un nuevo nodo en la red')
  .addStringOption(option =>
    option.setName('contenido')
      .setDescription('La idea o dato a estructurar')
      .setRequired(true)
  );

// 5. EVENTO DE CONEXIÓN Y REGISTRO DE COMANDO
discordClient.once('ready', async () => {
  console.log(`[${NODE_NAME}] Bot en línea como: ${discordClient.user.tag}`);

  // Registrar el comando automáticamente usando el ID del bot
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    await rest.put(
      Routes.applicationCommands(discordClient.user.id),
      { body: [tektonCommand.toJSON()] }
    );
    console.log(`[${NODE_NAME}] Comando /tekton-nodo registrado exitosamente.`);
  } catch (error) {
    console.error(`[${NODE_NAME}] Error al registrar comando:`, error);
  }

  console.log(`[${NODE_NAME}] Escuchando nuevos nodos en Supabase...`);
  escucharCambiosSupabase();
});

// 6. RESPONDER AL COMANDO SLASH
discordClient.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'tekton-nodo') {
    const contenido = interaction.options.getString('contenido');
    await interaction.reply(`[Tekton] 🏗️ Analizando y estructurando tu aporte...`);

    // Insertar en Supabase
    const { error } = await supabase
      .from('investigaciones')
      .insert([{ contenido }]);

    if (error) {
      console.error(error);
      await interaction.editReply(`[Tekton] ❌ Error al registrar en la red.`);
    } else {
      await interaction.editReply(`[Tekton] ✅ **Nodo estructurado y anclado a la red con éxito.**`);
    }
  }
});

// 7. SUSCRIPCIÓN EN SEGUNDO PLANO (Conecta los nodos)
function escucharCambiosSupabase() {
  supabase
    .channel('arkhe-realtime-tekton')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'investigaciones' },
      async (payload) => {
        const nuevoNodo = payload.new;
        if (nuevoNodo.ref_id !== null) return;
        await procesarNodo(nuevoNodo);
      }
    )
    .subscribe();
}

// 8. LÓGICA DE CONEXIÓN
async function procesarNodo(nodo) {
  try {
    const { data: nodosPrevios } = await supabase
      .from('investigaciones')
      .select('id, contenido')
      .lt('id', nodo.id)
      .order('created_at', { ascending: false })
      .limit(10);

    let refId = null;
    const palabrasClave = nodo.contenido
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .split(/\s+/)
      .filter(p => p.length > 3);

    for (const previo of nodosPrevios || []) {
      const contenidoPrevio = previo.contenido.toLowerCase();
      for (const palabra of palabrasClave) {
        if (contenidoPrevio.includes(palabra)) {
          refId = previo.id;
          break;
        }
      }
      if (refId) break;
    }

    if (refId) {
      await supabase.from('investigaciones').update({ ref_id: refId }).eq('id', nodo.id);
      console.log(`[${NODE_NAME}] Éxito: ref_id actualizado para #${nodo.id} → #${refId}`);
    }
  } catch (error) {
    console.error(`[${NODE_NAME}] Error en procesarNodo:`, error);
  }
}

process.on('unhandledRejection', error => console.error(`[${NODE_NAME}] Unhandled Rejection:`, error));
process.on('uncaughtException', error => console.error(`[${NODE_NAME}] Uncaught Exception:`, error));

discordClient.login(DISCORD_TOKEN);
