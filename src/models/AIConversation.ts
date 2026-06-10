import mongoose, { Document, Schema } from "mongoose";

// ─── Message Sub-Schema ────────────────────────────────────────────────────────

export interface IMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: {
    guardrailTriggered?: boolean;
    guardrailType?: "diagnosis" | "emergency" | "prescription";
    insightsIncluded?: boolean;
  };
}

const MessageSchema = new Schema<IMessage>(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 10000,
    },
    timestamp: {
      type: Date,
      default: () => new Date(),
    },
    metadata: {
      guardrailTriggered: { type: Boolean },
      guardrailType: {
        type: String,
        enum: ["diagnosis", "emergency", "prescription"],
      },
      insightsIncluded: { type: Boolean },
    },
  },
  { _id: true }
);

// ─── Conversation Schema ───────────────────────────────────────────────────────

export interface IAIConversation extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  messages: IMessage[];
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean;
  messageCount: number;
}

const AIConversationSchema = new Schema<IAIConversation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      default: "New Conversation",
      maxlength: 200,
    },
    messages: {
      type: [MessageSchema],
      default: [],
    },
    lastMessageAt: {
      type: Date,
      default: () => new Date(),
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────

// Primary query pattern: get user's conversations sorted by recency
AIConversationSchema.index({ userId: 1, lastMessageAt: -1 });

// Support filtering archived vs active
AIConversationSchema.index({ userId: 1, isArchived: 1, lastMessageAt: -1 });

// ─── Middleware ────────────────────────────────────────────────────────────────

// Auto-generate title from first user message & keep messageCount in sync
AIConversationSchema.pre("save", function (next) {
  if (this.isModified("messages")) {
    this.messageCount = this.messages.length;
    this.lastMessageAt = new Date();

    // Auto-title: derive from first user message if still default
    if (this.title === "New Conversation") {
      const firstUserMsg = this.messages.find((m) => m.role === "user");
      if (firstUserMsg) {
        this.title = firstUserMsg.content.slice(0, 60).trim() +
          (firstUserMsg.content.length > 60 ? "…" : "");
      }
    }
  }
  next();
});

// ─── Model ─────────────────────────────────────────────────────────────────────

const AIConversation =
  mongoose.models.AIConversation ||
  mongoose.model<IAIConversation>("AIConversation", AIConversationSchema);

export default AIConversation;