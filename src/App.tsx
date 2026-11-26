import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { cn } from "./utils/cn";

type Direction = "N" | "E" | "S" | "W";
type PipeType = "straight" | "elbow" | "tee" | "cross" | "cap";
type Phase = "planning" | "flowing" | "won" | "lost";

type Cell = {
  type: PipeType;
  rotation: number;
  locked?: boolean;
  role?: "start" | "end";
};

type Level = {
  name: string;
  rows: number;
  cols: number;
  seconds: number;
  solution: Array<[number, number, PipeType, number, Cell["role"]?]>;
};

const directions: Direction[] = ["N", "E", "S", "W"];
const delta: Record<Direction, [number, number]> = {
  N: [-1, 0],
  E: [0, 1],
  S: [1, 0],
  W: [0, -1],
};
const opposite: Record<Direction, Direction> = { N: "S", E: "W", S: "N", W: "E" };

const levels: Level[] = [
  {
    name: "Essai Facile",
    rows: 3,
    cols: 3,
    seconds: 20,
    solution: [
      [1, 0, "cap", 0, "start"],
      [1, 1, "elbow", 3],
      [1, 2, "cap", 1, "end"],
    ],
  },
  {
    name: "Départ Tranquil",
    rows: 3,
    cols: 4,
    seconds: 25,
    solution: [
      [1, 0, "cap", 0, "start"],
      [1, 1, "elbow", 3],
      [0, 1, "elbow", 0],
      [0, 2, "elbow", 3],
      [1, 2, "elbow", 0],
      [1, 3, "cap", 1, "end"],
    ],
  },
  {
    name: "Coudon Simple",
    rows: 4,
    cols: 4,
    seconds: 30,
    solution: [
      [2, 0, "cap", 0, "start"],
      [2, 1, "straight", 1],
      [2, 2, "elbow", 3],
      [1, 2, "elbow", 1],
      [1, 3, "cap", 1, "end"],
    ],
  },
  {
    name: "Serpentin Doux",
    rows: 4,
    cols: 5,
    seconds: 35,
    solution: [
      [3, 0, "cap", 0, "start"],
      [3, 1, "elbow", 3],
      [2, 1, "straight", 0],
      [1, 1, "elbow", 1],
      [1, 2, "straight", 1],
      [1, 3, "elbow", 3],
      [2, 3, "cap", 1, "end"],
    ],
  },
  {
    name: "Vanne Ouverte",
    rows: 5,
    cols: 5,
    seconds: 40,
    solution: [
      [2, 0, "cap", 0, "start"],
      [2, 1, "straight", 1],
      [2, 2, "elbow", 3],
      [1, 2, "elbow", 1],
      [1, 3, "straight", 1],
      [1, 4, "elbow", 2],
      [2, 4, "cap", 1, "end"],
    ],
  },
  {
    name: "Réseau Enchevêtré",
    rows: 5,
    cols: 6,
    seconds: 45,
    solution: [
      [4, 0, "cap", 0, "start"],
      [4, 1, "elbow", 3],
      [3, 1, "straight", 0],
      [2, 1, "elbow", 1],
      [2, 2, "straight", 1],
      [2, 3, "elbow", 3],
      [1, 3, "elbow", 1],
      [1, 4, "straight", 1],
      [1, 5, "elbow", 2],
      [2, 5, "cap", 1, "end"],
    ],
  },
  {
    name: "Montée en Température",
    rows: 6,
    cols: 6,
    seconds: 50,
    solution: [
      [0, 0, "cap", 0, "start"],
      [0, 1, "elbow", 2],
      [1, 1, "elbow", 0],
      [1, 2, "straight", 1],
      [1, 3, "elbow", 2],
      [2, 3, "straight", 0],
      [3, 3, "elbow", 0],
      [3, 4, "elbow", 2],
      [4, 4, "elbow", 0],
      [4, 5, "cap", 1, "end"],
    ],
  },
  {
    name: "Turbine Pressante",
    rows: 6,
    cols: 7,
    seconds: 55,
    solution: [
      [5, 0, "cap", 0, "start"],
      [5, 1, "straight", 1],
      [5, 2, "elbow", 3],
      [4, 2, "straight", 0],
      [3, 2, "elbow", 1],
      [3, 3, "straight", 1],
      [3, 4, "elbow", 3],
      [2, 4, "elbow", 1],
      [2, 5, "straight", 1],
      [2, 6, "elbow", 3],
      [1, 6, "cap", 1, "end"],
    ],
  },
  {
    name: "Grande Porte",
    rows: 7,
    cols: 7,
    seconds: 60,
    solution: [
      [6, 0, "cap", 0, "start"],
      [6, 1, "elbow", 3],
      [5, 1, "straight", 0],
      [4, 1, "elbow", 1],
      [4, 2, "straight", 1],
      [4, 3, "elbow", 3],
      [3, 3, "straight", 0],
      [2, 3, "elbow", 1],
      [2, 4, "straight", 1],
      [2, 5, "elbow", 2],
      [3, 5, "elbow", 0],
      [3, 6, "elbow", 3],
      [2, 6, "straight", 0],
      [1, 6, "cap", 1, "end"],
    ],
  },
];

