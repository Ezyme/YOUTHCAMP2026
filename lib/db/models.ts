import mongoose, { Schema, type Model, type Types } from "mongoose";

export type EngineKey = "mindgame" | "final_solving" | "unmasked" | "config_only";
export type ScoringMode = "placement_points" | "amazing_race_finish";

export interface GameScoring {
  maxPlacements: number;
  scoringMode: ScoringMode;
  placementPoints: number[];
  weight: number;
}

export interface IGameDefinition {
  name: string;
  slug: string;
  day: number;
  category: string;
  engineKey: EngineKey;
  settings: Record<string, unknown>;
  scoring: GameScoring;
  rulesMarkdown: string;
  order: number;
  isPlayable: boolean;
  mediaUrl?: string;
  mediaPublicId?: string;
}

export interface ISession {
  label: string;
  eventId?: Types.ObjectId;
  active: boolean;
}

export interface ITeam {
  name: string;
  color: string;
  sessionId: Types.ObjectId;
  sortOrder: number;
  /** Login id for camp dashboard, e.g. team1 … team6 (seeded). */
  loginUsername?: string;
  /** bcrypt hash; never send to client. */
  passwordHash?: string;
}

export interface IClue {
  teamId: Types.ObjectId;
  sessionId: Types.ObjectId;
  sourceGameSlug: string;
  text: string;
  order: number;
  revealedAt?: Date;
}

export type ValidatorType =
  | "exact"
  | "normalized"
  | "regex"
  | "ordered_tokens"
  | "numeric";

export interface IFinalPuzzle {
  sessionId: Types.ObjectId;
  teamId?: Types.ObjectId;
  validatorType: ValidatorType;
  validatorConfig: Record<string, unknown>;
  solutionHash: string;
}

export interface IMindgameState {
  sessionId?: Types.ObjectId | null;
  teamId?: Types.ObjectId | null;
  clientKey: string;
  gridRows: number;
  gridCols: number;
  playerCount: number;
  positions: { pinIndex: number; r: number; c: number }[];
  /** Impassable intersections (walls). */
  blocked?: { r: number; c: number }[];
  /** Vertices that allow diagonal moves (both ends must match). */
  diagonalNodes?: { r: number; c: number }[];
  goal: string;
  moves: number;
}

export interface IGameResult {
  sessionId: Types.ObjectId;
  gameId: Types.ObjectId;
  teamId: Types.ObjectId;
  placement: number;
  pointsAwarded: number;
  completedAt?: Date;
  notes?: string;
  updateReason?: string;
}

export type PowerUpType =
  | "extra_heart"
  | "reveal"
  | "scout"
  | "shield"
  /** Largest safe cascade — best Minesweeper-style first click. */
  | "safe_opening"
  | "truth_radar"
  | "lie_pin"
  | "verse_compass"
  | "gentle_step";

/** DB + Mongoose enum list (keep in sync with `PowerUpType`). */
export const UNMASKED_POWER_UP_ENUM: PowerUpType[] = [
  "extra_heart",
  "reveal",
  "scout",
  "shield",
  "safe_opening",
  "truth_radar",
  "lie_pin",
  "verse_compass",
  "gentle_step",
];

const UnmaskedPowerUpEntrySchema = new Schema(
  {
    // Field name is `type` (power-up kind). Inner `type: String` is the Mongoose schema type.
    type: {
      type: String,
      required: true,
      enum: UNMASKED_POWER_UP_ENUM,
    },
    used: { type: Boolean, default: false },
  },
  { _id: false },
);

export interface IUnmaskedState {
  sessionId: Types.ObjectId;
  teamId: Types.ObjectId;
  seed: number;
  gridSize: number;
  totalLies: number;
  revealed: number[];
  flagged: number[];
  hearts: number;
  maxHearts: number;
  /** @deprecated Single-verse games; prefer verseKeys */
  verseKey?: string;
  /** Verses on this board (internal keys; never show reference to players). */
  verseKeys?: string[];
  verseFragments: { index: number; text: string; order: number; verseKey: string }[];
  /** Board tile indices in the builder row (ordered). */
  verseAssemblyIndices: number[];
  /** @deprecated Use verseAssemblyIndices */
  verseAssembly?: number[];
  versesRestored: string[];
  verseScore: number;
  /** @deprecated Use versesRestored */
  verseCompleted?: boolean;
  redeemedCodes: string[];
  powerUps: { type: PowerUpType; used: boolean }[];
  shielded: boolean;
  status: "playing" | "won" | "lost";
  liesHit: number;
  startedAt: Date;
  finishedAt?: Date;
}

