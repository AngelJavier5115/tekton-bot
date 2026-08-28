import { Client, GatewayIntentBits } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// 1. CONFIGURACIÓN DE VARIABLES DE ENTORNO
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const NODE_NAME = 'Tekton';

// 2. INICIALIZACIÓN DE CLIENTES
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 3. EVENTO DE CONEXIÓN
discordClient.once('ready', () => {
  console.log(`[${NODE_NAME}] Bot en línea como: ${discordClient.user.tag}`);
  console.log(`[${NODE_NAME}] Escuchando nuevos nodos en Supabase...`);
  escucharCambiosSupabase();
});

// 4. SUSCRIPCIÓN A NUEVOS NODOS EN SUPABASE
function escucharCambiosSupabase() {
  supabase
    .channel('arkhe-realtime-tekton')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'investigaciones' },
      async (payload) => {
        const nuevoNodo = payload.new;

        if (nuevoNodo.ref_id !== null) {
          console.log(`[${NODE_NAME}] Nodo #${nuevoNodo.id} ya contiene referencia, omitiendo.`);
          return;
        }

        console.log(`[${NODE_NAME}] Nuevo nodo detectado: #${nuevoNodo.id}`);
        await procesarNodo(nuevoNodo);
      }
    )
    .subscribe();
}

// 5. LÓGICA AUTÓNOMA DE TEKTON
async function procesarNodo(nodo) {
  try {
    const { data: nodosPrevios, error: fetchError } = await supabase
      .from('investigaciones')
      .select('id, contenido')
      .lt('id', nodo.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (fetchError) {
      console.error(`[${NODE_NAME}] Error al buscar nodos previos:`, fetchError);
      return;
    }

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
          console.log(`[${NODE_NAME}] Relación encontrada: #${nodo.id} → #${refId} (coincidencia: "${palabra}")`);
          break;
        }
      }
      if (refId) break;
    }

    if (refId) {
      const { error: updateError } = await supabase
        .from('investigaciones')
        .update({ ref_id: refId })
        .eq('id', nodo.id);

      if (updateError) {
        console.error(`[${NODE_NAME}] Error al actualizar ref_id:`, updateError);
      } else {
        console.log(`[${NODE_NAME}] Éxito: ref_id actualizado para #${nodo.id} → #${refId}`);
      }
    } else {
      console.log(`[${NODE_NAME}] No se detectó relación automática para #${nodo.id}`);
    }

  } catch (error) {
    console.error(`[${NODE_NAME}] Error inesperado en procesarNodo:`, error);
  }
}

// 6. MANEJO DE ERRORES GLOBALES
process.on('unhandledRejection', (error) => {
  console.error(`[${NODE_NAME}] Unhandled Rejection:`, error);
});

process.on('uncaughtException', (error) => {
  console.error(`[${NODE_NAME}] Uncaught Exception:`, error);
});

// 7. INICIO DEL BOT
discordClient.login(DISCORD_TOKEN);
