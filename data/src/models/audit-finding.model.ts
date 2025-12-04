// data/src/models/audit-finding.model.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditFinding extends Document {
  id: number;
  kind: string;
  auditfirm_id: number;
  impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  finders_count: number;
  protocol_id: number;
  title: string;
  content: string;
  summary: string;
  report_date: Date;
  contest_link: string;
  sponsor_name: string;
  quality_score: number;
  general_score: number;
  source_link: string;
  firm_name: string;
  protocol_name: string;
  slug: string;
  
  // Metadata cho RAG
  embedding?: number[];
  chunks?: IChunk[];
  indexed_at?: Date;
}

interface IChunk {
  text: string;
  embedding?: number[];
  chunk_index: number;
  metadata: {
    section: string; // 'description', 'recommendation', etc.
    impact: string;
    protocol: string;
  };
}

const ChunkSchema = new Schema({
  text: { type: String, required: true },
  embedding: [Number],
  chunk_index: { type: Number, required: true },
  metadata: {
    section: String,
    impact: String,
    protocol: String
  }
});

const AuditFindingSchema = new Schema({
  id: { type: Number, required: true, unique: true },
  kind: String,
  auditfirm_id: Number,
  impact: { 
    type: String, 
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    index: true 
  },
  finders_count: Number,
  protocol_id: { type: Number, index: true },
  title: { type: String, required: true, index: 'text' },
  content: { type: String, required: true },
  summary: { type: String, index: 'text' },
  report_date: { type: Date, index: true },
  contest_link: String,
  sponsor_name: String,
  quality_score: Number,
  general_score: Number,
  source_link: String,
  firm_name: { type: String, index: true },
  protocol_name: { type: String, index: true },
  slug: { type: String, unique: true },
  
  // RAG fields
  embedding: [Number],
  chunks: [ChunkSchema],
  indexed_at: Date
}, {
  timestamps: true,
  collection: 'audit_findings'
});

// Index cho vector search (nếu dùng MongoDB Atlas Vector Search)
AuditFindingSchema.index({ embedding: '2dsphere' });

export const AuditFinding = mongoose.model<IAuditFinding>(
  'AuditFinding', 
  AuditFindingSchema
);