export interface IPowerUpCode {
  sessionId: Types.ObjectId;
  code: string;
  powerUpType: PowerUpType;
  scope: "universal" | "per_team";
  teamId?: Types.ObjectId;
  redeemedBy: Types.ObjectId[];
}

export interface IEvent {
  name: string;
  startsAt?: Date;
  endsAt?: Date;
}

const defaultScoring = (): GameScoring => ({
  maxPlacements: 6,
  scoringMode: "placement_points",
  placementPoints: [12, 11, 10, 9, 8, 7],
  weight: 1,
});

const GameDefinitionSchema = new Schema<IGameDefinition>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    day: { type: Number, required: true, min: 0, max: 2 },
    category: { type: String, required: true },
    engineKey: {
      type: String,
      required: true,
      enum: ["mindgame", "final_solving", "unmasked", "config_only"],
    },
    settings: { type: Schema.Types.Mixed, default: {} },
    scoring: {
      type: {
        maxPlacements: { type: Number, default: 6 },
        scoringMode: {
          type: String,
          enum: ["placement_points", "amazing_race_finish"],
          default: "placement_points",
        },
        placementPoints: {
          type: [Number],
          default: () => [12, 11, 10, 9, 8, 7],
          validate: {
            validator(v: number[]) {
              return Array.isArray(v) && v.length === 6;
            },
            message: "placementPoints must have exactly 6 entries",
          },
        },
        weight: { type: Number, default: 1, min: 0 },
      },
      default: defaultScoring,
    },
    rulesMarkdown: { type: String, default: "" },
    order: { type: Number, default: 0 },
    isPlayable: { type: Boolean, default: false },
    mediaUrl: String,
    mediaPublicId: String,
  },
  { timestamps: true },
);

const EventSchema = new Schema<IEvent>(
  {
    name: { type: String, required: true },
    startsAt: Date,
    endsAt: Date,
  },
  { timestamps: true },
);

const SessionSchema = new Schema<ISession>(
  {
    label: { type: String, required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const TeamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true },
    color: { type: String, default: "#6366f1" },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "Session",
      required: true,
      index: true,
    },
    sortOrder: { type: Number, default: 0 },
    loginUsername: { type: String, trim: true, lowercase: true },
    passwordHash: { type: String, select: false },
  },
  { timestamps: true },
);

TeamSchema.index({ sessionId: 1, sortOrder: 1 });
TeamSchema.index(
  { sessionId: 1, loginUsername: 1 },
  { unique: true, sparse: true },
);

const ClueSchema = new Schema<IClue>(
  {
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "Session",
      required: true,
      index: true,
    },
    sourceGameSlug: { type: String, required: true },
    text: { type: String, required: true },
    order: { type: Number, default: 0 },
    revealedAt: Date,
  },
  { timestamps: true },
);

ClueSchema.index({ teamId: 1, sessionId: 1, order: 1 });

const FinalPuzzleSchema = new Schema<IFinalPuzzle>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "Session",
      required: true,
      index: true,
    },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    validatorType: {
      type: String,
      required: true,
      enum: ["exact", "normalized", "regex", "ordered_tokens", "numeric"],
    },
    validatorConfig: { type: Schema.Types.Mixed, default: {} },
    solutionHash: { type: String, required: true },
  },
  { timestamps: true },
);

FinalPuzzleSchema.index({ sessionId: 1, teamId: 1 });

const MindgameStateSchema = new Schema<IMindgameState>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", default: null },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    clientKey: { type: String, required: true },
    gridRows: { type: Number, required: true },
    gridCols: { type: Number, required: true },
    playerCount: { type: Number, required: true },
    positions: [
      {
        pinIndex: Number,
        r: Number,
        c: Number,
      },
    ],
    blocked: {
      type: [{ r: Number, c: Number }],
      default: [],
    },
    diagonalNodes: {
      type: [{ r: Number, c: Number }],
      default: [],
    },
    goal: { type: String, required: true },
    moves: { type: Number, default: 0 },
  },
  { timestamps: true },
);

MindgameStateSchema.index(
  { clientKey: 1, sessionId: 1, teamId: 1 },
  { unique: true },
);

