// scripts/ingest-audit-findings.ts
import mongoose from 'mongoose';
import { AuditFinding } from '../data/src/models/audit-finding.model';
import { DocumentProcessor } from '../rag/src/indexing/document-processor';
import { OpenAIEmbeddingService } from '../integrations/src/openai/embeddings.service';
import fs from 'fs/promises';
import path from 'path';

interface IngestionConfig {
  batchSize: number;
  delayMs: number; // Delay between batches to avoid rate limits
  skipExisting: boolean;
}

class AuditFindingIngestion {
  private processor: DocumentProcessor;
  private embeddingService: OpenAIEmbeddingService;
  private config: IngestionConfig;

  constructor(config: Partial<IngestionConfig> = {}) {
    this.processor = new DocumentProcessor();
    this.embeddingService = new OpenAIEmbeddingService(
      process.env.OPENAI_API_KEY!
    );
    this.config = {
      batchSize: 10,
      delayMs: 1000,
      skipExisting: true,
      ...config
    };
  }

  /**
   * Ingest audit findings từ JSON file
   */
  async ingestFromFile(filePath: string): Promise<void> {
    console.log(`Reading data from ${filePath}...`);
    
    const rawData = await fs.readFile(filePath, 'utf-8');
    const findings = JSON.parse(rawData);

    console.log(`Found ${findings.length} audit findings to process`);

    await this.ingestFindings(findings);
  }

  /**
   * Ingest array of audit findings
   */
  async ingestFindings(findings: any[]): Promise<void> {
    const batches = this.createBatches(findings, this.config.batchSize);
    
    console.log(`Processing ${batches.length} batches...`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`\nProcessing batch ${i + 1}/${batches.length}`);
      
      await this.processBatch(batch);
      
      // Delay between batches
      if (i < batches.length - 1) {
        await this.delay(this.config.delayMs);
      }
    }

    console.log('\n✅ Ingestion completed successfully!');
  }

  /**
   * Process một batch findings
   */
  private async processBatch(findings: any[]): Promise<void> {
    const promises = findings.map(finding => this.processFinding(finding));
    
    const results = await Promise.allSettled(promises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`  ✓ Successful: ${successful}, ✗ Failed: ${failed}`);
    
    // Log errors
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        console.error(`  Error processing finding ${findings[idx].id}:`, result.reason);
      }
    });
  }

  /**
   * Process single audit finding
   */
  private async processFinding(findingData: any): Promise<void> {
    // Check if already exists
    if (this.config.skipExisting) {
      const exists = await AuditFinding.findOne({ id: findingData.id });
      if (exists?.indexed_at) {
        console.log(`  ⏭ Skipping ${findingData.id} (already indexed)`);
        return;
      }
    }

    // 1. Create or update document
    let finding = await AuditFinding.findOne({ id: findingData.id });
    if (!finding) {
      finding = new AuditFinding(findingData);
    } else {
      Object.assign(finding, findingData);
    }

    // 2. Process into chunks
    const chunks = this.processor.processAuditFinding(finding);
    console.log(`  📄 Created ${chunks.length} chunks for finding ${finding.id}`);

    // 3. Generate embeddings for each chunk
    const chunkTexts = chunks.map(c => c.text);
    const embeddings = await this.embeddingService.generateEmbeddings(chunkTexts);

    // 4. Attach embeddings to chunks
    finding.chunks = chunks.map((chunk, idx) => ({
      ...chunk,
      embedding: embeddings[idx]
    }));

    // 5. Generate overall document embedding (average of chunks)
    finding.embedding = this.averageEmbeddings(embeddings);
    finding.indexed_at = new Date();

    // 6. Save to database
    await finding.save();
    console.log(`  ✅ Indexed finding ${finding.id}: ${finding.title}`);
  }

  /**
   * Calculate average embedding
   */
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

  /**
   * Create batches from array
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Re-index existing findings (regenerate embeddings)
   */
  async reindexAll(): Promise<void> {
    console.log('Fetching all findings for re-indexing...');
    
    const findings = await AuditFinding.find({});
    console.log(`Found ${findings.length} findings to re-index`);

    await this.ingestFindings(
      findings.map(f => f.toObject())
    );
  }

  /**
   * Get ingestion statistics
   */
  async getStats(): Promise<any> {
    const total = await AuditFinding.countDocuments();
    const indexed = await AuditFinding.countDocuments({ 
      indexed_at: { $exists: true } 
    });
    const withChunks = await AuditFinding.countDocuments({
      chunks: { $exists: true, $ne: [] }
    });

    return {
      total,
      indexed,
      withChunks,
      indexedPercentage: ((indexed / total) * 100).toFixed(2) + '%'
    };
  }
}

// CLI execution
async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB');

    const ingestion = new AuditFindingIngestion({
      batchSize: 5,
      delayMs: 2000,
      skipExisting: true
    });

    const command = process.argv[2];

    switch (command) {
      case 'ingest':
        const filePath = process.argv[3] || './data/audit-findings.json';
        await ingestion.ingestFromFile(filePath);
        break;

      case 'reindex':
        await ingestion.reindexAll();
        break;

      case 'stats':
        const stats = await ingestion.getStats();
        console.log('\n📊 Ingestion Statistics:');
        console.log(JSON.stringify(stats, null, 2));
        break;

      default:
        console.log('Usage:');
        console.log('  npm run ingest -- ingest [file]  # Ingest from JSON file');
        console.log('  npm run ingest -- reindex         # Re-index all findings');
        console.log('  npm run ingest -- stats           # Show statistics');
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { AuditFindingIngestion };