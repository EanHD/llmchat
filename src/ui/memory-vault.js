/**
 * Memory Vault UI
 * Browse, search, and manage memories stored by Kai
 */

import { storage } from '../core/storage.js';
import { $, createElement, clearElement } from '../utils/dom.js';

class MemoryVaultUI {
  constructor() {
    this.panel = null;
    this.backdrop = null;
    this.searchInput = null;
    this.memoriesContainer = null;
    this.statsContainer = null;
    
    this.memories = [];
    this.filteredMemories = [];
    this.selectedType = 'all';
    this.currentSearch = '';
    this.apiEndpoint = null;
    this.customHeaders = {};
    
    this.memoryTypeInfo = {
      episodic: { icon: '📖', label: 'Episodes', color: '#4a9eff', description: 'Conversations and events' },
      semantic: { icon: '🧠', label: 'Facts', color: '#9b59b6', description: 'Knowledge and information' },
      preference: { icon: '⭐', label: 'Preferences', color: '#f39c12', description: 'Your likes and settings' },
      bug_fix: { icon: '🐛', label: 'Bug Fixes', color: '#e74c3c', description: 'Issues you reported' },
      reflection: { icon: '💭', label: 'Reflections', color: '#1abc9c', description: 'AI insights about you' },
      prompt: { icon: '💬', label: 'Prompts', color: '#3498db', description: 'Custom prompts' },
      checklist: { icon: '✅', label: 'Checklists', color: '#2ecc71', description: 'Tasks and goals' }
    };
  }

  /**
   * Initialize and show memory vault
   */
  async init() {
    // Get API settings
    const settings = await storage.getAllSettings();
    this.apiEndpoint = settings.apiEndpoint;
    this.customHeaders = settings.customHeaders || {};
    
    // Create UI if doesn't exist
    if (!this.panel) {
      this.createUI();
    }
    
    // Load stats and memories
    await this.loadStats();
    await this.loadMemories();
    
    // Show panel
    this.show();
  }