const fillerTypes: PipeType[] = ["straight", "elbow", "elbow", "tee", "cross"];

function keyOf(row: number, col: number) {
  return `${row}:${col}`;
}

function connectionsFor(cell: Cell): Direction[] {
  const base: Record<PipeType, Direction[]> = {
    straight: ["N", "S"],
    elbow: ["N", "E"],
    tee: ["N", "E", "W"],
    cross: ["N", "E", "S", "W"],
    cap: ["E"],
  };

  return base[cell.type].map((direction) => {
    const index = (directions.indexOf(direction) + cell.rotation) % directions.length;
    return directions[index];
  });
}

function makeBoard(level: Level): Cell[][] {
  const board: Cell[][] = Array.from({ length: level.rows }, (_, row) =>
    Array.from({ length: level.cols }, (_, col) => {
      const type = fillerTypes[(row * 3 + col * 5 + level.rows) % fillerTypes.length];
      return { type, rotation: (row + col * 2 + level.cols) % 4 };
    }),
  );

  level.solution.forEach(([row, col, type, solutionRotation, role], index) => {
    const locked = role === "start" || role === "end";
    board[row][col] = {
      type,
      rotation: locked ? solutionRotation : (solutionRotation + 1 + (index % 3)) % 4,
      locked,
      role,
    };
  });

  return board;
}

function findRole(board: Cell[][], role: Cell["role"]) {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (board[row][col].role === role) return [row, col] as const;
    }
  }
  return [0, 0] as const;
}

function connectedNeighbors(board: Cell[][], row: number, col: number) {
  const cell = board[row][col];
  const exits = connectionsFor(cell);

  return exits.flatMap((direction) => {
    const [dr, dc] = delta[direction];
    const nextRow = row + dr;
    const nextCol = col + dc;
    const nextCell = board[nextRow]?.[nextCol];

    if (!nextCell) return [];
    return connectionsFor(nextCell).includes(opposite[direction]) ? [[nextRow, nextCol] as const] : [];
  });
}

function canReachEnd(board: Cell[][]) {
  const [startRow, startCol] = findRole(board, "start");
  const [endRow, endCol] = findRole(board, "end");
  const seen = new Set([keyOf(startRow, startCol)]);
  const queue: Array<readonly [number, number]> = [[startRow, startCol]];

  while (queue.length > 0) {
    const [row, col] = queue.shift()!;
    if (row === endRow && col === endCol) return true;

    connectedNeighbors(board, row, col).forEach(([nextRow, nextCol]) => {
      const nextKey = keyOf(nextRow, nextCol);
      if (!seen.has(nextKey)) {
        seen.add(nextKey);
        queue.push([nextRow, nextCol]);
      }
    });
  }

  return false;
}

function expandWater(board: Cell[][], frontier: Set<string>, wet: Set<string>) {
  const next = new Set<string>();

  frontier.forEach((position) => {
    const [row, col] = position.split(":").map(Number);
    connectedNeighbors(board, row, col).forEach(([nextRow, nextCol]) => {
      const nextKey = keyOf(nextRow, nextCol);
      if (!wet.has(nextKey)) next.add(nextKey);
    });
  });

  return next;
}

function pipePath(direction: Direction) {
  const endpoints: Record<Direction, string> = {
    N: "M 50 50 L 50 0",
    E: "M 50 50 L 100 50",
    S: "M 50 50 L 50 100",
    W: "M 50 50 L 0 50",
  };
  return endpoints[direction];
}