const GameResultSchema = new Schema<IGameResult>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "Session",
      required: true,
      index: true,
    },
    gameId: {
      type: Schema.Types.ObjectId,
      ref: "GameDefinition",
      required: true,
      index: true,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },
    placement: { type: Number, required: true, min: 1, max: 6 },
    pointsAwarded: { type: Number, required: true },
    completedAt: Date,
    notes: String,
    updateReason: String,
  },
  { timestamps: true },
);

GameResultSchema.index(
  { sessionId: 1, gameId: 1, teamId: 1 },
  { unique: true },
);

const UnmaskedStateSchema = new Schema<IUnmaskedState>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "Session",
      required: true,
      index: true,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },
    seed: { type: Number, required: true },
    gridSize: { type: Number, required: true },
    totalLies: { type: Number, required: true },
    revealed: { type: [Number], default: [] },
    flagged: { type: [Number], default: [] },
    hearts: { type: Number, required: true },
    maxHearts: { type: Number, required: true },
    verseKey: { type: String },
    verseKeys: { type: [String], default: [] },
    verseFragments: {
      type: [{ index: Number, text: String, order: Number, verseKey: String }],
      default: [],
    },
    verseAssemblyIndices: { type: [Number], default: [] },
    verseAssembly: { type: [Number], default: [] },
    versesRestored: { type: [String], default: [] },
    verseScore: { type: Number, default: 0 },
    verseCompleted: { type: Boolean, default: false },
    redeemedCodes: { type: [String], default: [] },
    powerUps: {
      type: [UnmaskedPowerUpEntrySchema],
      default: [],
    },
    shielded: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["playing", "won", "lost"],
      default: "playing",
    },
    liesHit: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    finishedAt: Date,
  },
  { timestamps: true },
);

UnmaskedStateSchema.index({ sessionId: 1, teamId: 1 }, { unique: true });

const PowerUpCodeSchema = new Schema<IPowerUpCode>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "Session",
      required: true,
      index: true,
    },
    code: { type: String, required: true, uppercase: true, trim: true },
    powerUpType: {
      type: String,
      required: true,
      enum: UNMASKED_POWER_UP_ENUM,
    },
    scope: {
      type: String,
      required: true,
      enum: ["universal", "per_team"],
      default: "universal",
    },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    redeemedBy: {
      type: [Schema.Types.ObjectId],
      ref: "Team",
      default: [],
    },
  },
  { timestamps: true },
);

PowerUpCodeSchema.index({ sessionId: 1, code: 1 }, { unique: true });

export const Event: Model<IEvent> =
  mongoose.models.Event || mongoose.model<IEvent>("Event", EventSchema);

export const GameDefinition: Model<IGameDefinition> =
  mongoose.models.GameDefinition ||
  mongoose.model<IGameDefinition>("GameDefinition", GameDefinitionSchema);

export const Session: Model<ISession> =
  mongoose.models.Session || mongoose.model<ISession>("Session", SessionSchema);

export const Team: Model<ITeam> =
  mongoose.models.Team || mongoose.model<ITeam>("Team", TeamSchema);

export const Clue: Model<IClue> =
  mongoose.models.Clue || mongoose.model<IClue>("Clue", ClueSchema);

export const FinalPuzzle: Model<IFinalPuzzle> =
  mongoose.models.FinalPuzzle ||
  mongoose.model<IFinalPuzzle>("FinalPuzzle", FinalPuzzleSchema);

export const MindgameState: Model<IMindgameState> =
  mongoose.models.MindgameState ||
  mongoose.model<IMindgameState>("MindgameState", MindgameStateSchema);

export const GameResult: Model<IGameResult> =
  mongoose.models.GameResult ||
  mongoose.model<IGameResult>("GameResult", GameResultSchema);

if (process.env.NODE_ENV === "development" && mongoose.models.UnmaskedState) {
  delete mongoose.models.UnmaskedState;
}

export const UnmaskedState: Model<IUnmaskedState> =
  mongoose.models.UnmaskedState ||
  mongoose.model<IUnmaskedState>("UnmaskedState", UnmaskedStateSchema);

// Next.js dev HMR can keep a cached `PowerUpCode` model with an outdated `enum`
// (e.g. after adding `safe_opening` or new power-up types), causing validation errors.
if (process.env.NODE_ENV === "development" && mongoose.models.PowerUpCode) {
  delete mongoose.models.PowerUpCode;
}

export const PowerUpCode: Model<IPowerUpCode> =
  mongoose.models.PowerUpCode ||
  mongoose.model<IPowerUpCode>("PowerUpCode", PowerUpCodeSchema);
