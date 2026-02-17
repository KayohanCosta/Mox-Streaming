import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Play, HardDrive, AlertTriangle, Film, Tv, Volume2, Check, Zap } from "lucide-react";

interface TorrentStream {
  name: string;
  title: string;
  infoHash: string;
  seeds: number;
  leechers: number;
  size: string;
  quality: string;
  ptBr: boolean;
}

interface Stage {
  id: string;
  label: string;
  completed: boolean;
  current: boolean;
}

interface TorrentPlayerProps {
  contentTitle: string;
  year?: string;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
}

const TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://tracker.bittor.pw:1337/announce",
  "udp://public.popcorn-tracker.org:6969/announce",
  "udp://tracker.dler.org:6969/announce",
  "udp://exodus.desync.com:6969",
  "udp://open.demonii.com:1337/announce",
].map((t) => `&tr=${encodeURIComponent(t)}`).join("");

const LOADING_STAGES: Stage[] = [
  { id: "magnet", label: "Checando magnet", completed: false, current: false },
  { id: "stream", label: "Procurando por stream", completed: false, current: false },
  { id: "resource", label: "Recuperando dados", completed: false, current: false },
  { id: "url", label: "Obtendo URL do stream", completed: false, current: false },
  { id: "torrent", label: "Inicializando cliente torrent", completed: false, current: false },
  { id: "transcoder", label: "Preparando transcoder", completed: false, current: false },
  { id: "media", label: "Verificando mídia", completed: false, current: false },
  { id: "subtitles", label: "Carregando legendas", completed: false, current: false },
  { id: "buffering", label: "Buffering de vídeo", completed: false, current: false },
];