const useAudioContext = () => {
  const ctxRef = useRef<AudioContext | null>(null);

  const initAudio = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return ctxRef.current;
  }, []);

  const playClick = useCallback(() => {
    const ctx = initAudio();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.value = 440;
    gain.gain.value = 0.1;
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    oscillator.stop(ctx.currentTime + 0.15);
  }, [initAudio]);

  const playWater = useCallback(() => {
    const ctx = initAudio();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.value = 110;
    filter.type = "lowpass";
    filter.frequency.value = 200;
    gain.gain.value = 0.08;
    oscillator.start();
    oscillator.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    oscillator.stop(ctx.currentTime + 0.3);
  }, [initAudio]);

  const playWin = useCallback(() => {
    const ctx = initAudio();
    if (!ctx) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((note, i) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.type = "sine";
      oscillator.frequency.value = note;
      gain.gain.value = 0.15;
      oscillator.start(ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
      oscillator.stop(ctx.currentTime + i * 0.15 + 0.3);
    });
  }, [initAudio]);

  const playAmbient = useCallback(() => {
    const ctx = initAudio();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.value = 60;
    filter.type = "lowpass";
    filter.frequency.value = 120;
    gain.gain.value = 0.03;
    oscillator.start();
    return () => {
      oscillator.stop();
    };
  }, [initAudio]);

  return { playClick, playWater, playWin, playAmbient };
};

function PipeCell({
  cell,
  wet,
  frontier,
  disabled,
  onRotate,
}: {
  cell: Cell;
  wet: boolean;
  frontier: boolean;
  disabled: boolean;
  onRotate: () => void;
}) {
  const exits = connectionsFor(cell);

  return (
    <button
      type="button"
      onClick={onRotate}
      disabled={disabled}
      aria-label={`${cell.role ?? cell.type} tuyau, ${disabled ? "verrouillé" : "tourner"}`}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-sm border border-cyan-950/70 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 transition-all duration-300",
        "focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950",
        !disabled && "hover:z-20 hover:scale-[1.08] hover:border-cyan-200/80 active:scale-100",
        wet && "shadow-lg shadow-cyan-500/40 rounded-none border-cyan-400/50",
        cell.locked && "cursor-default bg-slate-900",
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.08),transparent_28%),linear-gradient(135deg,rgba(8,47,73,0.45),transparent)]" />
      {frontier && (
        <>
          <span className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-200/60 blur-md animate-ping" />
          <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-100 shadow-lg shadow-cyan-200 animate-pulse" />
        </>
      )}
      {wet && !frontier && (
        <span className="absolute inset-0 bg-gradient-to-br from-cyan-500/30 to-cyan-400/20 animate-pulse" />
      )}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" role="img" aria-hidden="true">
        {exits.map((direction) => (
          <path
            key={`shadow-${direction}`}
            d={pipePath(direction)}
            stroke="rgba(15,23,42,0.9)"
            strokeWidth="30"
            strokeLinecap="round"
            fill="none"
          />
        ))}
        {exits.map((direction) => (
          <path
            key={`pipe-${direction}`}
            d={pipePath(direction)}
            stroke={wet ? "#06b6d4" : "#f59e0b"}
            strokeWidth="19"
            strokeLinecap="round"
            fill="none"
            className="transition-all duration-500"
            style={{ filter: wet ? "drop-shadow(0 0 10px #06b6d4)" : "drop-shadow(0 0 8px #f59e0b)" }}
          />
        ))}
        <circle
          cx="50"
          cy="50"
          r="14"
          fill={wet ? "#06b6d4" : "#fcd34d"}
          className="transition-all duration-500"
          style={{ filter: wet ? "drop-shadow(0 0 14px #06b6d4)" : "drop-shadow(0 0 8px #fcd34d)" }}
        />
      </svg>
      {cell.role && (
        <span
          className={cn(
            "absolute left-1 top-1 rounded-sm px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-950",
            cell.role === "start" ? "bg-emerald-300" : "bg-rose-300",
          )}
        >
          {cell.role === "start" ? "ENTRÉE" : "SORTIE"}
        </span>
      )}
    </button>
  );
}

