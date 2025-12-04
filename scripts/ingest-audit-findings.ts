// scripts/ingest-audit-findings.ts
import mongoose from 'mongoose';
import { AuditFinding } from '../data/src/models/audit-finding.model';
import { DocumentProcessor } from '../rag/src/indexing/document-processor';
import { GeminiEmbeddingService } from '../integrations/src/gemini';
import fs from 'fs/promises';
import path from 'path';

interface IngestionConfig {
  batchSize: number;
  delayMs: number;
  skipExisting: boolean;
}

class AuditFindingIngestion {
  private processor: DocumentProcessor;
  private embeddingService: GeminiEmbeddingService;
  private config: IngestionConfig;

  constructor(config: Partial<IngestionConfig> = {}) {
    this.processor = new DocumentProcessor();
    this.embeddingService = new GeminiEmbeddingService(
      process.env.GEMINI_API_KEY!
    );
    this.config = {
      batchSize: 3,
      delayMs: 2000,
      skipExisting: true,
      ...config
    };
  }

  async ingestFromFolder(folderPath: string): Promise<void> {
    console.log(`📂 Reading JSON files from ${folderPath}...`);
    
    const files = await fs.readdir(folderPath);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    console.log(`Found ${jsonFiles.length} JSON files`);

    const findings = [];
    for (const file of jsonFiles) {
      const filePath = path.join(folderPath, file);
      const rawData = await fs.readFile(filePath, 'utf-8');
      const finding = JSON.parse(rawData);
      findings.push(finding);
    }

    await this.ingestFindings(findings);
  }

  async ingestFindings(findings: any[]): Promise<void> {
    const batches = this.createBatches(findings, this.config.batchSize);
    
    console.log(`\n📊 Processing ${findings.length} findings in ${batches.length} batches...\n`);

    let totalSuccessful = 0;
    let totalFailed = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`\n🔄 Batch ${i + 1}/${batches.length} (${batch.length} findings)`);
      
      const { successful, failed } = await this.processBatch(batch);
      totalSuccessful += successful;
      totalFailed += failed;
      
      if (i < batches.length - 1) {
        console.log(`⏳ Waiting ${this.config.delayMs}ms before next batch...`);
        await this.delay(this.config.delayMs);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Ingestion completed!');
    console.log(`   Successful: ${totalSuccessful}`);
    console.log(`   Failed: ${totalFailed}`);
    console.log('='.repeat(50) + '\n');
  }

  private async processBatch(findings: any[]): Promise<{ successful: number; failed: number }> {
    const promises = findings.map(finding => this.processFinding(finding));
    
    const results = await Promise.allSettled(promises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`   ✓ Successful: ${successful}, ✗ Failed: ${failed}`);
    
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        console.error(`   ❌ Error processing finding ${findings[idx].id}:`, result.reason?.message || result.reason);
      }
    });

    return { successful, failed };
  }

  private async processFinding(findingData: any): Promise<void> {
    if (this.config.skipExisting) {
      const exists = await AuditFinding.findOne({ id: findingData.id });
      if (exists?.indexed_at) {
        console.log(`   ⏭  Skipping ${findingData.id} (already indexed)`);
        return;
      }
    }

    let finding = await AuditFinding.findOne({ id: findingData.id });
    if (!finding) {
      finding = new AuditFinding(findingData);
    } else {
      Object.assign(finding, findingData);
    }

    const chunks = this.processor.processAuditFinding(finding);
    console.log(`   📄 Created ${chunks.length} chunks for finding ${finding.id}`);

    const chunkTexts = chunks.map(c => c.text);
    let embeddings: number[][] = [];
    
    try {
      embeddings = await this.generateEmbeddingsWithRetry(chunkTexts);
    } catch (error) {
      console.error(`   ❌ Failed to generate embeddings for finding ${finding.id}`);
      throw error;
    }

    finding.chunks = chunks.map((chunk, idx) => ({
      ...chunk,
      embedding: embeddings[idx]
    }));

    finding.embedding = this.averageEmbeddings(embeddings);
    finding.indexed_at = new Date();

    await finding.save();
    console.log(`   ✅ Indexed finding ${finding.id}: ${finding.title.substring(0, 50)}...`);
  }

  private async generateEmbeddingsWithRetry(
    texts: string[],
    maxRetries: number = 3
  ): Promise<number[][]> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.embeddingService.generateEmbeddings(texts);
      } catch (error: any) {
        console.error(`   ⚠️  Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`   ⏳ Retrying in ${delay}ms...`);
        await this.delay(delay);
      }
    }
    
    throw new Error('Failed to generate embeddings after retries');
  }

  private averageEmbeddings(embeddings: number[][]): number[] {
    if (embeddings.length === 0) return [];
    
    const dimension = embeddings[0].length;
    const avg = new Array(dimension).fill(0);
    
    for (const embedding of embeddings) {
      for (let i = 0; i < dimension; i++) {
        avg[i] += embedding[i];
      }
    }
    
    return avg.map(val => val / embeddings.length);
  }

  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getStats(): Promise<any> {
    const total = await AuditFinding.countDocuments();
    const indexed = await AuditFinding.countDocuments({ 
      indexed_at: { $exists: true } 
    });
    const withChunks = await AuditFinding.countDocuments({
      chunks: { $exists: true, $ne: [] }
    });
    const withEmbeddings = await AuditFinding.countDocuments({
      embedding: { $exists: true, $ne: [] }
    });

    const byImpact = await AuditFinding.aggregate([
      {
        $group: {
          _id: '$impact',
          count: { $sum: 1 },
          indexed: {
            $sum: {
              $cond: [{ $ifNull: ['$indexed_at', false] }, 1, 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return {
      total,
      indexed,
      withChunks,
      withEmbeddings,
      indexedPercentage: ((indexed / total) * 100).toFixed(2) + '%',
      byImpact
    };
  }

  async testEmbedding(text: string): Promise<void> {
    console.log('\n🧪 Testing embedding generation...');
    console.log(`Text: "${text.substring(0, 100)}..."`);
    
    try {
      const embedding = await this.embeddingService.generateEmbedding(text);
      console.log(`✅ Generated embedding with ${embedding.length} dimensions`);
      console.log(`Sample values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
    } catch (error: any) {
      console.error('❌ Failed:', error.message);
    }
  }
}

async function main() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const ingestion = new AuditFindingIngestion({
      batchSize: 3,
      delayMs: 2000,
      skipExisting: true
    });

    const command = process.argv[2];

    switch (command) {
      case 'ingest':
        const folderPath = process.argv[3] || './datatest';
        await ingestion.ingestFromFolder(folderPath);
        break;

      case 'stats':
        const stats = await ingestion.getStats();
        console.log('\n📊 Ingestion Statistics:');
        console.log(JSON.stringify(stats, null, 2));
        break;

      case 'test':
        await ingestion.testEmbedding('This is a test for embedding generation with Gemini API');
        break;

      default:
        console.log(`
Usage:
  npm run ingest -- ingest [folder]   # Ingest from folder (default: ./datatest)
  npm run ingest -- stats              # Show statistics
  npm run ingest -- test               # Test embedding generation

Example:
  npm run ingest -- ingest ./datatest
        `);
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { AuditFindingIngestion };