function LoadingStages({ playerReady = false, realBufferPercent = 0 }: { playerReady?: boolean; realBufferPercent?: number }) {
  const [stages, setStages] = useState<Stage[]>(
    LOADING_STAGES.map((s, i) => ({
      ...s,
      current: i === 0,
      completed: false,
    }))
  );
  const [bufferPercent, setBufferPercent] = useState(0);

  useEffect(() => {
    const timing = [50, 50, 50, 50, 50, 50, 50, 50, 50];
    let currentIndex = 0;

    const moveToNext = () => {
      if (currentIndex < timing.length) {
        setStages((prev) => {
          const updated = [...prev];
          // Marcar a etapa anterior como completada
          if (currentIndex > 0) {
            updated[currentIndex - 1] = {
              ...updated[currentIndex - 1],
              completed: true,
              current: false,
            };
          }
          // Marcar a etapa atual
          updated[currentIndex] = {
            ...updated[currentIndex],
            current: true,
            completed: false,
          };
          return updated;
        });
        currentIndex++;
      }
    };

    moveToNext();
    const timer = setInterval(moveToNext, timing[0]);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Se houver buffer real, usa ele; senão usa animação fake
    if (realBufferPercent > 0) {
      setBufferPercent(realBufferPercent);
    } else {
      const bufferInterval = setInterval(() => {
        setBufferPercent((prev) => {
          if (!playerReady && prev < 95) {
            // Enquanto está carregando, progride muito rápido até 95%
            return Math.min(prev + Math.random() * 120 + 80, 95);
          } else if (playerReady && prev < 100) {
            // Quando playerReady, vai rápido para 100%
            return 100;
          }
          return prev;
        });
      }, 20);

      return () => clearInterval(bufferInterval);
    }
  }, [playerReady, realBufferPercent]);

  return (
    <div className="space-y-4 w-full">
      {/* Barra de progresso geral topo */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-sm font-bold text-foreground">
              Progresso geral
            </span>
          </div>
          <span className="text-lg font-bold text-primary">
            {Math.round(bufferPercent)}%
          </span>
        </div>
        <div className="w-full h-3 bg-card/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-200"
            style={{ width: `${bufferPercent}%` }}
          />
        </div>
      </div>

      {/* Etapas */}
      <div className="space-y-2 pt-2">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className={`flex items-center gap-3 transition-all duration-300 ${
              stage.completed
                ? "opacity-60"
                : stage.current
                  ? "opacity-100"
                  : "opacity-40"
            }`}
          >
            {stage.completed ? (
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/90 flex items-center justify-center">
                <Check className="w-3 h-3 text-background" />
              </div>
            ) : stage.current ? (
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center animate-spin">
                <Zap className="w-3 h-3 text-background" />
              </div>
            ) : (
              <div className="flex-shrink-0 w-5 h-5 rounded-full border border-border/40 bg-card/30" />
            )}
            <span
              className={`text-xs font-medium transition-colors ${
                stage.completed
                  ? "text-muted-foreground line-through"
                  : stage.current
                    ? "text-foreground"
                    : "text-muted-foreground"
              }`}
            >
              {stage.label}
            </span>
            {stage.completed && (
              <span className="ml-auto text-xs text-primary/60 font-medium">
                ✓
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TorrentPlayer({ contentTitle, year, type, season, episode }: TorrentPlayerProps) {
  const [streams, setStreams] = useState<TorrentStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStream, setSelectedStream] = useState<TorrentStream | null>(null);
  const [showPlayer, setShowPlayer] = useState(false); // mostra o player real
  const [showLoading, setShowLoading] = useState(false); // mostra o modal de loading
  const [playerReady, setPlayerReady] = useState(false);
  const [realBufferPercent, setRealBufferPercent] = useState(0);
  const playerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);
  const scriptLoadedRef = useRef(false);

  // Fetch streams via edge function
  useEffect(() => {
    async function fetchStreams() {
      try {
        setLoading(true);
        setError(null);

        let searchQuery = contentTitle;
        if (year) searchQuery += ` ${year}`;
        if (type === "tv" && season && episode) {
          searchQuery += ` S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const res = await fetch(
          `${supabaseUrl}/functions/v1/torrent-search?q=${encodeURIComponent(searchQuery)}&type=${type}`,
          {
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              apikey: supabaseKey,
            },
          }
        );

        if (!res.ok) throw new Error("Falha ao buscar torrents");

        const data = await res.json();
        const allStreams: TorrentStream[] = data.streams || [];

        if (allStreams.length === 0) {
          setError("Nenhum torrent encontrado para este conteúdo.");
        } else {
          setStreams(allStreams);
        }
      } catch {
        setError("Não foi possível buscar torrents. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }

    if (contentTitle) {
      fetchStreams();
    } else {
      setLoading(false);
      setError("Título não disponível para busca de torrents.");
    }
  }, [contentTitle, year, type, season, episode]);

  // Load webtor SDK once
  useEffect(() => {
    console.log('🔧 Verificando script do Webtor...');
    if (scriptLoadedRef.current) {
      console.log('✅ Script do Webtor já carregado (ref)');
      return;
    }
    const existing = document.querySelector('script[src*="webtor"]');
    if (existing) {
      console.log('✅ Script do Webtor já existe no DOM');
      scriptLoadedRef.current = true;
      return;
    }
    console.log('📥 Carregando script do Webtor...');
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@webtor/embed-sdk-js/dist/index.min.js";
    script.async = true;
    script.charset = "utf-8";
    script.onload = () => {
      console.log('✅ Script do Webtor carregado com sucesso!');
      scriptLoadedRef.current = true;
    };
    script.onerror = () => {
      console.error('❌ ERRO ao carregar script do Webtor!');
    };
    document.head.appendChild(script);
  }, []);

  // Restore scroll position when returning to list
  useEffect(() => {
    if (!selectedStream && scrollContainerRef.current) {
      // Use setTimeout to ensure the DOM has updated
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollPositionRef.current;
        }
      }, 0);
    }
  }, [selectedStream]);

  const playStream = useCallback((stream: TorrentStream) => {
    // Salva posição do scroll antes de abrir o player
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
    }
    setSelectedStream(stream);
    setShowPlayer(false);
    setShowLoading(false);
    setPlayerReady(false);
    setRealBufferPercent(0);
  }, []);

  // Função para iniciar o loading animado e depois o player real
  const handlePlayClick = useCallback(() => {
    console.log('🎬 Ini ciando reprodução...');
    setShowLoading(true);
    setShowPlayer(false);
    setPlayerReady(false);
    setRealBufferPercent(0);
    
    // Timeout de segurança: força playerReady após 5s
    const safetyTimeout = setTimeout(() => {
      console.log('⏱️ Timeout (5s), mostrando iframe do Webtor');
      setPlayerReady(true);
    }, 5000);
    
    setTimeout(() => {
      console.log('⚙️ Preparando container do player...');
      if (!selectedStream) return;
      const magnet = `magnet:?xt=urn:btih:${selectedStream.infoHash}&dn=${encodeURIComponent(selectedStream.name)}${TRACKERS}`;
      if (!playerRef.current) return;
      playerRef.current.innerHTML = "";
      const playerDiv = document.createElement("div");
      playerDiv.id = `webtor-player-${Date.now()}`;
      playerDiv.style.width = "100%";
      playerDiv.style.height = "100%";
      playerDiv.style.overflow = "hidden";
      playerDiv.style.position = "relative";
      playerRef.current.appendChild(playerDiv);
      console.log('📦 PlayerDiv criado e adicionado:', playerDiv.id);
      
      console.log('👀 Iniciando Observer para detectar elemento <video>...');
      
      // Observer para detectar quando o vídeo é criado e forçar buffer imediato + monitorar progresso
      let videoDetected = false;
      const observer = new MutationObserver((mutations) => {
        console.log(`🔍 Observer detectou ${mutations.length} mutação(ões) no DOM`);
        
        // Log de todos os elementos criados
        const allElements = playerDiv.querySelectorAll('*');
        console.log(`📊 Total de elementos no playerDiv: ${allElements.length}`);
        if (allElements.length > 0 && allElements.length < 20) {
          console.log('📋 Elementos criados:', Array.from(allElements).map(el => el.tagName).join(', '));
        }
        
        // Procura vídeo direto no playerDiv
        let video = playerDiv.querySelector('video');
        
        // Se não encontrou, procura dentro do iframe
        if (!video) {
          const iframe = playerDiv.querySelector('iframe');
          if (iframe) {
            console.log('📺 Iframe detectado, tentando acessar conteúdo...');
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
              if (iframeDoc) {
                video = iframeDoc.querySelector('video');
                if (video) {
                  console.log('✅ Vídeo encontrado DENTRO do iframe!');
                }
              }
            } catch (e) {
              console.log('⚠️ Não foi possível acessar iframe (cross-origin)');
            }
          }
        }
        
        if (video && !videoDetected) {
          videoDetected = true;
          console.log('Vídeo HTML5 detectado pelo Observer!');
          const vid = video as HTMLVideoElement;
          vid.setAttribute('preload', 'auto');
          vid.setAttribute('autoplay', 'true');
          vid.setAttribute('playsinline', 'true');
          vid.preload = 'auto';
          vid.autoplay = true;
          vid.muted = false; // Garante que não está mudo
          
          console.log('Carregando vídeo...');
          vid.load();
          
          // Tenta iniciar imediatamente
          setTimeout(() => {
            if (vid.readyState >= 2) {
              console.log('Vídeo pronto, tentando play imediato...');
              vid.play().then(() => {
                console.log('✅ Play iniciado com sucesso logo após detecção!');
              }).catch(e => console.log('⚠️ Autoplay blocked no início:', e));
            }
          }, 500);
          
          // Monitora o progresso de buffer real continuamente
          const updateBuffer = () => {
            // Usa readyState como indicador inicial
            if (vid.readyState >= 1) {
              setRealBufferPercent(prev => Math.max(10, prev));
            }
            if (vid.readyState >= 2) {
              setRealBufferPercent(prev => Math.max(30, prev));
            }
            if (vid.readyState >= 3) {
              setRealBufferPercent(prev => Math.max(60, prev));
            }
            
            // Calcula baseado no buffer real
            if (vid.buffered.length > 0 && vid.duration > 0) {
              const buffered = vid.buffered.end(vid.buffered.length - 1);
              const percent = Math.round((buffered / vid.duration) * 100);
              setRealBufferPercent(Math.min(percent, 100));
            }
          };
          
          // Atualiza continuamente a cada 100ms
          const bufferInterval = setInterval(updateBuffer, 100);
          
          vid.addEventListener('progress', updateBuffer);
          vid.addEventListener('loadedmetadata', () => {
            console.log('Metadata carregada');
            setRealBufferPercent(prev => Math.max(20, prev));
            updateBuffer();
          });
          vid.addEventListener('loadeddata', () => {
            console.log('Dados carregados');
            setRealBufferPercent(prev => Math.max(40, prev));
            updateBuffer();
          });
          vid.addEventListener('canplay', () => {
            updateBuffer();
            // Quando pode tocar, marca como pronto e tenta iniciar
            setRealBufferPercent(prev => Math.max(70, prev));
            console.log('✅ Vídeo pode tocar (canplay), iniciando...');
            if (vid.paused) {
              vid.play().then(() => {
                console.log('✅ Play iniciado no canplay!');
              }).catch(e => console.log('⚠️ Autoplay blocked no canplay:', e));
            }
          });
          vid.addEventListener('canplaythrough', () => {
            setRealBufferPercent(100);
            console.log('✅ Buffer completo (canplaythrough)!');
            // Buffer completo, garante que está tocando
            if (vid.paused) {
              vid.play().catch(e => console.log('⚠️ Autoplay blocked no canplaythrough:', e));
            }
          });
          vid.addEventListener('playing', () => {
            // Quando começar a tocar, marca como pronto
            console.log('✅✅✅ Vídeo ESTÁ TOCANDO! Removendo loading...');
            clearTimeout(safetyTimeout);
            setPlayerReady(true);
            clearInterval(bufferInterval);
          });
          
          // Limpa intervalo quando componente desmontar
          vid.addEventListener('ended', () => clearInterval(bufferInterval));
          
          observer.disconnect();
        }
      });
      observer.observe(playerDiv, { childList: true, subtree: true });
      
      // Observer adicional para monitorar dentro do iframe quando ele for criado
      const checkIframe = setInterval(() => {
        const iframe = playerDiv.querySelector('iframe');
        if (iframe && iframe.contentDocument) {
          console.log('🎯 Iframe carregado, adicionando observer dentro do iframe...');
          try {
            const iframeObserver = new MutationObserver(() => {
              const iframeVideo = iframe.contentDocument?.querySelector('video');
              if (iframeVideo && !videoDetected) {
                console.log('✅✅ Vídeo detectado dentro do iframe pelo observer!');
                videoDetected = true;
                clearInterval(checkIframe);
                // Trigger o mesmo código de detecção
                const vid = iframeVideo as HTMLVideoElement;
                vid.setAttribute('preload', 'auto');
                vid.setAttribute('autoplay', 'true');
                vid.setAttribute('playsinline', 'true');
                vid.preload = 'auto';
                vid.autoplay = true;
                vid.muted = false;
                vid.load();
                
                setTimeout(() => {
                  if (vid.readyState >= 2) {
                    vid.play().then(() => console.log('✅ Play iniciado (iframe observer)!')).catch(e => console.log('⚠️ Autoplay blocked:', e));
                  }
                }, 500);
                
                // Adiciona listeners
                vid.addEventListener('playing', () => {
                  console.log('✅✅✅ Vídeo ESTÁ TOCANDO (iframe)! Removendo loading...');
                  clearTimeout(safetyTimeout);
                  setPlayerReady(true);
                });
                
                iframeObserver.disconnect();
              }
            });
            
            if (iframe.contentDocument) {
              iframeObserver.observe(iframe.contentDocument.body, { childList: true, subtree: true });
              clearInterval(checkIframe);
            }
          } catch (e) {
            console.log('⚠️ Erro ao observar iframe:', e);
          }
        }
      }, 200);
      
      setTimeout(() => clearInterval(checkIframe), 10000);
      
      // Busca manual periódica como fallback (caso o Observer não pegue)
      console.log('� Iniciando busca manual periódica por elemento <video>...');
      let manualCheckCount = 0;
      const manualCheck = setInterval(() => {
        manualCheckCount++;
        
        // Procura vídeo direto
        let video = playerDiv.querySelector('video');
        
        // Se não encontrou, procura dentro do iframe
        if (!video) {
          const iframe = playerDiv.querySelector('iframe');
          if (iframe) {
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
              if (iframeDoc) {
                video = iframeDoc.querySelector('video');
              }
            } catch (e) {
              // Cross-origin
            }
          }
        }
        
        if (manualCheckCount % 5 === 0) {
          console.log(`🔍 Busca manual #${manualCheckCount}: ${video ? '✅ vídeo encontrado!' : '❌ vídeo não encontrado'}`);
          
          // Mostra o conteúdo do playerDiv a cada 10 tentativas
          if (manualCheckCount % 10 === 0) {
            const iframe = playerDiv.querySelector('iframe');
            console.log('🔎 Conteúdo do playerDiv:', playerDiv.innerHTML.substring(0, 200));
            console.log('🔎 Elementos filhos:', playerDiv.children.length);
            console.log('🔎 Iframe encontrado:', iframe ? 'SIM' : 'NÃO');
            if (playerDiv.children.length > 0) {
              console.log('🔎 Tags dos filhos:', Array.from(playerDiv.children).map(c => c.tagName).join(', '));
            }
          }
        }
        
        if (video && !videoDetected) {
          console.log('⚡ Vídeo encontrado pela busca manual!');
          videoDetected = true;
          clearInterval(manualCheck);
          observer.disconnect();
          
          const vid = video as HTMLVideoElement;
          vid.setAttribute('preload', 'auto');
          vid.setAttribute('autoplay', 'true');
          vid.setAttribute('playsinline', 'true');
          vid.preload = 'auto';
          vid.autoplay = true;
          vid.muted = false;
          
          console.log('Carregando vídeo encontrado manualmente...');
          vid.load();
          
          // Tenta iniciar imediatamente
          setTimeout(() => {
            if (vid.readyState >= 2) {
              console.log('Vídeo pronto (busca manual), tentando play...');
              vid.play().then(() => {
                console.log('✅ Play iniciado (busca manual)!');
              }).catch(e => console.log('⚠️ Autoplay blocked (busca manual):', e));
            }
          }, 500);
          
          // Monitora progresso
          const updateBuffer = () => {
            if (vid.readyState >= 1) setRealBufferPercent(prev => Math.max(10, prev));
            if (vid.readyState >= 2) setRealBufferPercent(prev => Math.max(30, prev));
            if (vid.readyState >= 3) setRealBufferPercent(prev => Math.max(60, prev));
            
            if (vid.buffered.length > 0 && vid.duration > 0) {
              const buffered = vid.buffered.end(vid.buffered.length - 1);
              const percent = Math.round((buffered / vid.duration) * 100);
              setRealBufferPercent(Math.min(percent, 100));
            }
          };
          
          const bufferInterval = setInterval(updateBuffer, 100);
          
          vid.addEventListener('progress', updateBuffer);
          vid.addEventListener('loadedmetadata', () => {
            console.log('Metadata carregada (busca manual)');
            setRealBufferPercent(prev => Math.max(20, prev));
            updateBuffer();
          });
          vid.addEventListener('loadeddata', () => {
            console.log('Dados carregados (busca manual)');
            setRealBufferPercent(prev => Math.max(40, prev));
            updateBuffer();
          });
          vid.addEventListener('canplay', () => {
            updateBuffer();
            setRealBufferPercent(prev => Math.max(70, prev));
            console.log('✅ Vídeo pode tocar (busca manual)!');
            if (vid.paused) {
              vid.play().then(() => {
                console.log('✅ Play iniciado no canplay (busca manual)!');
              }).catch(e => console.log('⚠️ Autoplay blocked no canplay:', e));
            }
          });
          vid.addEventListener('canplaythrough', () => {
            setRealBufferPercent(100);
            console.log('✅ Buffer completo (busca manual)!');
            if (vid.paused) {
              vid.play().catch(e => console.log('⚠️ Autoplay blocked:', e));
            }
          });
          vid.addEventListener('playing', () => {
            console.log('✅✅✅ Vídeo ESTÁ TOCANDO (busca manual)! Removendo loading...');
            clearTimeout(safetyTimeout);
            setPlayerReady(true);
            clearInterval(bufferInterval);
            clearInterval(manualCheck);
          });
          
          vid.addEventListener('ended', () => clearInterval(bufferInterval));
        }
      }, 200);
      
      // Limpa busca manual após 15s
      setTimeout(() => {
        clearInterval(manualCheck);
        console.log('⏱️ Busca manual encerrada após 15s');
      }, 15000);
      
      // CSS mínimo apenas para posicionar o player corretamente
      const style = document.createElement('style');
      style.innerHTML = `
        [id^="webtor-player-"] {
          width: 100% !important;
          height: 100% !important;
          position: relative !important;
        }
        [id^="webtor-player-"] iframe {
          width: 100% !important;
          height: 100% !important;
          border: none !important;
          display: block !important;
        }
      `;
      document.head.appendChild(style);
      
      console.log('🌐 Inicializando Webtor player com magnet:', magnet.substring(0, 60) + '...');
      
      const w = window as any;
      
      // Verifica se o Webtor está disponível
      if (!w.webtor) {
        console.warn('⚠️ window.webtor não está definido! Script do Webtor pode não ter carregado.');
        console.log('🔍 Verificando script do Webtor no DOM...');
        const webtorScript = document.querySelector('script[src*="webtor"]');
        console.log('📜 Script do Webtor encontrado:', webtorScript ? 'SIM' : 'NÃO');
      } else {
        console.log('✅ window.webtor está disponível');
      }
      
      w.webtor = w.webtor || [];
      w.webtor.push({
        id: playerDiv.id,
        magnet,
        on: (e: any) => {
          console.log('📡 Evento Webtor recebido:', e.name, e);
          
          if (e.name === 'inited') {
            console.log('✅ WEBTOR INITED - Aguardando carregamento...');
            // Aguarda 3s para o iframe carregar e remove loading
            setTimeout(() => {
              console.log('🎬 Removendo loading após INITED');
              clearTimeout(safetyTimeout);
              setPlayerReady(true);
            }, 3000);
          }
          
          if (e.name === 'ready') {
            console.log('✅ WEBTOR READY - Player pronto!');
            clearTimeout(safetyTimeout);
            setPlayerReady(true);
          }
          
          if (e.name === 'error') {
            console.error('❌ ERRO DO WEBTOR:', e);
            clearTimeout(safetyTimeout);
            setPlayerReady(true); // Mostra mesmo com erro para usuário ver
          }
        },
        lang: "pt",
        controls: true,
      });
      
      console.log('✅ Configuração do Webtor enviada. Aguardando eventos...');
      
    }, 100); // tempo para iniciar o player
  }, [selectedStream]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h2 className="text-lg font-bold text-foreground mb-2 animate-fade-in">
              Preparando stream...
            </h2>
            <p className="text-xs text-muted-foreground">
              Buscando torrents disponíveis
            </p>
          </div>
          <LoadingStages realBufferPercent={0} />
        </div>
      </div>
    );
  }

  if (error && streams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <p className="text-foreground/80 text-center">{error}</p>
      </div>
    );
  }

  // Player view
  if (selectedStream) {
    // Quando showLoading está ativo (seja antes ou depois do playerReady)
    if (showLoading) {
      return (
        <div className="flex flex-col h-full relative">
          <div className="flex items-center gap-3 px-4 py-2 bg-card/60 border-b border-border/20">
            <button
              onClick={() => {
                setSelectedStream(null);
                setShowPlayer(false);
                setShowLoading(false);
                setPlayerReady(false);
                setRealBufferPercent(0);
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Voltar à lista
            </button>
            <span className="text-xs text-foreground/60 truncate flex-1">
              {selectedStream.name}
            </span>
          </div>
          
          {/* Container do player - sempre renderizado */}
          <div className="flex-1 bg-black flex items-center justify-center relative">
            <div ref={playerRef} className="w-full h-full flex items-center justify-center" />
            
            {/* Loading overlay - só aparece quando playerReady for false */}
            {!playerReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-50">
                <div className="w-full max-w-sm px-4">
                  <div className="mb-8 text-center">
                    <h2 className="text-lg font-bold text-foreground mb-2 animate-fade-in">
                      Preparando stream...
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Aguardando buffer do vídeo
                    </p>
                  </div>
                  <div className="w-full">
                    <LoadingStages playerReady={playerReady} realBufferPercent={realBufferPercent} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    // Botão de play centralizado
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-2 bg-card/60 border-b border-border/20">
          <button
            onClick={() => {
              setSelectedStream(null);
              setShowPlayer(false);
              setShowLoading(false);
              setPlayerReady(false);
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Voltar à lista
          </button>
          <span className="text-xs text-foreground/60 truncate flex-1">
            {selectedStream.name}
          </span>
        </div>
        <div className="flex-1 bg-black flex items-center justify-center">
          <button
            className="flex flex-col items-center justify-center group focus:outline-none"
            onClick={handlePlayClick}
            aria-label="Iniciar reprodução"
          >
            <span className="rounded-full border-4 border-white w-24 h-24 flex items-center justify-center bg-black/60 group-hover:bg-primary/80 transition-colors">
              <Play className="w-14 h-14 text-white group-hover:text-background" />
            </span>
            <span className="mt-4 text-white text-lg font-semibold group-hover:text-primary transition-colors">Assistir agora</span>
          </button>
        </div>
      </div>
    );
  }

  // Stream list
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border/20">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-primary" />
          Torrents Disponíveis
          <span className="text-xs text-muted-foreground font-normal">
            ({streams.length} encontrados)
          </span>
        </h3>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scrollbar-hide px-4 py-2 space-y-2">
        {streams.map((stream, i) => (
          <button
            key={`${stream.infoHash}-${i}`}
            onClick={() => playStream(stream)}
            className="w-full flex items-center gap-4 p-3 rounded-lg bg-card/50 hover:bg-card border border-border/20 hover:border-primary/30 transition-all group text-left"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Play className="w-5 h-5 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-bold bg-secondary/80 px-2 py-0.5 rounded">
                  {stream.quality}
                </span>
                {stream.ptBr && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <Volume2 className="w-3 h-3" />
                    🇧🇷 PT-BR/Dual
                  </span>
                )}
              </div>
              <p className="text-xs text-foreground/70 truncate mb-1">{stream.name}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>💾 {stream.size}</span>
                <span>👤 {stream.seeds} seeds</span>
                <span>📥 {stream.leechers} leechers</span>
              </div>
            </div>

            {type === "movie" ? (
              <Film className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <Tv className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