  /**
   * Create memory vault UI
   */
  createUI() {
    // Create backdrop
    this.backdrop = createElement('div', {
      className: 'memory-vault-backdrop',
      onClick: () => this.hide()
    });
    
    // Create panel
    this.panel = createElement('div', {
      className: 'memory-vault-panel'
    });
    
    // Header
    const header = createElement('div', { className: 'memory-vault-header' });
    header.innerHTML = `
      <div class="memory-vault-title">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
        <h2>Memory Vault</h2>
      </div>
      <button class="memory-vault-close" aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    `;
    
    const closeBtn = header.querySelector('.memory-vault-close');
    closeBtn.addEventListener('click', () => this.hide());
    
    // Stats section
    this.statsContainer = createElement('div', { className: 'memory-vault-stats' });
    
    // Search and filters
    const searchSection = createElement('div', { className: 'memory-vault-search' });
    searchSection.innerHTML = `
      <div class="search-input-wrapper">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input 
          type="text" 
          class="memory-search-input" 
          placeholder="Search memories..."
          aria-label="Search memories"
        />
      </div>
    `;
    
    this.searchInput = searchSection.querySelector('.memory-search-input');
    this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    
    // Type filters
    const filterSection = createElement('div', { className: 'memory-type-filters' });
    this.createTypeFilters(filterSection);
    
    // Memories list
    this.memoriesContainer = createElement('div', { className: 'memory-vault-content' });
    
    // Assemble panel
    this.panel.appendChild(header);
    this.panel.appendChild(this.statsContainer);
    this.panel.appendChild(searchSection);
    this.panel.appendChild(filterSection);
    this.panel.appendChild(this.memoriesContainer);
    
    // Add to DOM
    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.panel);
  }

  /**
   * Create type filter buttons
   */
  createTypeFilters(container) {
    const filterHTML = `
      <button class="type-filter active" data-type="all">
        <span class="filter-icon">📚</span>
        <span class="filter-label">All</span>
      </button>
    `;
    
    container.innerHTML = filterHTML;
    
    // Add type-specific filters
    for (const [type, info] of Object.entries(this.memoryTypeInfo)) {
      const btn = createElement('button', {
        className: 'type-filter',
        'data-type': type
      });
      btn.innerHTML = `
        <span class="filter-icon">${info.icon}</span>
        <span class="filter-label">${info.label}</span>
      `;
      btn.addEventListener('click', () => this.filterByType(type));
      container.appendChild(btn);
    }
    
    // All button handler
    const allBtn = container.querySelector('[data-type="all"]');
    allBtn.addEventListener('click', () => this.filterByType('all'));
  }

  /**
   * Load memory stats
   */
  async loadStats() {
    try {
      const response = await fetch(`${this.apiEndpoint}/v1/memory/stats`, {
        headers: {
          ...this.customHeaders,
          'ngrok-skip-browser-warning': 'true'
        }
      });
      
      if (!response.ok) throw new Error('Failed to load stats');
      
      const data = await response.json();
      this.renderStats(data);
    } catch (error) {
      console.error('Failed to load memory stats:', error);
      this.statsContainer.innerHTML = '<p class="error-message">Failed to load statistics</p>';
    }
  }

  /**
   * Render stats section
   */
  renderStats(data) {
    const total = data.total || 0;
    const byType = data.by_type || {};
    
    let statsHTML = `
      <div class="stat-card stat-total">
        <div class="stat-value">${total}</div>
        <div class="stat-label">Total Memories</div>
      </div>
    `;
    
    for (const [type, count] of Object.entries(byType)) {
      if (count > 0) {
        const info = this.memoryTypeInfo[type];
        if (info) {
          statsHTML += `
            <div class="stat-card">
              <div class="stat-icon">${info.icon}</div>
              <div class="stat-value">${count}</div>
              <div class="stat-label">${info.label}</div>
            </div>
          `;
        }
      }
    }
    
    this.statsContainer.innerHTML = statsHTML;
  }

  /**
   * Load all memories
   */
  async loadMemories(type = null) {
    try {
      const url = new URL(`${this.apiEndpoint}/v1/memory/list`);
      if (type && type !== 'all') {
        url.searchParams.set('type', type);
      }
      url.searchParams.set('limit', '1000');
      
      const response = await fetch(url, {
        headers: {
          ...this.customHeaders,
          'ngrok-skip-browser-warning': 'true'
        }
      });
      
      if (!response.ok) throw new Error('Failed to load memories');
      
      const data = await response.json();
      this.memories = data.memories || [];
      this.filteredMemories = [...this.memories];
      
      this.renderMemories();
    } catch (error) {
      console.error('Failed to load memories:', error);
      this.memoriesContainer.innerHTML = '<p class="error-message">Failed to load memories</p>';
    }
  }

  /**
   * Render memories list
   */
  renderMemories() {
    clearElement(this.memoriesContainer);
    
    if (this.filteredMemories.length === 0) {
      this.memoriesContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🧠</div>
          <p>No memories found</p>
          <p class="empty-hint">Kai will remember important details from your conversations</p>
        </div>
      `;
      return;
    }
    
    for (const memory of this.filteredMemories) {
      const memoryCard = this.createMemoryCard(memory);
      this.memoriesContainer.appendChild(memoryCard);
    }
  }

  /**
   * Create memory card element
   */
  createMemoryCard(memory) {
    const info = this.memoryTypeInfo[memory.type] || { icon: '📝', label: memory.type, color: '#95a5a6' };
    const date = new Date(memory.created_at).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    const card = createElement('div', { className: 'memory-card' });
    card.style.borderLeft = `4px solid ${info.color}`;
    
    card.innerHTML = `
      <div class="memory-header">
        <div class="memory-type">
          <span class="memory-icon">${info.icon}</span>
          <span class="memory-type-label">${info.label}</span>
        </div>
        <div class="memory-date">${date}</div>
      </div>
      
      ${memory.summary ? `<div class="memory-summary">${this.escapeHtml(memory.summary)}</div>` : ''}
      
      ${memory.tags && memory.tags.length > 0 ? `
        <div class="memory-tags">
          ${memory.tags.map(tag => `<span class="memory-tag">${this.escapeHtml(tag)}</span>`).join('')}
        </div>
      ` : ''}
      
      <div class="memory-actions">
        <button class="memory-action-btn" data-action="view" data-id="${memory.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          View Details
        </button>
        <button class="memory-action-btn danger" data-action="delete" data-id="${memory.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          Delete
        </button>
      </div>
    `;
    
    // Add event listeners
    const viewBtn = card.querySelector('[data-action="view"]');
    const deleteBtn = card.querySelector('[data-action="delete"]');
    
    viewBtn.addEventListener('click', () => this.viewMemory(memory));
    deleteBtn.addEventListener('click', () => this.deleteMemory(memory.id));
    
    return card;
  }

  /**
   * View memory details
   */
  viewMemory(memory) {
    const modal = createElement('div', { className: 'memory-modal' });
    const info = this.memoryTypeInfo[memory.type] || { icon: '📝', label: memory.type };
    
    modal.innerHTML = `
      <div class="memory-modal-content">
        <div class="memory-modal-header">
          <h3>
            <span>${info.icon}</span>
            ${info.label}
          </h3>
          <button class="memory-modal-close">✕</button>
        </div>
        
        ${memory.summary ? `<div class="memory-detail-summary">${this.escapeHtml(memory.summary)}</div>` : ''}
        
        <div class="memory-detail-section">
          <h4>Details</h4>
          <pre>${JSON.stringify(memory.payload, null, 2)}</pre>
        </div>
        
        <div class="memory-detail-meta">
          <div><strong>Created:</strong> ${new Date(memory.created_at).toLocaleString()}</div>
          ${memory.last_used_at ? `<div><strong>Last Used:</strong> ${new Date(memory.last_used_at).toLocaleString()}</div>` : ''}
          ${memory.confidence ? `<div><strong>Confidence:</strong> ${(memory.confidence * 100).toFixed(0)}%</div>` : ''}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeBtn = modal.querySelector('.memory-modal-close');
    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  /**
   * Delete memory
   */
  async deleteMemory(memoryId) {
    if (!confirm('Are you sure you want to delete this memory? This cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`${this.apiEndpoint}/v1/memory/${memoryId}`, {
        method: 'DELETE',
        headers: {
          ...this.customHeaders,
          'ngrok-skip-browser-warning': 'true'
        }
      });
      
      if (!response.ok) throw new Error('Failed to delete memory');
      
      // Remove from local array
      this.memories = this.memories.filter(m => m.id !== memoryId);
      this.filteredMemories = this.filteredMemories.filter(m => m.id !== memoryId);
      
      // Reload stats and re-render
      await this.loadStats();
      this.renderMemories();
      
    } catch (error) {
      console.error('Failed to delete memory:', error);
      alert('Failed to delete memory. Please try again.');
    }
  }

  /**
   * Filter memories by type
   */
  async filterByType(type) {
    this.selectedType = type;
    
    // Update filter buttons
    const filters = document.querySelectorAll('.type-filter');
    filters.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
    
    // Reload memories with filter
    await this.loadMemories(type);
    
    // Reapply search if active
    if (this.currentSearch) {
      this.filterMemories(this.currentSearch);
    }
  }

  /**
   * Handle search input
   */
  handleSearch(query) {
    this.currentSearch = query.trim();
    
    if (this.currentSearch === '') {
      this.filteredMemories = [...this.memories];
      this.renderMemories();
      return;
    }
    
    this.filterMemories(this.currentSearch);
  }

  /**
   * Filter memories by search query (local)
   */
  filterMemories(query) {
    const lowerQuery = query.toLowerCase();
    
    this.filteredMemories = this.memories.filter(memory => {
      // Search in summary
      if (memory.summary && memory.summary.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      
      // Search in tags
      if (memory.tags && memory.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
        return true;
      }
      
      // Search in payload (convert to string)
      const payloadStr = JSON.stringify(memory.payload).toLowerCase();
      if (payloadStr.includes(lowerQuery)) {
        return true;
      }
      
      return false;
    });
    
    this.renderMemories();
  }

  /**
   * Show panel
   */
  show() {
    this.backdrop.classList.add('active');
    this.panel.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  /**
   * Hide panel
   */
  hide() {
    this.backdrop.classList.remove('active');
    this.panel.classList.remove('active');
    document.body.style.overflow = '';
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Singleton instance
export const memoryVault = new MemoryVaultUI();
