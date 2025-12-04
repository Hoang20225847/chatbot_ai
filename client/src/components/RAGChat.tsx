// client/src/components/RAGChat.tsx
import React, { useState, useEffect } from 'react';
import { ragApi } from '../api/rag';

interface Source {
  id: string;
  text: string;
  score: number;
  metadata: {
    protocol: string;
    impact: string;
    title: string;
    section: string;
    source_link: string;
    firm: string;
  };
}

interface RAGResponse {
  answer: string;
  sources: Source[];
  metadata: {
    retrievalTime: number;
    generationTime: number;
    chunksUsed: number;
  };
}

export const RAGChat: React.FC = () => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<RAGResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    impact: [] as string[],
    protocol: [] as string[],
    firm: [] as string[]
  });
  const [availableFilters, setAvailableFilters] = useState<any>(null);

  useEffect(() => {
    loadFilters();
  }, []);

  const loadFilters = async () => {
    const data = await ragApi.getFilters();
    setAvailableFilters(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const result = await ragApi.query({
        query,
        topK: 5,
        minScore: 0.7,
        filters
      });
      setResponse(result);
    } catch (error) {
      console.error('RAG query failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rag-chat-container">
      {/* Search Form */}
      <form onSubmit={handleSubmit} className="search-form">
        <div className="search-input-wrapper">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about smart contract security vulnerabilities..."
            className="search-input"
            rows={3}
          />
          <button 
            type="submit" 
            disabled={loading}
            className="search-button"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Filters */}
        <div className="filters">
          <FilterSelect
            label="Impact"
            options={availableFilters?.impacts || []}
            selected={filters.impact}
            onChange={(impact) => setFilters({ ...filters, impact })}
          />
          <FilterSelect
            label="Protocol"
            options={availableFilters?.protocols || []}
            selected={filters.protocol}
            onChange={(protocol) => setFilters({ ...filters, protocol })}
          />
          <FilterSelect
            label="Audit Firm"
            options={availableFilters?.firms || []}
            selected={filters.firm}
            onChange={(firm) => setFilters({ ...filters, firm })}
          />
        </div>
      </form>

      {/* Response */}
      {response && (
        <div className="response-container">
          {/* Answer */}
          <div className="answer-section">
            <h3>Answer</h3>
            <div className="answer-text">
              {response.answer}
            </div>
            
            {/* Metadata */}
            <div className="metadata">
              <span>⏱️ Retrieval: {response.metadata.retrievalTime}ms</span>
              <span>🤖 Generation: {response.metadata.generationTime}ms</span>
              <span>📄 Sources used: {response.metadata.chunksUsed}</span>
            </div>
          </div>

          {/* Sources */}
          <div className="sources-section">
            <h3>Sources ({response.sources.length})</h3>
            {response.sources.map((source, idx) => (
              <SourceCard key={idx} source={source} index={idx + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Filter Select Component
const FilterSelect: React.FC<{
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}> = ({ label, options, selected, onChange }) => {
  const handleToggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(s => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div className="filter-select">
      <label>{label}</label>
      <div className="filter-options">
        {options.map(option => (
          <button
            key={option}
            type="button"
            className={`filter-option ${selected.includes(option) ? 'active' : ''}`}
            onClick={() => handleToggle(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};

// Source Card Component
const SourceCard: React.FC<{
  source: Source;
  index: number;
}> = ({ source, index }) => {
  const [expanded, setExpanded] = useState(false);

  const getImpactColor = (impact: string) => {
    const colors = {
      LOW: '#4CAF50',
      MEDIUM: '#FF9800',
      HIGH: '#FF5722',
      CRITICAL: '#D32F2F'
    };
    return colors[impact as keyof typeof colors] || '#757575';
  };

  return (
    <div className="source-card">
      <div className="source-header" onClick={() => setExpanded(!expanded)}>
        <div className="source-title">
          <span className="source-index">[{index}]</span>
          <span className="protocol-name">{source.metadata.protocol}</span>
          <span 
            className="impact-badge"
            style={{ backgroundColor: getImpactColor(source.metadata.impact) }}
          >
            {source.metadata.impact}
          </span>
          <span className="score">
            Score: {source.score.toFixed(3)}
          </span>
        </div>
        <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div className="source-content">
          <div className="source-metadata">
            <div><strong>Issue:</strong> {source.metadata.title}</div>
            <div><strong>Section:</strong> {source.metadata.section}</div>
            <div><strong>Audit Firm:</strong> {source.metadata.firm}</div>
          </div>
          
          <div className="source-text">
            {source.text}
          </div>

          <a 
            href={source.metadata.source_link} 
            target="_blank" 
            rel="noopener noreferrer"
            className="source-link"
          >
            View Full Report →
          </a>
        </div>
      )}
    </div>
  );
};

// client/src/api/rag.ts
export const ragApi = {
  async query(params: {
    query: string;
    topK?: number;
    minScore?: number;
    filters?: any;
  }) {
    const response = await fetch('/api/rag/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    
    return result.data;
  },

  async search(params: {
    query: string;
    topK?: number;
    filters?: any;
  }) {
    const response = await fetch('/api/rag/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    
    return result.data;
  },

  async getFilters() {
    const response = await fetch('/api/rag/filters');
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    
    return result.data;
  },

  async compareProtocols(protocols: string[], aspect: string) {
    const response = await fetch('/api/rag/compare-protocols', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocols, aspect })
    });
    
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    
    return result.data;
  }
};