export default function App() {
  const [levelIndex, setLevelIndex] = useState(0);
  const level = levels[levelIndex];
  const [board, setBoard] = useState(() => makeBoard(level));
  const [phase, setPhase] = useState<Phase>("planning");
  const [secondsLeft, setSecondsLeft] = useState(level.seconds);
  const [wet, setWet] = useState<Set<string>>(() => new Set());
  const [frontier, setFrontier] = useState<Set<string>>(() => new Set());
  const [moves, setMoves] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { playClick, playWater, playWin } = useAudioContext();

  useEffect(() => {
    if (phase === "won") {
      playWin();
    }
  }, [phase, playWin]);

  useEffect(() => {
    if (frontier.size > 0 && wet.size > 0 && phase === "flowing") {
      playWater();
    }
  }, [frontier, wet, phase, playWater]);

  const [startRow, startCol] = useMemo(() => findRole(board, "start"), [board]);
  const [endRow, endCol] = useMemo(() => findRole(board, "end"), [board]);
  const isSolved = useMemo(() => canReachEnd(board), [board]);
  const timePercent = Math.max(0, (secondsLeft / level.seconds) * 100);

  function resetLevel(nextIndex = levelIndex) {
    const nextLevel = levels[nextIndex];
    setLevelIndex(nextIndex);
    setBoard(makeBoard(nextLevel));
    setPhase("planning");
    setSecondsLeft(nextLevel.seconds);
    setWet(new Set());
    setFrontier(new Set());
    setMoves(0);
  }

  function beginFlow() {
    const startKey = keyOf(startRow, startCol);
    setPhase("flowing");
    setWet(new Set([startKey]));
    setFrontier(new Set([startKey]));
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }

  function rotateCell(row: number, col: number) {
    const cellKey = keyOf(row, col);
    if (phase === "won" || phase === "lost" || wet.has(cellKey) || board[row][col].locked) return;

    setBoard((current) =>
      current.map((line, lineIndex) =>
        line.map((cell, cellIndex) =>
          lineIndex === row && cellIndex === col ? { ...cell, rotation: (cell.rotation + 1) % 4 } : cell,
        ),
      ),
    );
    setMoves((current) => current + 1);
  }

  useEffect(() => {
    if (phase !== "planning") return;
    if (secondsLeft <= 0) {
      beginFlow();
      return;
    }

    const timer = window.setTimeout(() => setSecondsLeft((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [phase, secondsLeft]);

  useEffect(() => {
    if (phase !== "flowing") return;
    const endKey = keyOf(endRow, endCol);

    if (wet.has(endKey)) {
      setPhase("won");
      return;
    }

    const next = expandWater(board, frontier, wet);
    if (next.size === 0) {
      const failure = window.setTimeout(() => setPhase("lost"), 450);
      return () => window.clearTimeout(failure);
    }

    const flow = window.setTimeout(() => {
      setWet((current) => new Set([...current, ...next]));
      setFrontier(next);
    }, 560);

    return () => window.clearTimeout(flow);
  }, [phase, board, frontier, wet, endRow, endCol]);

  const statusText =
    phase === "planning"
      ? isSolved
        ? "Itinéraire complet. Libérez l'eau ou optimisez davantage."
        : "Tournez les tuyaux avant que le compte à rebours n'ouvre la vanne."
      : phase === "flowing"
        ? "L'eau est en mouvement. Vous pouvez encore tourner les tuyaux secs."
        : phase === "won"
          ? levelIndex === levels.length - 1
            ? "Tous les districts sont approvisionnés. Le réseau est sauvé."
            : "Connexion réussie. Prêt pour la prochaine zone de pression."
          : "L'écoulement s'est arrêté. Réinitialisez le niveau et reconstruisez le trajet.";

  const headerText =
    (phase === "planning" && (isSolved ? "Le trajet tient." : "La vanne compte.")) ||
    (phase === "flowing" && "Pression libérée.") ||
    (phase === "won" && "Niveau terminé.") ||
    (phase === "lost" && "Pression perdue.");

  return (
    <main className="min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(34,211,238,0.25),transparent_34%),radial-gradient(circle_at_15%_85%,rgba(14,165,233,0.15),transparent_28%),radial-gradient(circle_at_85%_30%,rgba(6,182,212,0.12),transparent_24%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-cyan-200/10 pb-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-200/80">Plomberie de Rêve</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-4xl">
              Contre la valve inondante
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-cyan-50/80">
            <span className="rounded bg-cyan-200/10 px-2 py-1">Niveau {levelIndex + 1}/{levels.length}</span>
            <span className="rounded bg-cyan-200/10 px-2 py-1">{moves} tours</span>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded border border-cyan-200/30 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-200/10"
              aria-label={isFullscreen ? "Quitter le plein écran" : "Mode plein écran"}
            >
              {isFullscreen ? "Quitter" : "Plein écran"}
            </button>
          </div>
        </header>

        <section className="flex flex-col lg:flex-row lg:items-start lg:justify-center gap-6 py-6 lg:gap-8">
          <div className="w-full max-w-2xl mx-auto lg:mx-0 lg:flex-1">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-cyan-200/70">{level.name}</p>
                <p className="mt-1.5 max-w-xl text-slate-300 text-sm sm:text-base">{statusText}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className={cn(
                  "text-4xl sm:text-5xl font-black tabular-nums transition-all duration-300",
                  secondsLeft <= 8 ? "text-rose-400 animate-pulse" : "text-white",
                )}>{secondsLeft}</p>
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/70">secondes</p>
              </div>
            </div>

            <div className="mb-4 h-2.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-1000 ease-out",
                  secondsLeft <= 8 ? "bg-rose-400" : secondsLeft <= 15 ? "bg-amber-400" : "bg-cyan-300",
                )}
                style={{ width: `${timePercent}%` }}
              />
            </div>

            <div
              className="grid overflow-hidden rounded-md border-2 border-cyan-200/40 bg-cyan-950/60 shadow-2xl shadow-cyan-950/70"
              style={{ gridTemplateColumns: `repeat(${level.cols}, minmax(0, 1fr))` }}
            >
              {board.map((row, rowIndex) =>
                row.map((cell, colIndex) => {
                  const cellKey = keyOf(rowIndex, colIndex);
                  return (
                    <PipeCell
                      key={cellKey}
                      cell={cell}
                      wet={wet.has(cellKey)}
                      frontier={frontier.has(cellKey)}
                      disabled={cell.locked === true || wet.has(cellKey) || phase === "won" || phase === "lost"}
                      onRotate={() => {
                        playClick();
                        rotateCell(rowIndex, colIndex);
                      }}
                    />
                  );
                }),
              )}
            </div>
          </div>

          <aside className="w-full max-w-sm mx-auto lg:mx-0 lg:w-80 space-y-5 border-t border-cyan-200/10 pt-5 lg:border-l lg:border-t-0 lg:pt-0 lg:pl-8">
            <div className="space-y-2">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-200/70">Salle de contrôle</p>
              <h2 className="text-xl font-black text-white sm:text-2xl">{headerText}</h2>
              <p className="text-sm leading-6 text-slate-300">
                Créez un réseau continu de l'ENTRÉE vers la SORTIE. Quand le chronomètre atteint zéro, l'eau s'écoule à travers chaque tuyau connecté. Les tuyaux secs peuvent être tournés pendant que le front s'approche.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="border border-cyan-200/10 bg-white/[0.03] p-2.5">
                <p className="text-xl font-black text-cyan-100">{wet.size}</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/60">mouillés</p>
              </div>
              <div className="border border-cyan-200/10 bg-white/[0.03] p-2.5">
                <p className="text-xl font-black text-cyan-100">{level.rows * level.cols}</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/60">tuyaux</p>
              </div>
              <div className="border border-cyan-200/10 bg-white/[0.03] p-2.5">
                <p className="text-xl font-black text-cyan-100">{isSolved ? "Oui" : "Non"}</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/60">connecté</p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {phase === "planning" && (
                <button
                  type="button"
                  onClick={beginFlow}
                  className="w-full bg-cyan-300 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-950 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950"
                >
                  Libérer l'eau
                </button>
              )}
              {phase === "won" && levelIndex < levels.length - 1 && (
                <button
                  type="button"
                  onClick={() => resetLevel(levelIndex + 1)}
                  className="w-full bg-emerald-300 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-950 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:ring-offset-2 focus:ring-offset-slate-950"
                >
                  Niveau suivant
                </button>
              )}
              {phase === "won" && levelIndex === levels.length - 1 && (
                <button
                  type="button"
                  onClick={() => resetLevel(0)}
                  className="w-full bg-emerald-300 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-950 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:ring-offset-2 focus:ring-offset-slate-950"
                >
                  Rejouer
                </button>
              )}
              <button
                type="button"
                onClick={() => resetLevel(levelIndex)}
                className="w-full border border-cyan-200/20 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-200/10 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                Réinitialiser
              </button>
            </div>

            <div className="border-t border-cyan-200/10 pt-4 text-xs leading-6 text-slate-400">
              Astuce : un pulse lumineux marque le front d'eau. Tournez les tuyaux avant qu'il n'atteigne les raccords, puis guidez l'écoulement vers la SORTIE.
            </div>

            <footer className="border-t border-cyan-200/10 pt-4 text-center text-[10px] text-slate-500">
              Créateur de l'app : Hylst - Geoffroy avec l'aide d'une IA
            </footer>
          </aside>
        </section>
      </div>
    </main>
  );
}